import { createClient } from '@clickhouse/client';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles, getBenchmarkQueries } from 'shared-utils';

export class ClickHouseAdapter implements DatabaseAdapter {
  public readonly name = 'ClickHouse';
  private client: any;

  async initialize(): Promise<void> {
    this.client = createClient({
      host: 'http://clickhouse:8123',
      username: 'admin',
      password: 'clickhouse123',
      database: 'fulltext_db'
    });

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

    console.log('ClickHouse schema created with optimized indexes');
    await this.seedData();
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

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    const queryStr = query.toLowerCase();
    const queryWords = queryStr.split(/\s+/).filter(word => word.length > 2);
    
    let whereConditions = [];
    
    if (queryWords.length > 1) {
      const wordConditions = queryWords.map(word => 
        `(positionCaseInsensitive(title, '${word}') > 0 OR positionCaseInsensitive(content, '${word}') > 0 OR positionCaseInsensitive(author, '${word}') > 0)`
      );
      whereConditions.push(`(${wordConditions.join(' AND ')})`);
    }
    
    whereConditions.push(`(multiSearchAnyCaseInsensitive(searchable_text, [${queryWords.map(w => `'${w}'`).join(',')}]) > 0)`);
    whereConditions.push(`(positionCaseInsensitive(searchable_text, '${queryStr}') > 0)`);

    const whereClause = whereConditions.join(' OR ');

    const countQuery = `
      SELECT count() as total
      FROM articles 
      WHERE ${whereClause}
    `;

    const countResult = await this.client.query({
      query: countQuery,
      format: 'JSONEachRow'
    });

    const countData = await countResult.json() as any;
    const totalCount = Array.isArray(countData) ? countData[0]?.total || 0 : countData.total || 0;

    const searchQuery = `
      SELECT 
        id,
        title,
        content,
        author,
        tags,
        (positionCaseInsensitive(title, '${queryStr}') * 10 + 
         positionCaseInsensitive(content, '${queryStr}') + 
         positionCaseInsensitive(author, '${queryStr}') * 5) as relevance_score
      FROM articles 
      WHERE ${whereClause}
      ORDER BY relevance_score DESC, id ASC
      LIMIT ${limit}
    `;

    const result = await this.client.query({
      query: searchQuery,
      format: 'JSONEachRow'
    });

    const data = await result.json() as any;
    const results = Array.isArray(data) ? data : [data];

    return {
      results,
      total: totalCount
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

  async benchmark(queries: string[]): Promise<{ benchmarks: any[]; averageDuration: string }> {
    const benchmarkQueries = getBenchmarkQueries();
    const results = [];

    for (const query of benchmarkQueries) {
      const start = Date.now();
      
      const result = await this.client.query({
        query: `
          SELECT count() as count
          FROM articles 
          WHERE multiSearchAnyCaseInsensitive(searchable_text, ['${query.toLowerCase()}']) > 0
        `,
        format: 'JSONEachRow'
      });
      
      const data = await result.json() as any;
      const count = Array.isArray(data) ? data[0]?.count || 0 : data.count || 0;
      const duration = Date.now() - start;
      
      results.push({
        query,
        resultCount: count,
        duration: `${duration}ms`
      });
    }

    return {
      benchmarks: results,
      averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
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