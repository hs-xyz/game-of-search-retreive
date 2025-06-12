import express, { Request, Response } from 'express';
import cors from 'cors';
import { Client } from '@elastic/elasticsearch';
import { seedData as sharedSeedData, getBenchmarkQueries } from 'shared-utils';

const app = express();
const port = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

const client = new Client({
  node: 'http://elasticsearch:9200'
});

const indexName = 'articles';

const initializeElasticsearch = async () => {
  try {
    const indexExists = await client.indices.exists({ index: indexName });
    
    if (!indexExists) {
      await client.indices.create({
        index: indexName,
        mappings: {
          properties: {
            title: { 
              type: 'text', 
              analyzer: 'english'
            },
            content: { 
              type: 'text', 
              analyzer: 'english' 
            },
            author: { 
              type: 'text',
              analyzer: 'keyword'
            },
            tags: { 
              type: 'keyword' 
            }
          }
        }
      });
    }

    await seedData();
    console.log('Elasticsearch initialized with 100k articles');
  } catch (error) {
    console.error('Elasticsearch initialization error:', error);
  }
};

const seedData = async () => {
  console.log('Seeding Elasticsearch with 100k articles...');
  const articles = sharedSeedData;

  await client.deleteByQuery({
    index: indexName,
    query: { match_all: {} }
  });

  for (const article of articles) {
    await client.index({
      index: indexName,
      id: article.id,
      document: article
    });
  }

  await client.indices.refresh({ index: indexName });
  console.log(`Seeded ${articles.length} articles to Elasticsearch`);
};

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', database: 'Elasticsearch' });
});

app.get('/search', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const result = await client.search({
      index: indexName,
      query: {
        multi_match: {
          query: q as string,
          fields: ['title^2', 'content', 'author'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      },
      size: Number(limit)
    });
    const duration = Date.now() - start;

    res.json({
      query: q,
      results: result.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source || {})
      })),
      total: result.hits.total,
      duration: `${duration}ms`,
      database: 'Elasticsearch'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/search-phrase', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const result = await client.search({
      index: indexName,
      query: {
        multi_match: {
          query: q as string,
          fields: ['title^2', 'content', 'author'],
          type: 'phrase'
        }
      },
      size: Number(limit)
    });
    const duration = Date.now() - start;

    res.json({
      query: q,
      results: result.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source || {})
      })),
      total: result.hits.total,
      duration: `${duration}ms`,
      database: 'Elasticsearch (Phrase)',
      searchType: 'phrase'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/search-bool', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const result = await client.search({
      index: indexName,
      query: {
        bool: {
          should: [
            { match: { title: { query: q as string, boost: 2 } } },
            { match: { content: q as string } },
            { match: { author: q as string } }
          ]
        }
      },
      size: Number(limit)
    });
    const duration = Date.now() - start;

    res.json({
      query: q,
      results: result.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...(hit._source || {})
      })),
      total: result.hits.total,
      duration: `${duration}ms`,
      database: 'Elasticsearch (Bool)',
      searchType: 'bool'
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
    const result = await client.search({
      index: indexName,
      query: {
        multi_match: {
          query,
          fields: ['title^2', 'content', 'author']
        }
      },
      size: 0
    });
    const duration = Date.now() - start;
    
    results.push({
      query,
      resultCount: typeof result.hits.total === 'object' ? result.hits.total.value : result.hits.total,
      duration: `${duration}ms`
    });
  }

  res.json({
    database: 'Elasticsearch',
    benchmarks: results,
    averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
  });
});

app.listen(port, async () => {
  console.log(`Elasticsearch search app running on port ${port}`);
  await initializeElasticsearch();
}); 