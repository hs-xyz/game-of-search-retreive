import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const databases = [
  { name: 'Redis Stack', url: 'http://localhost:3001', port: 3001 },
  { name: 'MongoDB', url: 'http://localhost:3002', port: 3002 },
  { name: 'PostgreSQL', url: 'http://localhost:3003', port: 3003 },
  { name: 'Elasticsearch', url: 'http://localhost:3004', port: 3004 },
  { name: 'ClickHouse', url: 'http://localhost:3005', port: 3005 },
  { name: 'LevelDB', url: 'http://localhost:3006', port: 3006 }
];

const makeRequest = async (url: string, timeout = 5000) => {
  try {
    const response = await axios.get(url, { timeout });
    return response.data;
  } catch (error: any) {
    return { error: `Failed to connect: ${error.message}` };
  }
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Full Text Search Database Comparison</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; margin-bottom: 30px; }
            .search-section { margin: 30px 0; }
            .search-box { width: 100%; padding: 15px; font-size: 16px; border: 2px solid #ddd; border-radius: 8px; margin-bottom: 20px; }
            .button-group { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
            button { padding: 12px 24px; font-size: 14px; border: none; border-radius: 6px; cursor: pointer; background: #007bff; color: white; transition: background 0.3s; }
            button:hover { background: #0056b3; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            .results { margin-top: 30px; }
            .database-result { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #fafafa; }
            .database-name { font-weight: bold; font-size: 18px; color: #333; margin-bottom: 10px; }
            .metadata { color: #666; font-size: 12px; margin-bottom: 15px; }
            .error { color: #dc3545; font-style: italic; }
            .loading { color: #007bff; font-style: italic; }
            .article { margin: 10px 0; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #007bff; }
            .article-title { font-weight: bold; color: #333; }
            .article-content { color: #666; margin: 5px 0; }
            .article-meta { font-size: 12px; color: #999; }
            .health-status { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .health-item { padding: 10px 15px; border-radius: 6px; font-size: 14px; }
            .healthy { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .unhealthy { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .benchmark-section { margin: 30px 0; }
            .benchmark-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔍 Full Text Search Database Comparison</h1>
            
            <div class="health-status" id="healthStatus">
                <div>Checking database health...</div>
            </div>

            <div class="search-section">
                <input type="text" id="searchQuery" class="search-box" placeholder="Enter your search query..." value="machine learning">
                <div class="button-group">
                    <button onclick="searchAll()">🔍 Search All Databases</button>
                    <button onclick="runBenchmarks()">⚡ Run Benchmarks</button>
                    <button onclick="checkHealth()">💊 Check Health</button>
                </div>
            </div>

            <div class="results" id="results"></div>
            <div class="benchmark-section" id="benchmarks"></div>
        </div>

        <script>
            const databases = ${JSON.stringify(databases)};
            
            async function makeRequest(url) {
                try {
                    const response = await fetch(url);
                    return await response.json();
                } catch (error) {
                    return { error: 'Connection failed: ' + error.message };
                }
            }

            async function checkHealth() {
                const healthDiv = document.getElementById('healthStatus');
                healthDiv.innerHTML = 'Checking health...';
                
                const healthResults = await Promise.all(
                    databases.map(async db => {
                        const result = await makeRequest(db.url + '/health');
                        return { name: db.name, ...result };
                    })
                );

                healthDiv.innerHTML = healthResults.map(result => 
                    '<div class="health-item ' + (result.error ? 'unhealthy' : 'healthy') + '">' +
                    result.name + ': ' + (result.error || result.status) + '</div>'
                ).join('');
            }

            async function searchAll() {
                const query = document.getElementById('searchQuery').value;
                if (!query.trim()) return;

                const resultsDiv = document.getElementById('results');
                resultsDiv.innerHTML = '<div class="loading">Searching all databases...</div>';

                const results = await Promise.all(
                    databases.map(async db => {
                        const result = await makeRequest(db.url + '/search?q=' + encodeURIComponent(query));
                        return { name: db.name, ...result };
                    })
                );

                resultsDiv.innerHTML = results.map(result => 
                    '<div class="database-result">' +
                    '<div class="database-name">' + result.name + '</div>' +
                    '<div class="metadata">Results: ' + (result.total || 0) + ' | Duration: ' + (result.duration || 'N/A') + '</div>' +
                    (result.error ? 
                        '<div class="error">Error: ' + result.error + '</div>' :
                        (result.results || []).map(article => 
                            '<div class="article">' +
                            '<div class="article-title">' + (article.title || 'No title') + '</div>' +
                            '<div class="article-content">' + (article.content || '').substring(0, 150) + '...</div>' +
                            '<div class="article-meta">Author: ' + (article.author || 'Unknown') + 
                            (article.relevance_score ? ' | Score: ' + article.relevance_score : '') +
                            (article.score ? ' | Score: ' + article.score : '') + '</div>' +
                            '</div>'
                        ).join('')
                    ) +
                    '</div>'
                ).join('');
            }

            async function runBenchmarks() {
                const benchmarkDiv = document.getElementById('benchmarks');
                benchmarkDiv.innerHTML = '<div class="loading">Running benchmarks...</div>';

                const results = await Promise.all(
                    databases.map(async db => {
                        const result = await makeRequest(db.url + '/benchmark');
                        return { name: db.name, ...result };
                    })
                );

                benchmarkDiv.innerHTML = '<h2>Benchmark Results</h2><div class="benchmark-grid">' +
                    results.map(result => 
                        '<div class="database-result">' +
                        '<div class="database-name">' + result.name + '</div>' +
                        '<div class="metadata">Average Duration: ' + (result.averageDuration || 'N/A') + '</div>' +
                        (result.error ? 
                            '<div class="error">Error: ' + result.error + '</div>' :
                            (result.benchmarks || []).map(bench => 
                                '<div style="margin: 5px 0; padding: 8px; background: white; border-radius: 4px;">' +
                                'Query: "' + bench.query + '" | Results: ' + bench.resultCount + ' | Time: ' + bench.duration +
                                '</div>'
                            ).join('')
                        ) +
                        '</div>'
                    ).join('') + '</div>';
            }

            // Initialize
            checkHealth();
        </script>
    </body>
    </html>
  `);
});

app.get('/health', async (req, res) => {
  const healthChecks = await Promise.all(
    databases.map(async (db) => ({
      name: db.name,
      url: db.url,
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
      ...(await makeRequest(`${db.url}/benchmark`))
    }))
  );

  res.json({
    benchmarks: benchmarkResults,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Comparison dashboard running on port ${port}`);
  console.log(`Open http://localhost:${port} to view the dashboard`);
}); 