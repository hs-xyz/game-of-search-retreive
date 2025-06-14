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
    
    const count = await this.executeQuery('SELECT COUNT(*) as count FROM articles');
    console.log(`DuckDB database initialized with ${count[0]?.count || 0} articles`);
  }

  private async createTable(): Promise<void> {
    await this.connection!.run(`
      CREATE TABLE articles (
        id VARCHAR PRIMARY KEY,
        title VARCHAR,
        content TEXT,
        author VARCHAR,
        tags VARCHAR,
        searchable_text VARCHAR
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
          return `('${this.escapeString(article.id)}', '${this.escapeString(article.title)}', '${this.escapeString(article.content)}', '${this.escapeString(article.author)}', '${this.escapeString(article.tags.join(','))}', '${this.escapeString(searchableText)}')`;
        }).join(',\n');

        const insertQuery = `
          INSERT INTO articles (id, title, content, author, tags, searchable_text) 
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

    const count = await this.executeQuery('SELECT COUNT(*) as count FROM articles');
    console.log(`Successfully seeded ${articles.length} articles to DuckDB. Verified count: ${count[0]?.count || 0}`);
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number; }> {
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
      SELECT id, title, content, author, tags,
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
      LIMIT ${limit}
    `;

    const [totalResult, searchResult] = await Promise.all([
      this.executeQuery(countQuery),
      this.executeQuery(searchQuery)
    ]);

    return {
      results: searchResult.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author,
        tags: row.tags ? row.tags.split(',') : [],
        relevance_score: row.relevance_score
      })),
      total: totalResult[0]?.total || 0
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const total = await this.getFastCount();

    const results = await this.executeQuery(`
      SELECT id, title, content, author, tags
      FROM articles 
      ORDER BY id 
      LIMIT ${limit} OFFSET ${offset}
    `);

    return {
      results: results.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author,
        tags: row.tags ? row.tags.split(',') : []
      })),
      total,
      offset,
      limit
    };
  }

  private async getFastCount(): Promise<number> {
    try {
      const result = await this.executeQuery(`
        SELECT estimated_size as count 
        FROM duckdb_tables() 
        WHERE table_name = 'articles'
      `);
      
      if (result[0]?.count > 0) {
        return result[0].count;
      }
    } catch (error) {
      console.warn('Fast count failed, falling back to accurate count:', error);
    }
    
    const result = await this.executeQuery('SELECT COUNT(*) as count FROM articles');
    return result[0]?.count || 0;
  }

  private async executeQuery(query: string): Promise<any[]> {
    const result = await this.connection!.run(query);
    const rows = await result.getRows();
    return rows;
  }
} 