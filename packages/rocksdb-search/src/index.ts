import express from 'express';
import cors from 'cors';
import RocksDB from 'rocksdb';
import { seedData as sharedSeedData, getBenchmarkQueries } from 'shared-utils';
import path from 'path';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, '../data/rocksdb');
const db = new RocksDB(dbPath);

const initializeRocksDB = async () => {
  try {
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    await new Promise<void>((resolve, reject) => {
      db.open((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await seedData();
    console.log('RocksDB initialized');
  } catch (error) {
    console.error('RocksDB initialization error:', error);
  }
};

const seedData = async () => {
  const articles = sharedSeedData;

  for (const article of articles) {
    await new Promise<void>((resolve, reject) => {
      db.put(`article:${article.id}`, JSON.stringify(article), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

const search = async (query: string, limit = 10) => {
  const results = [];
  const searchTerms = query.toLowerCase().split(' ');
  
  return new Promise<any[]>((resolve, reject) => {
    const iterator = db.iterator();
    const processNext = () => {
      iterator.next((err, key, value) => {
        if (err) {
          iterator.end(() => reject(err));
          return;
        }

        if (key === undefined) {
          iterator.end(() => {
            const sortedResults = results
              .sort((a, b) => b.relevance_score - a.relevance_score)
              .slice(0, limit);
            resolve(sortedResults);
          });
          return;
        }

        if (key.toString().startsWith('article:')) {
          try {
            const article = JSON.parse(value.toString());
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
          } catch (parseError) {
            console.error('Error parsing article:', parseError);
          }
        }

        processNext();
      });
    };

    processNext();
  });
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'RocksDB' });
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
      database: 'RocksDB'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/search-prefix', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const results = [];
    const queryLower = (q as string).toLowerCase();
    
    await new Promise<void>((resolve, reject) => {
      const iterator = db.iterator();
      const processNext = () => {
        iterator.next((err, key, value) => {
          if (err) {
            iterator.end(() => reject(err));
            return;
          }

          if (key === undefined) {
            iterator.end(() => resolve());
            return;
          }

          if (key.toString().startsWith('article:')) {
            try {
              const article = JSON.parse(value.toString());
              let score = 0;
              
              if (article.title.toLowerCase().startsWith(queryLower)) score += 5;
              if (article.content.toLowerCase().startsWith(queryLower)) score += 3;
              if (article.author.toLowerCase().startsWith(queryLower)) score += 2;
              
              if (score > 0) {
                results.push({ ...article, relevance_score: score });
              }
            } catch (parseError) {
              console.error('Error parsing article:', parseError);
            }
          }

          processNext();
        });
      };

      processNext();
    });

    const duration = Date.now() - start;
    const sortedResults = results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, Number(limit));

    res.json({
      query: q,
      results: sortedResults,
      total: sortedResults.length,
      duration: `${duration}ms`,
      database: 'RocksDB (Prefix)',
      searchType: 'prefix'
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
    database: 'RocksDB',
    benchmarks: results,
    averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
  });
});

app.listen(port, () => {
  console.log(`RocksDB search app running on port ${port}`);
  initializeRocksDB();
}); 