import { Pool } from 'pg';
import { DatabaseAdapter } from 'search-framework';
import { seedData as generatedArticles } from 'shared-utils';

export class PostgreSQLAdapter implements DatabaseAdapter {
  public readonly name = 'PostgreSQL';
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: 'postgres',
      host: 'postgresql',
      database: 'fulltext_db',
      password: 'postgres123',
      port: 5432,
    });
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        tags TEXT[]
      )
    `);

    await this.pool.query(`
      ALTER TABLE articles ADD COLUMN IF NOT EXISTS ts_vector TSVECTOR
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS articles_ts_vector_idx ON articles USING GIN (ts_vector)
    `);

    await this.seedData();
    console.log('PostgreSQL database initialized with 100k articles');
  }

  private async seedData(): Promise<void> {
    console.log('Seeding PostgreSQL with 100k articles...');
    const articles = generatedArticles;

    await this.pool.query('DELETE FROM articles');

    for (const article of articles) {
      await this.pool.query(
        'INSERT INTO articles (id, title, content, author, tags) VALUES ($1, $2, $3, $4, $5)',
        [parseInt(article.id), article.title, article.content, article.author, article.tags]
      );
    }

    await this.pool.query(`
      UPDATE articles SET ts_vector = to_tsvector('english', title || ' ' || content || ' ' || author || ' ' || array_to_string(tags, ' '))
    `);

    console.log(`Seeded ${articles.length} articles to PostgreSQL`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    const countResult = await this.pool.query(`
      SELECT COUNT(*) as total
      FROM articles 
      WHERE ts_vector @@ plainto_tsquery('english', $1)
    `, [query]);
    
    const totalCount = parseInt(countResult.rows[0].total);
    
    const result = await this.pool.query(`
      SELECT id, title, content, author, tags,
             ts_rank(ts_vector, plainto_tsquery('english', $1)) as rank
      FROM articles 
      WHERE ts_vector @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2
    `, [query, limit]);

    return {
      results: result.rows,
      total: totalCount
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const countResult = await this.pool.query('SELECT COUNT(*) as count FROM articles');
    const total = parseInt(countResult.rows[0].count);
    
    const result = await this.pool.query(`
      SELECT id, title, content, author, tags 
      FROM articles 
      ORDER BY id 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return {
      results: result.rows.map(row => ({
        ...row,
        tags: row.tags || []
      })),
      total,
      offset,
      limit
    };
  }

  public searchVariants = {
    phrase: async (query: string, limit: number) => {
      const result = await this.pool.query(`
        SELECT id, title, content, author, tags,
               ts_rank(ts_vector, phraseto_tsquery('english', $1)) as relevance_score
        FROM articles 
        WHERE ts_vector @@ phraseto_tsquery('english', $1)
        ORDER BY relevance_score DESC
        LIMIT $2
      `, [query, limit]);

      const countResult = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM articles 
        WHERE ts_vector @@ phraseto_tsquery('english', $1)
      `, [query]);

      return {
        results: result.rows.map(row => ({
          ...row,
          tags: row.tags || [],
          relevance_score: parseFloat(row.relevance_score)
        })),
        total: parseInt(countResult.rows[0].count)
      };
    },

    ilike: async (query: string, limit: number) => {
      const countResult = await this.pool.query(`
        SELECT COUNT(*) as total
        FROM articles
        WHERE title ILIKE $1 OR content ILIKE $1 OR author ILIKE $1
      `, [`%${query}%`]);
      
      const totalCount = parseInt(countResult.rows[0].total);
      
      const result = await this.pool.query(`
        SELECT id, title, content, author, tags
        FROM articles
        WHERE title ILIKE $1 OR content ILIKE $1 OR author ILIKE $1
        LIMIT $2
      `, [`%${query}%`, limit]);

      return {
        results: result.rows,
        total: totalCount
      };
    }
  };
} 