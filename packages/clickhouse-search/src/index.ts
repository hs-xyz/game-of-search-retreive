import express, { Request, Response } from 'express';
import cors from 'cors';
import { createClient } from '@clickhouse/client';
import { getClickHouseData, getBenchmarkQueries } from 'shared-utils';

const app = express();
const port = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

const client = createClient({
  host: 'http://clickhouse:8123',
  username: 'admin',
  password: 'clickhouse123',
  database: 'fulltext_db'
});

const initializeClickHouse = async () => {
  try {
    await client.command({
      query: 'CREATE DATABASE IF NOT EXISTS fulltext_db'
    });

    await client.command({
      query: `
        CREATE TABLE IF NOT EXISTS articles (
          id UInt32,
          title String,
          content String,
          author String,
          tags Array(String),
          created_at DateTime DEFAULT now()
        )
        ENGINE = MergeTree()
        ORDER BY id
      `
    });

    await seedData();
    console.log('ClickHouse initialized with 100k articles');
  } catch (error) {
    console.error('ClickHouse initialization error:', error);
  }
};

const seedData = async () => {
  console.log('Seeding ClickHouse with 100k articles...');
  const articles = getClickHouseData();

  await client.command({ query: 'TRUNCATE TABLE articles' });

  for (const article of articles) {
    await client.insert({
      table: 'articles',
      values: [article],
      format: 'JSONEachRow'
    });
  }
  console.log(`Seeded ${articles.length} articles to ClickHouse`);
};

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', database: 'ClickHouse' });
});

app.get('/search', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const result = await client.query({
      query: `
        SELECT id, title, content, author, tags,
               (positionCaseInsensitive(title, {query:String}) > 0) * 3 +
               (positionCaseInsensitive(content, {query:String}) > 0) * 2 +
               (positionCaseInsensitive(author, {query:String}) > 0) * 1 as relevance_score
        FROM articles
        WHERE positionCaseInsensitive(title, {query:String}) > 0
           OR positionCaseInsensitive(content, {query:String}) > 0
           OR positionCaseInsensitive(author, {query:String}) > 0
        ORDER BY relevance_score DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { query: q, limit: Number(limit) }
    });
    const duration = Date.now() - start;

    const rows = await result.json();

    res.json({
      query: q,
      results: rows,
      duration: `${duration}ms`,
      database: 'ClickHouse'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/search-like', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const result = await client.query({
      query: `
        SELECT id, title, content, author, tags,
               (position(lower(title), lower({query:String})) > 0) * 3 +
               (position(lower(content), lower({query:String})) > 0) * 2 +
               (position(lower(author), lower({query:String})) > 0) * 1 as relevance_score
        FROM articles
        WHERE lower(title) LIKE lower(concat('%', {query:String}, '%'))
           OR lower(content) LIKE lower(concat('%', {query:String}, '%'))
           OR lower(author) LIKE lower(concat('%', {query:String}, '%'))
        ORDER BY relevance_score DESC
        LIMIT {limit:UInt32}
      `,
      query_params: { query: q, limit: Number(limit) }
    });
    const duration = Date.now() - start;

    const rows = await result.json();

    res.json({
      query: q,
      results: rows,
      duration: `${duration}ms`,
      database: 'ClickHouse (LIKE)',
      searchType: 'like'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/search-multiword', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const words = (q as string).split(' ').filter(w => w.length > 0);
    const start = Date.now();
    
    const result = await client.query({
      query: `
        SELECT id, title, content, author, tags,
               ${words.map((_, i) => `
                 (positionCaseInsensitive(title, {word${i}:String}) > 0) * 3 +
                 (positionCaseInsensitive(content, {word${i}:String}) > 0) * 2 +
                 (positionCaseInsensitive(author, {word${i}:String}) > 0) * 1
               `).join(' + ')} as relevance_score
        FROM articles
        WHERE ${words.map((_, i) => `
          (positionCaseInsensitive(title, {word${i}:String}) > 0 OR
           positionCaseInsensitive(content, {word${i}:String}) > 0 OR
           positionCaseInsensitive(author, {word${i}:String}) > 0)
        `).join(' AND ')}
        ORDER BY relevance_score DESC
        LIMIT {limit:UInt32}
      `,
      query_params: {
        ...Object.fromEntries(words.map((word, i) => [`word${i}`, word])),
        limit: Number(limit)
      }
    });
    const duration = Date.now() - start;

    const rows = await result.json();

    res.json({
      query: q,
      results: rows,
      duration: `${duration}ms`,
      database: 'ClickHouse (Multi-word)',
      searchType: 'multiword'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/benchmark', async (req: Request, res: Response) => {
  const queries = getBenchmarkQueries();
  const results = [];

  for (const query of queries) {
    const start = Date.now();
    const result = await client.query({
      query: `
        SELECT count(*) as count
        FROM articles
        WHERE positionCaseInsensitive(title, {query:String}) > 0
           OR positionCaseInsensitive(content, {query:String}) > 0
           OR positionCaseInsensitive(author, {query:String}) > 0
      `,
      query_params: { query }
    });
    const duration = Date.now() - start;
    
    const rows = await result.json();
    const rowsArray = Array.isArray(rows) ? rows : [rows];
    
    results.push({
      query,
      resultCount: rowsArray[0]?.count || 0,
      duration: `${duration}ms`
    });
  }

  res.json({
    database: 'ClickHouse',
    benchmarks: results,
    averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
  });
});

app.listen(port, async () => {
  console.log(`ClickHouse search app running on port ${port}`);
  await initializeClickHouse();
}); 