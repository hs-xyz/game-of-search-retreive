import express from 'express';
import cors from 'cors';
import { createClient } from 'redis';
import { getRedisData, getBenchmarkQueries } from 'shared-utils';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const client = createClient({
  url: 'redis://localhost:6379',
  password: 'redis123'
});

const connectRedis = async () => {
  try {
    await client.connect();
    console.log('Connected to Redis Stack');
    await setupIndex();
    await seedData();
  } catch (error) {
    console.error('Redis connection error:', error);
  }
};

const setupIndex = async () => {
  try {
    await client.ft.create('articles', {
      title: { type: 'TEXT', WEIGHT: 5.0 },
      content: { type: 'TEXT' },
      author: { type: 'TEXT' },
      tags: { type: 'TAG', SEPARATOR: ',' }
    }, {
      ON: 'HASH',
      PREFIX: 'article:'
    });
  } catch (error) {
    console.log('Index already exists or error creating:', error);
  }
};

const seedData = async () => {
  const articles = getRedisData();

  for (const article of articles) {
    await client.hSet(`article:${article.id}`, article);
  }
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'Redis Stack' });
});

app.get('/search', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const results = await client.ft.search('articles', q as string, {
      LIMIT: { from: 0, size: Number(limit) }
    });
    const duration = Date.now() - start;

    res.json({
      query: q,
      results: results.documents.map(doc => ({
        id: doc.id,
        ...doc.value
      })),
      total: results.total,
      duration: `${duration}ms`,
      database: 'Redis Stack'
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
    const result = await client.ft.search('articles', query);
    const duration = Date.now() - start;
    
    results.push({
      query,
      resultCount: result.total,
      duration: `${duration}ms`
    });
  }

  res.json({
    database: 'Redis Stack',
    benchmarks: results,
    averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
  });
});

app.listen(port, () => {
  console.log(`Redis search app running on port ${port}`);
  connectRedis();
}); 