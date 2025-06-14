import { DuckDBConnection } from '@duckdb/node-api';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles, Article } from 'shared-utils';

export class DuckDBAdapter implements DatabaseAdapter {
  public readonly name = 'DuckDB';
  private connection: DuckDBConnection | null = null;

  async initialize(): Promise<void> {
    console.log('Initializing DuckDB with Neo API...');
    
    this.connection = await DuckDBConnection.create();
    
    await this.createTable();
    await this.seedData();
    
    const count = await this.getCount();
    console.log(`DuckDB database initialized with ${count} articles`);
  }

  private async createTable(): Promise<void> {
    await this.connection!.run(`
      CREATE TABLE articles (
        id VARCHAR PRIMARY KEY,
        title VARCHAR,
        content TEXT,
        author VARCHAR,
        tags VARCHAR,
        searchable_text VARCHAR,
        difficulty VARCHAR,
        type VARCHAR,
        read_time INTEGER,
        publish_date DATE,
        views INTEGER,
        rating DECIMAL(3,1)
      )
    `);
    console.log('Table created successfully');
  }

  private async seedData(): Promise<void> {
    console.log('Seeding DuckDB with 1M articles...');
    const articles = generatedArticles;

    await this.connection!.run('BEGIN TRANSACTION');
    
    try {
      const batchSize = 1000;
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        
        const values = batch.map(article => {
          const searchableText = `${article.title} ${article.content} ${article.author} ${article.tags.join(' ')}`;
          const difficulty = (article as any).difficulty || 'beginner';
          const type = (article as any).type || 'article';
          const readTime = (article as any).readTime || 5;
          const publishDate = (article as any).publishDate || '2023-01-01';
          const views = (article as any).views || 1000;
          const rating = (article as any).rating || 4.0;
          
          return `('${this.escapeString(article.id)}', '${this.escapeString(article.title)}', '${this.escapeString(article.content)}', '${this.escapeString(article.author)}', '${this.escapeString(article.tags.join(','))}', '${this.escapeString(searchableText)}', '${this.escapeString(difficulty)}', '${this.escapeString(type)}', ${readTime}, '${publishDate}', ${views}, ${rating})`;
        }).join(',\n');

        const insertQuery = `
          INSERT INTO articles (id, title, content, author, tags, searchable_text, difficulty, type, read_time, publish_date, views, rating) 
          VALUES ${values}
        `;

        await this.connection!.run(insertQuery);

        if ((i + batchSize) % 10000 === 0) {
          console.log(`Seeded ${Math.min(i + batchSize, articles.length)} articles...`);
        }
      }

      await this.connection!.run('COMMIT');
      console.log(`Transaction committed successfully`);
      
    } catch (error) {
      console.error('Error during seeding:', error);
      await this.connection!.run('ROLLBACK');
      throw error;
    }

    const count = await this.getCount();
    console.log(`Successfully seeded ${articles.length} articles to DuckDB. Verified count: ${count}`);
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number; }> {
    const effectiveLimit = Math.min(limit, 100);
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    const whereClause = searchTerms.map(term => 
      `(LOWER(searchable_text) LIKE '%${this.escapeString(term)}%')`
    ).join(' AND ');

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM articles 
      WHERE ${whereClause}
    `;

    const searchQuery = `
      SELECT id, title, content, author, tags, difficulty, type, read_time, publish_date, views, rating,
             CASE 
               WHEN LOWER(title) LIKE '%${this.escapeString(query.toLowerCase())}%' THEN 3
               WHEN LOWER(author) LIKE '%${this.escapeString(query.toLowerCase())}%' THEN 2
               ELSE 1
             END as relevance_score
      FROM articles 
      WHERE ${whereClause}
      ORDER BY relevance_score DESC, 
               LENGTH(title) ASC,
               id ASC
      LIMIT ${effectiveLimit}
    `;

    const [total, searchResult] = await Promise.all([
      this.getCount(countQuery),
      this.executeQuery(searchQuery)
    ]);

    return {
      results: searchResult.map((row: any) => ({
        id: row[0],
        title: row[1], 
        content: row[2],
        author: row[3],
        tags: row[4] ? row[4].split(',') : [],
        difficulty: row[5],
        type: row[6],
        readTime: row[7],
        publishDate: row[8],
        views: row[9],
        rating: row[10],
        relevance_score: row[11]
      })),
      total
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const effectiveLimit = Math.min(limit, 100);
    const total = await this.getFastCount();

    const results = await this.executeQuery(`
      SELECT id, title, content, author, tags, difficulty, type, read_time, publish_date, views, rating
      FROM articles 
      ORDER BY id 
      LIMIT ${effectiveLimit} OFFSET ${offset}
    `);

    return {
      results: results.map((row: any) => ({
        id: row[0],
        title: row[1],
        content: row[2],
        author: row[3],
        tags: row[4] ? row[4].split(',') : [],
        difficulty: row[5],
        type: row[6],
        readTime: row[7],
        publishDate: row[8],
        views: row[9],
        rating: row[10]
      })),
      total,
      offset,
      limit: effectiveLimit
    };
  }

  private async executeQuery(query: string): Promise<any[]> {
    const result = await this.connection!.run(query);
    const rows = await result.getRows();
    return rows;
  }

  private async getCount(query: string = 'SELECT COUNT(*) FROM articles'): Promise<number> {
    const result = await this.executeQuery(query);
    if (result && result.length > 0 && result[0] && result[0].length > 0) {
      const count = result[0][0];
      return typeof count === 'bigint' ? Number(count) : (count || 0);
    }
    return 0;
  }

  private async getFastCount(): Promise<number> {
    try {
      return await this.getCount('SELECT COUNT(*) as count FROM articles');
    } catch (error) {
      console.warn('Count query failed:', error);
      return 0;
    }
  }
} 