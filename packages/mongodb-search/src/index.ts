import express, { Request, Response } from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { seedData as sharedSeedData, getBenchmarkQueries } from 'shared-utils';

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const uri = 'mongodb://admin:mongo123@mongodb:27017/fulltext_db?authSource=admin';
const client = new MongoClient(uri);

let db: any;
let collection: any;

const connectMongoDB = async () => {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    db = client.db('fulltext_db');
    collection = db.collection('articles');
    
    await collection.createIndex({
      title: 'text',
      content: 'text',
      author: 'text'
    });
    console.log('Text index created');
    
    await seedData();
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

const seedData = async () => {
  console.log('Seeding MongoDB with 100k articles...');
  const articles = sharedSeedData;

  await collection.deleteMany({});
  await collection.insertMany(articles);
  console.log(`Seeded ${articles.length} articles to MongoDB`);
};

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', database: 'MongoDB' });
});

app.get('/search', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const results = await collection.find(
      { $text: { $search: q as string } },
      { score: { $meta: 'textScore' } }
    )
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

app.get('/search-regex', async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const start = Date.now();
    const regex = new RegExp(q as string, 'i');
    const results = await collection
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

app.get('/benchmark', async (req: Request, res: Response) => {
  const queries = getBenchmarkQueries();
  const results = [];

  for (const query of queries) {
    const start = Date.now();
    const searchResults = await collection.find({ $text: { $search: query } }).toArray();
    const duration = Date.now() - start;
    
    results.push({
      query,
      resultCount: searchResults.length,
      duration: `${duration}ms`
    });
  }

  res.json({
    database: 'MongoDB',
    benchmarks: results,
    averageDuration: `${results.reduce((sum, r) => sum + parseInt(r.duration), 0) / results.length}ms`
  });
});

app.listen(port, async () => {
  console.log(`MongoDB search app running on port ${port}`);
  await connectMongoDB();
}); 