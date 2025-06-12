import express, { Request, Response } from 'express';
import cors from 'cors';
import { createClient, SchemaFieldTypes } from 'redis';
import { getRedisData, getBenchmarkQueries } from 'shared-utils';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const client = createClient({
  url: 'redis://redis-stack:6379',
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
      title: {
        type: SchemaFieldTypes.TEXT
      },
      content: {
        type: SchemaFieldTypes.TEXT
      },
      author: {
        type: SchemaFieldTypes.TEXT
      },
      tags: {
        type: SchemaFieldTypes.TAG
      }
    }, {
      ON: 'HASH',
      PREFIX: 'article:'
    });
  } catch (error: any) {
    if (error?.message?.includes('Index already exists')) {
      console.log('Index already exists, continuing...');
    } else {
      console.log('Index creation error:', error?.message || error);
    }
  }
};

const seedData = async () => {
  console.log('Seeding Redis with 100k articles...');
  const articles = getRedisData();

  for (const article of articles) {
    await client.hSet(`article:${article.id}`, {
      id: article.id,
      title: article.title,
      content: article.content,
      author: article.author,
      tags: article.tags
    });
  }
  console.log(`Seeded ${articles.length} articles to Redis`);
};

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', database: 'Redis Stack' });
});

app.get('/search', async (req: Request, res: Response) => {
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
        id: doc.id.replace('article:', ''),
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

app.get('/benchmark', async (req: Request, res: Response) => {
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

app.listen(port, async () => {
  console.log(`Redis search app running on port ${port}`);
  await connectRedis();
}); 