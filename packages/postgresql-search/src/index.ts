import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { seedData as sharedSeedData, getBenchmarkQueries } from 'shared-utils';

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fulltext_db',
  user: 'postgres',
  password: 'postgres123',
});

const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        tags TEXT[],
        search_vector TSVECTOR
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS articles_search_idx 
      ON articles USING GIN(search_vector)
    `);

    await seedData();
    console.log('PostgreSQL database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

const seedData = async () => {
  const articles = sharedSeedData;

  await pool.query('DELETE FROM articles');

  for (const article of articles) {
    await pool.query(`
      INSERT INTO articles (title, content, author, tags, search_vector)
      VALUES ($1, $2, $3, $4, 
        setweight(to_tsvector('english', $1), 'A') ||
        setweight(to_tsvector('english', $2), 'B') ||
        setweight(to_tsvector('english', $3), 'C')
      )
    `, [article.title, article.content, article.author, article.tags]);
  }
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'PostgreSQL' });
});

app.get('/search', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const result = await pool.query(`
      SELECT id, title, content, author, tags,
             ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
      FROM articles
      WHERE search_vector @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2
    `, [q, limit]);
    const duration = Date.now() - start;

    res.json({
      query: q,
      results: result.rows,
      total: result.rows.length,
      duration: `${duration}ms`,
      database: 'PostgreSQL'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/search-phrase', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const result = await pool.query(`
      SELECT id, title, content, author, tags,
             ts_rank(search_vector, phraseto_tsquery('english', $1)) as rank
      FROM articles
      WHERE search_vector @@ phraseto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2
    `, [q, limit]);
    const duration = Date.now() - start;

    res.json({
      query: q,
      results: result.rows,
      total: result.rows.length,
      duration: `${duration}ms`,
      database: 'PostgreSQL (Phrase)',
      searchType: 'phrase'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/search-ilike', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const result = await pool.query(`
      SELECT id, title, content, author, tags
      FROM articles
      WHERE title ILIKE $1 OR content ILIKE $1 OR author ILIKE $1
      LIMIT $2
    `, [`%${q}%`, limit]);
    const duration = Date.now() - start;

    res.json({
      query: q,
      results: result.rows,
      total: result.rows.length,
      duration: `${duration}ms`,
      database: 'PostgreSQL (ILIKE)',
      searchType: 'ilike'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/benchmark', async (req, res) => {
  const queries = getBenchmarkQueries();
  const results = [];

  for (const query of queries) {
    const start = Date.now();
    const result = await pool.query(`
      SELECT COUNT(*)
      FROM articles
      WHERE search_vector @@ plainto_tsquery('english', $1)
    `, [query]);
    const duration = Date.now() - start;
    
    results.push({
      query,
      resultCount: parseInt(result.rows[0].count),
      duration: `${duration}ms`
    });
  }

  res.json({
    database: 'PostgreSQL',
    benchmarks: results,
    averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
  });
});

app.listen(port, () => {
  console.log(`PostgreSQL search app running on port ${port}`);
  initializeDatabase();
}); 