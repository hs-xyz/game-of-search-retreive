import * as duckdb from 'duckdb';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles, getBenchmarkQueries, Article } from 'shared-utils';

export class DuckDBAdapter implements DatabaseAdapter {
  public readonly name = 'DuckDB';
  private db: duckdb.Database | null = null;

  async initialize(): Promise<void> {
    console.log('Initializing DuckDB...');
    
    this.db = new duckdb.Database(':memory:');
    
    await this.createTable();
    await this.seedData();
    
    console.log('DuckDB database initialized successfully');
  }

  private async createTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(`
        CREATE TABLE articles (
          id VARCHAR PRIMARY KEY,
          title VARCHAR,
          content TEXT,
          author VARCHAR,
          tags VARCHAR,
          searchable_text VARCHAR
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async seedData(): Promise<void> {
    console.log('Seeding DuckDB with 100k articles...');
    const articles = generatedArticles;

    const insertStatement = `
      INSERT INTO articles (id, title, content, author, tags, searchable_text) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const batchSize = 1000;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      await new Promise<void>((resolve, reject) => {
        this.db!.serialize(() => {
          this.db!.run('BEGIN TRANSACTION');
          
          const stmt = this.db!.prepare(insertStatement);
          
          for (const article of batch) {
            const searchableText = `${article.title} ${article.content} ${article.author}`;
            stmt.run([
              article.id,
              article.title,
              article.content,
              article.author,
              article.tags.join(','),
              searchableText
            ]);
          }
          
          stmt.finalize();
          this.db!.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      if ((i + batch.length) % 10000 === 0) {
        console.log(`Seeded ${i + batch.length} articles...`);
      }
    }

    console.log(`Successfully seeded ${articles.length} articles to DuckDB`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number; }> {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    let whereClause = searchTerms.map(term => 
      `(LOWER(searchable_text) LIKE '%${term.replace(/'/g, "''")}%')`
    ).join(' AND ');

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM articles 
      WHERE ${whereClause}
    `;

    const searchQuery = `
      SELECT id, title, content, author, tags,
             CASE 
               WHEN LOWER(title) LIKE '%${query.toLowerCase().replace(/'/g, "''")}%' THEN 3
               WHEN LOWER(author) LIKE '%${query.toLowerCase().replace(/'/g, "''")}%' THEN 2
               ELSE 1
             END as relevance_score
      FROM articles 
      WHERE ${whereClause}
      ORDER BY relevance_score DESC, 
               LENGTH(title) ASC,
               id ASC
      LIMIT ${limit}
    `;

    const [total, results] = await Promise.all([
      this.executeQuery(countQuery),
      this.executeQuery(searchQuery)
    ]);

    return {
      results: results.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author,
        tags: row.tags ? row.tags.split(',') : [],
        relevance_score: row.relevance_score
      })),
      total: total[0]?.total || 0
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const countQuery = 'SELECT COUNT(*) as total FROM articles';
    const selectQuery = `
      SELECT id, title, content, author, tags
      FROM articles 
      ORDER BY id 
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [totalResult, results] = await Promise.all([
      this.executeQuery(countQuery),
      this.executeQuery(selectQuery)
    ]);

    return {
      results: results.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author,
        tags: row.tags ? row.tags.split(',') : []
      })),
      total: totalResult[0]?.total || 0,
      offset,
      limit
    };
  }

  async benchmark(queries: string[]): Promise<{ benchmarks: any[]; averageDuration: string }> {
    const benchmarkQueries = getBenchmarkQueries();
    const results: Array<{ query: string; resultCount: number; duration: string }> = [];

    for (const query of benchmarkQueries) {
      const start = Date.now();
      const result = await this.search(query, 50000);
      const duration = Date.now() - start;
      
      results.push({
        query,
        resultCount: result.total,
        duration: `${duration}ms`
      });
    }

    return {
      benchmarks: results,
      averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
    };
  }

  private async executeQuery(query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db!.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
} 