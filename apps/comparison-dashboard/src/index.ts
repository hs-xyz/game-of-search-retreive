import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

const databases = [
  { name: 'Redis Stack', url: 'http://localhost:3001', port: 3001, color: '#DC382D' },
  { name: 'MongoDB', url: 'http://localhost:3002', port: 3002, color: '#47A248' },
  { name: 'PostgreSQL', url: 'http://localhost:3003', port: 3003, color: '#336791' },
  { name: 'Elasticsearch', url: 'http://localhost:3004', port: 3004, color: '#005571' },
  { name: 'ClickHouse', url: 'http://localhost:3005', port: 3005, color: '#FFCC02' },
  { name: 'DuckDB', url: 'http://localhost:3006', port: 3006, color: '#FFF000' }
];

const makeRequest = async (url: string, timeout = 10000) => {
  try {
    const response = await axios.get(url, { timeout });
    return response.data;
  } catch (error: any) {
    return { error: `Failed to connect: ${error.message}` };
  }
};

// API Routes
app.get('/api/config', (req, res) => {
  res.json(databases);
});

app.get('/health', async (req, res) => {
  const healthChecks = await Promise.all(
    databases.map(async (db) => ({
      name: db.name,
      url: db.url,
      color: db.color,
      ...(await makeRequest(`${db.url}/health`))
    }))
  );

  res.json({
    status: 'healthy',
    databases: healthChecks,
    timestamp: new Date().toISOString()
  });
});

app.get('/search-all', async (req, res) => {
  const { q, limit = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const searchResults = await Promise.all(
    databases.map(async (db) => ({
      database: db.name,
      url: db.url,
      color: db.color,
      ...(await makeRequest(`${db.url}/search?q=${encodeURIComponent(q as string)}&limit=${limit}`))
    }))
  );

  res.json({
    query: q,
    results: searchResults,
    timestamp: new Date().toISOString()
  });
});

app.get('/benchmark-all', async (req, res) => {
  const benchmarkResults = await Promise.all(
    databases.map(async (db) => ({
      database: db.name,
      url: db.url,
      color: db.color,
      ...(await makeRequest(`${db.url}/benchmark`))
    }))
  );

  res.json({
    benchmarks: benchmarkResults,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/enhanced-benchmark', async (req, res) => {
  const results = await Promise.all(
    databases.map(async (db) => {
      const benchmarkData = await makeRequest(`${db.url}/benchmark`);
      
      const categoryMetrics: { [key: string]: number[] } = {};
      if (benchmarkData.benchmarks) {
        benchmarkData.benchmarks.forEach((bench: any) => {
          if (!categoryMetrics[bench.category]) {
            categoryMetrics[bench.category] = [];
          }
          categoryMetrics[bench.category].push(parseInt(bench.averageDuration.replace('ms', '')));
        });
      }

      const categoryAverages: { [key: string]: number } = Object.entries(categoryMetrics).reduce((acc, [category, times]) => {
        acc[category] = Math.round((times as number[]).reduce((a, b) => a + b, 0) / times.length);
        return acc;
      }, {} as { [key: string]: number });

      return {
        database: db.name,
        color: db.color,
        ...benchmarkData,
        categoryAverages
      };
    })
  );

  res.json({
    results,
    timestamp: new Date().toISOString(),
    summary: {
      totalDatabases: databases.length,
      categoriesTested: results[0]?.categoryAverages ? Object.keys(results[0].categoryAverages).length : 0,
      avgResponseTime: Math.round(
        results.reduce((sum, r) => sum + parseInt(r.averageDuration?.replace('ms', '') || '0'), 0) / results.length
      )
    }
  });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, () => {
  console.log(`Enhanced comparison dashboard running on port ${port}`);
  console.log(`Open http://localhost:${port} to view the dashboard`);
  console.log(`Features: Interactive charts, category analysis, real-time benchmarks`);
  console.log(`Static files served from: ${path.join(__dirname, '../public')}`);
}); 