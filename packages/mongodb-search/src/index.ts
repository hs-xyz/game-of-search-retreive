import express from 'express';
import cors from 'cors';
import { MongoClient, Db, Collection } from 'mongodb';
import { seedData as sharedSeedData, getBenchmarkQueries } from 'shared-utils';

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const uri = 'mongodb://admin:mongo123@localhost:27017';
let db: Db;
let articlesCollection: Collection;

const connectMongoDB = async () => {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB');
    
    db = client.db('fulltext_db');
    articlesCollection = db.collection('articles');
    
    await setupIndexes();
    await seedData();
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

const setupIndexes = async () => {
  try {
    await articlesCollection.createIndex({ 
      title: 'text', 
      content: 'text', 
      author: 'text' 
    }, {
      weights: { title: 10, content: 5, author: 1 }
    });
    console.log('Text index created');
  } catch (error) {
    console.log('Index already exists or error creating:', error);
  }
};

const seedData = async () => {
  const articles = sharedSeedData;

  await articlesCollection.deleteMany({});
  await articlesCollection.insertMany(articles);
};

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'MongoDB' });
});

app.get('/search', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const results = await articlesCollection
      .find({ $text: { $search: q as string } })
      .project({ score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(Number(limit))
      .toArray();
    const duration = Date.now() - start;

    res.json({
      query: q,
      results,
      total: results.length,
      duration: `${duration}ms`,
      database: 'MongoDB'
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: error });
  }
});

app.get('/search-regex', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const regex = new RegExp(q as string, 'i');
    const results = await articlesCollection
      .find({
        $or: [
          { title: regex },
          { content: regex },
          { author: regex }
        ]
      })
      .limit(Number(limit))
      .toArray();
    const duration = Date.now() - start;

    res.json({
      query: q,
      results,
      total: results.length,
      duration: `${duration}ms`,
      database: 'MongoDB (Regex)',
      searchType: 'regex'
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
    const result = await articlesCollection
      .find({ $text: { $search: query } })
      .toArray();
    const duration = Date.now() - start;
    
    results.push({
      query,
      resultCount: result.length,
      duration: `${duration}ms`
    });
  }

  res.json({
    database: 'MongoDB',
    benchmarks: results,
    averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
  });
});

app.listen(port, () => {
  console.log(`MongoDB search app running on port ${port}`);
  connectMongoDB();
}); 