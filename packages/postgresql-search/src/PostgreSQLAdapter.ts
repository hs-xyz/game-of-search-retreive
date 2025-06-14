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
        tags TEXT[],
        difficulty VARCHAR(20),
        type VARCHAR(20),
        read_time INTEGER,
        publish_date DATE,
        views INTEGER,
        rating DECIMAL(3,1)
      )
    `);

    await this.pool.query(`
      ALTER TABLE articles ADD COLUMN IF NOT EXISTS ts_vector TSVECTOR
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS articles_ts_vector_idx ON articles USING GIN (ts_vector)
    `);

    await this.seedData();
    console.log('PostgreSQL database initialized with 1M articles');
  }

  private async seedData(): Promise<void> {
    console.log('Seeding PostgreSQL with 1M articles...');
    const articles = generatedArticles;

    await this.pool.query('DELETE FROM articles');

    const batchSize = 1000;
    let processed = 0;

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      const values = batch.map((_, index) => {
        const paramIndex = index * 8;
        return `(${batch[index].id}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`;
      }).join(',');

      const params = batch.flatMap(article => [
        article.title,
        article.content,
        article.author,
        article.tags,
        (article as any).difficulty || 'beginner',
        (article as any).type || 'article',
        (article as any).readTime || 5,
        (article as any).publishDate || '2023-01-01'
      ]);

      const query = `INSERT INTO articles (id, title, content, author, tags, difficulty, type, read_time, publish_date) VALUES ${values}`;
      
      await this.pool.query(query, params);

      processed += batch.length;
      if (processed % 50000 === 0) {
        console.log(`Seeded ${processed} articles...`);
      }
    }

    console.log('Building full-text search vectors...');
    await this.pool.query(`
      UPDATE articles SET ts_vector = to_tsvector('english', title || ' ' || content || ' ' || author || ' ' || array_to_string(tags, ' '))
    `);

    console.log(`Successfully seeded ${articles.length} articles to PostgreSQL`);
  }

  async search(query: string, limit: number): Promise<{ results: any[]; total: number }> {
    const effectiveLimit = Math.min(limit, 100);
    
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
    `, [query, effectiveLimit]);

    return {
      results: result.rows,
      total: totalCount
    };
  }

  async getAllRecords(limit: number, offset: number): Promise<{ results: any[]; total: number; offset: number; limit: number }> {
    const effectiveLimit = Math.min(limit, 100);
    const total = await this.getFastCount();

    const result = await this.pool.query(`
      SELECT id, title, content, author, tags, difficulty, type, read_time, publish_date, views, rating
      FROM articles 
      ORDER BY id 
      LIMIT $1 OFFSET $2
    `, [effectiveLimit, offset]);

    return {
      results: result.rows.map(row => ({
        ...row,
        tags: row.tags || [],
        readTime: row.read_time,
        publishDate: row.publish_date
      })),
      total,
      offset,
      limit: effectiveLimit
    };
  }

  private async getFastCount(): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT n_live_tup as count 
        FROM pg_stat_user_tables 
        WHERE relname = 'articles'
      `);
      
      if (result.rows[0]?.count > 0) {
        return parseInt(result.rows[0].count);
      }
    } catch (error) {
      console.warn('Fast count failed, falling back to estimate:', error);
    }
    
    try {
      const result = await this.pool.query(`
        SELECT 
          CASE 
            WHEN relpages > 0 THEN 
              (reltuples/relpages) * (
                pg_relation_size('articles') / 
                (current_setting('block_size')::integer)
              )
            ELSE reltuples
          END::bigint as estimated_count
        FROM pg_class 
        WHERE relname = 'articles'
      `);
      
      if (result.rows[0]?.estimated_count > 0) {
        return parseInt(result.rows[0].estimated_count);
      }
    } catch (error) {
      console.warn('Estimated count failed, falling back to exact count:', error);
    }
    
    const result = await this.pool.query('SELECT COUNT(*) as count FROM articles');
    return parseInt(result.rows[0].count);
  }

  public searchVariants = {
    phrase: async (query: string, limit: number) => {
      const effectiveLimit = Math.min(limit, 100);
      const result = await this.pool.query(`
        SELECT id, title, content, author, tags,
               ts_rank(ts_vector, phraseto_tsquery('english', $1)) as relevance_score
        FROM articles 
        WHERE ts_vector @@ phraseto_tsquery('english', $1)
        ORDER BY relevance_score DESC
        LIMIT $2
      `, [query, effectiveLimit]);

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
      const effectiveLimit = Math.min(limit, 100);
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
      `, [`%${query}%`, effectiveLimit]);

      return {
        results: result.rows,
        total: totalCount
      };
    }
  };
} 