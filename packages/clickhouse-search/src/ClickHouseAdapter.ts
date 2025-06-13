import { createClient } from '@clickhouse/client';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles } from 'shared-utils';

export class ClickHouseAdapter implements DatabaseAdapter {
  public readonly name = 'ClickHouse';
  private client: any;

  async initialize(): Promise<void> {
    await this.initializeWithRetry();
    console.log('ClickHouse schema created with optimized indexes');
    await this.seedData();
  }

  private async initializeWithRetry(maxRetries: number = 10, baseDelay: number = 2000): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`ClickHouse connection attempt ${attempt}/${maxRetries}...`);
        
        this.client = createClient({
          host: 'http://clickhouse:8123',
          username: 'admin',
          password: 'clickhouse123',
          database: 'fulltext_db'
        });

        await this.client.ping();
        console.log('ClickHouse connection established');

        await this.client.command({
          query: 'CREATE DATABASE IF NOT EXISTS fulltext_db'
        });

        await this.client.command({
          query: `
            CREATE TABLE IF NOT EXISTS articles (
              id UInt32,
              title String,
              content String,
              author LowCardinality(String),
              tags Array(String),
              searchable_text String,
              title_tokens Array(String),
              content_tokens Array(String)
            ) ENGINE = MergeTree()
            ORDER BY (author, id)
            SETTINGS index_granularity = 8192
          `
        });

        await this.client.command({
          query: `
            ALTER TABLE articles 
            ADD INDEX IF NOT EXISTS title_fulltext_idx title TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1
          `
        });

        await this.client.command({
          query: `
            ALTER TABLE articles 
            ADD INDEX IF NOT EXISTS content_fulltext_idx content TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1
          `
        });

        await this.client.command({
          query: `
            ALTER TABLE articles 
            ADD INDEX IF NOT EXISTS searchable_text_idx searchable_text TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1
          `
        });

        console.log('ClickHouse schema setup completed successfully');
        return;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`ClickHouse connection attempt ${attempt} failed:`, errorMessage);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to connect to ClickHouse after ${maxRetries} attempts. Last error: ${errorMessage}`);
        }

        const delay = baseDelay * Math.pow(1.5, attempt - 1);
        console.log(`Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async seedData(): Promise<void> {
    console.log('Seeding ClickHouse with 100k articles...');
    const articles = generatedArticles;

    await this.client.command({
      query: 'TRUNCATE TABLE articles'
    });

    const values = articles.map(article => ({
      id: parseInt(article.id),
      title: article.title,
      content: article.content,
      author: article.author,
      tags: article.tags,
      searchable_text: `${article.title} ${article.content} ${article.author} ${article.tags.join(' ')}`,
      title_tokens: article.title.toLowerCase().split(/\W+/).filter(Boolean),
      content_tokens: article.content.toLowerCase().split(/\W+/).filter(Boolean)
    }));

    await this.client.insert({
      table: 'articles',
      values,
      format: 'JSONEachRow'
    });

    console.log(`Seeded ${articles.length} articles to ClickHouse with enhanced search optimization`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number; }> {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    const wordConditions = queryWords.map(word => {
      const escapedWord = word.replace(/'/g, "''");
      return `(positionCaseInsensitive(title, '${escapedWord}') > 0 OR
               positionCaseInsensitive(content, '${escapedWord}') > 0 OR
               positionCaseInsensitive(author, '${escapedWord}') > 0 OR
               positionCaseInsensitive(searchable_text, '${escapedWord}') > 0)`;
    });

    const whereClause = wordConditions.join(' AND ');
    
    const searchQuery = limit > 0 ? `
      SELECT id, title, content, author, tags
      FROM articles
      WHERE ${whereClause}
      ORDER BY id ASC
      LIMIT ${limit}
    ` : '';
    
    const countQuery = `
      SELECT count() as total
      FROM articles
      WHERE ${whereClause}
    `;

    const queries = limit > 0 
      ? [
          this.client.query({ query: searchQuery, format: 'JSONEachRow' }),
          this.client.query({ query: countQuery, format: 'JSONEachRow' })
        ]
      : [this.client.query({ query: countQuery, format: 'JSONEachRow' })];

    const queryResults = await Promise.all(queries);
    
    const countData = await queryResults[limit > 0 ? 1 : 0].json() as any;
    const total = Array.isArray(countData) ? countData[0]?.total || 0 : countData.total || 0;

    let results = [];
    if (limit > 0) {
      const resultData = await queryResults[0].json() as any;
      results = Array.isArray(resultData) ? resultData : [resultData];
    }

    return {
      results,
      total
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const countResult = await this.client.query({
      query: 'SELECT count() as total FROM articles',
      format: 'JSONEachRow'
    });

    const countData = await countResult.json() as any;
    const total = Array.isArray(countData) ? countData[0]?.total || 0 : countData.total || 0;

    const result = await this.client.query({
      query: `
        SELECT id, title, content, author, tags
        FROM articles
        ORDER BY id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      format: 'JSONEachRow'
    });

    const data = await result.json() as any;
    const results = Array.isArray(data) ? data : [data];

    return {
      results,
      total,
      offset,
      limit
    };
  }

  public searchVariants = {
    like: async (query: string, limit: number) => {
      const whereClause = `
        lower(title) LIKE lower(concat('%', '${query}', '%'))
        OR lower(content) LIKE lower(concat('%', '${query}', '%'))
        OR lower(author) LIKE lower(concat('%', '${query}', '%'))
      `;

      const countResult = await this.client.query({
        query: `
          SELECT count() as total
          FROM articles
          WHERE ${whereClause}
        `,
        format: 'JSONEachRow'
      });
      
      const countData = await countResult.json() as any;
      const total = Array.isArray(countData) ? countData[0]?.total || 0 : countData.total || 0;
      
      const result = await this.client.query({
        query: `
          SELECT id, title, content, author, tags,
                 (position(lower(title), lower('${query}')) > 0) * 3 +
                 (position(lower(content), lower('${query}')) > 0) * 2 +
                 (position(lower(author), lower('${query}')) > 0) * 1 as relevance_score
          FROM articles
          WHERE ${whereClause}
          ORDER BY relevance_score DESC
          LIMIT ${limit}
        `,
        format: 'JSONEachRow'
      });

      const data = await result.json() as any;
      const results = Array.isArray(data) ? data : [data];

      return { results, total };
    },

    multiword: async (query: string, limit: number) => {
      const words = query.split(' ').filter(w => w.length > 0);
      
      const whereClause = words.map((word, i) => `
        (positionCaseInsensitive(title, '${word}') > 0 OR
         positionCaseInsensitive(content, '${word}') > 0 OR
         positionCaseInsensitive(author, '${word}') > 0)
      `).join(' AND ');

      const countResult = await this.client.query({
        query: `
          SELECT count() as total
          FROM articles
          WHERE ${whereClause}
        `,
        format: 'JSONEachRow'
      });
      
      const countData = await countResult.json() as any;
      const total = Array.isArray(countData) ? countData[0]?.total || 0 : countData.total || 0;
      
      const result = await this.client.query({
        query: `
          SELECT id, title, content, author, tags,
                 ${words.map((word, i) => `
                   (positionCaseInsensitive(title, '${word}') > 0) * 3 +
                   (positionCaseInsensitive(content, '${word}') > 0) * 2 +
                   (positionCaseInsensitive(author, '${word}') > 0) * 1
                 `).join(' + ')} as relevance_score
          FROM articles
          WHERE ${whereClause}
          ORDER BY relevance_score DESC
          LIMIT ${limit}
        `,
        format: 'JSONEachRow'
      });

      const data = await result.json() as any;
      const results = Array.isArray(data) ? data : [data];

      return { results, total };
    }
  };
} 