import express from 'express';
import cors from 'cors';
import { Level } from 'level';
import { seedData as sharedSeedData, getBenchmarkQueries } from 'shared-utils';

const app = express();
const port = process.env.PORT || 3006;

app.use(cors());
app.use(express.json());

const db = new Level('./data', { valueEncoding: 'json' });

const initializeLevelDB = async () => {
  try {
    await seedData();
    console.log('LevelDB initialized');
  } catch (error) {
    console.error('LevelDB initialization error:', error);
  }
};

const seedData = async () => {
  const articles = sharedSeedData;

  for (const article of articles) {
    await db.put(`article:${article.id}`, article);
  }
};

const search = async (query: string, limit = 10) => {
  const results = [];
  const searchTerms = query.toLowerCase().split(' ');
  
  for await (const [key, value] of db.iterator()) {
    if (key.startsWith('article:')) {
      const article = value as any;
      let relevanceScore = 0;

      for (const term of searchTerms) {
        if (article.title.toLowerCase().includes(term)) relevanceScore += 3;
        if (article.content.toLowerCase().includes(term)) relevanceScore += 2;
        if (article.author.toLowerCase().includes(term)) relevanceScore += 1;
        if (article.tags.some((tag: string) => tag.toLowerCase().includes(term))) relevanceScore += 1;
      }

      if (relevanceScore > 0) {
        results.push({ ...article, relevance_score: relevanceScore });
      }
    }
  }

  return results
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'LevelDB' });
});

app.get('/search', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const results = await search(q as string, Number(limit));
    const duration = Date.now() - start;

    res.json({
      query: q,
      results,
      total: results.length,
      duration: `${duration}ms`,
      database: 'LevelDB'
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
    const searchResults = await search(query);
    const duration = Date.now() - start;
    
    results.push({
      query,
      resultCount: searchResults.length,
      duration: `${duration}ms`
    });
  }

  res.json({
    database: 'LevelDB',
    benchmarks: results,
    averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
  });
});

app.listen(port, () => {
  console.log(`LevelDB search app running on port ${port}`);
  initializeLevelDB();
}); 