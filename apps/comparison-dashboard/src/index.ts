import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Full Text Search Database Comparison</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #333;
                line-height: 1.6;
            }
            .container { 
                max-width: 1400px; 
                margin: 0 auto; 
                background: white; 
                min-height: 100vh;
                box-shadow: 0 0 50px rgba(0,0,0,0.1);
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 2rem;
                text-align: center;
            }
            .header h1 { 
                font-size: 2.5rem; 
                margin-bottom: 0.5rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .header p { 
                font-size: 1.1rem; 
                opacity: 0.9;
            }
            .nav-tabs {
                display: flex;
                background: #f8f9fa;
                border-bottom: 2px solid #e9ecef;
                overflow-x: auto;
            }
            .nav-tab {
                padding: 1rem 2rem;
                cursor: pointer;
                border: none;
                background: none;
                font-size: 1rem;
                font-weight: 500;
                white-space: nowrap;
                transition: all 0.3s ease;
                border-bottom: 3px solid transparent;
            }
            .nav-tab:hover {
                background: #e9ecef;
            }
            .nav-tab.active {
                background: white;
                border-bottom-color: #667eea;
                color: #667eea;
            }
            .tab-content {
                display: none;
                padding: 2rem;
            }
            .tab-content.active {
                display: block;
            }
            .health-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .health-card {
                background: white;
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                border: 1px solid #e9ecef;
                transition: transform 0.3s ease;
            }
            .health-card:hover {
                transform: translateY(-2px);
            }
            .health-card.healthy {
                border-left: 4px solid #28a745;
            }
            .health-card.unhealthy {
                border-left: 4px solid #dc3545;
            }
            .search-section {
                background: #f8f9fa;
                padding: 2rem;
                border-radius: 12px;
                margin-bottom: 2rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .search-box {
                width: 100%;
                padding: 1rem;
                font-size: 1.1rem;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                margin-bottom: 1rem;
                transition: border-color 0.3s ease;
            }
            .search-box:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            .button-group {
                display: flex;
                gap: 1rem;
                flex-wrap: wrap;
                margin-bottom: 1rem;
            }
            .btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 1rem;
                font-weight: 500;
                transition: all 0.3s ease;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
            }
            .btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            .btn-secondary:hover {
                background: #5a6268;
                transform: translateY(-1px);
            }
            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
            }
            .chart-container {
                background: white;
                border-radius: 12px;
                padding: 2rem;
                margin-bottom: 2rem;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .chart-title {
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 1rem;
                color: #333;
            }
            .results-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 1.5rem;
                margin-top: 2rem;
            }
            .database-card {
                background: white;
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                border: 1px solid #e9ecef;
            }
            .database-name {
                font-size: 1.25rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .database-indicator {
                width: 12px;
                height: 12px;
                border-radius: 50%;
            }
            .metadata {
                color: #6c757d;
                font-size: 0.9rem;
                margin-bottom: 1rem;
                display: flex;
                gap: 1rem;
                flex-wrap: wrap;
            }
            .article {
                margin: 0.5rem 0;
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 8px;
                border-left: 4px solid #667eea;
            }
            .article-title {
                font-weight: 600;
                color: #333;
                margin-bottom: 0.25rem;
            }
            .article-content {
                color: #6c757d;
                font-size: 0.9rem;
                margin-bottom: 0.25rem;
            }
            .article-meta {
                font-size: 0.8rem;
                color: #adb5bd;
            }
            .loading {
                text-align: center;
                padding: 3rem;
                color: #667eea;
                font-size: 1.1rem;
            }
            .error {
                color: #dc3545;
                font-style: italic;
                padding: 1rem;
                background: #f8d7da;
                border-radius: 6px;
                border: 1px solid #f5c6cb;
            }
            .benchmark-summary {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .summary-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 1.5rem;
                border-radius: 12px;
                text-align: center;
            }
            .summary-value {
                font-size: 2rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            .summary-label {
                font-size: 0.9rem;
                opacity: 0.9;
            }
            .category-section {
                margin-bottom: 2rem;
            }
            .category-title {
                font-size: 1.25rem;
                font-weight: 600;
                margin-bottom: 1rem;
                color: #333;
                padding: 0.5rem 0;
                border-bottom: 2px solid #e9ecef;
            }
            @media (max-width: 768px) {
                .container { margin: 0; }
                .header { padding: 1rem; }
                .header h1 { font-size: 2rem; }
                .nav-tab { padding: 0.75rem 1rem; font-size: 0.9rem; }
                .tab-content { padding: 1rem; }
                .results-grid { grid-template-columns: 1fr; }
                .button-group { flex-direction: column; }
                .btn { justify-content: center; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔍 Full Text Search Database Comparison</h1>
                <p>Comprehensive performance analysis across multiple database technologies</p>
            </div>
            
            <div class="nav-tabs">
                <button class="nav-tab active" onclick="showTab('overview')">📊 Overview</button>
                <button class="nav-tab" onclick="showTab('search')">🔍 Search</button>
                <button class="nav-tab" onclick="showTab('benchmarks')">⚡ Benchmarks</button>
                <button class="nav-tab" onclick="showTab('charts')">📈 Performance Charts</button>
                <button class="nav-tab" onclick="showTab('comparison')">🏆 Comparison</button>
            </div>

            <div id="overview" class="tab-content active">
                <h2 style="margin-bottom: 1rem;">Database Health Status</h2>
                <div class="health-grid" id="healthGrid">
                    <div class="loading">Checking database health...</div>
                </div>
            </div>

            <div id="search" class="tab-content">
                <div class="search-section">
                    <input type="text" id="searchQuery" class="search-box" placeholder="Enter your search query..." value="machine learning">
                    <div class="button-group">
                        <button class="btn btn-primary" onclick="searchAll()">🔍 Search All Databases</button>
                        <button class="btn btn-secondary" onclick="loadSampleQueries()">💡 Load Sample Queries</button>
                    </div>
                    <div id="sampleQueries" style="display: none; margin-top: 1rem;">
                        <p style="margin-bottom: 0.5rem; font-weight: 500;">Sample Queries:</p>
                        <div class="button-group" id="sampleQueryButtons"></div>
                    </div>
                </div>
                <div id="searchResults"></div>
            </div>

            <div id="benchmarks" class="tab-content">
                <div class="search-section">
                    <div class="button-group">
                        <button class="btn btn-primary" onclick="runBenchmarks()">⚡ Run Full Benchmarks</button>
                        <button class="btn btn-secondary" onclick="runQuickBenchmark()">🚀 Quick Benchmark</button>
                    </div>
                </div>
                <div id="benchmarkResults"></div>
            </div>

            <div id="charts" class="tab-content">
                <div class="chart-container">
                    <div class="chart-title">Average Response Times by Database</div>
                    <canvas id="performanceChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title">Performance by Query Category</div>
                    <canvas id="categoryChart" width="400" height="200"></canvas>
                </div>
                <div class="chart-container">
                    <div class="chart-title">Result Accuracy vs Performance</div>
                    <canvas id="scatterChart" width="400" height="200"></canvas>
                </div>
            </div>

            <div id="comparison" class="tab-content">
                <div id="comparisonData"></div>
            </div>
        </div>

        <script>
            const databases = ${JSON.stringify(databases)};
            let benchmarkData = null;
            let currentCharts = {};

            async function makeRequest(url) {
                try {
                    const response = await fetch(url);
                    return await response.json();
                } catch (error) {
                    return { error: 'Connection failed: ' + error.message };
                }
            }

            function showTab(tabName) {
                document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                event.target.classList.add('active');
                document.getElementById(tabName).classList.add('active');
                
                if (tabName === 'charts' && benchmarkData) {
                    renderCharts();
                }
            }

            async function checkHealth() {
                const healthGrid = document.getElementById('healthGrid');
                healthGrid.innerHTML = '<div class="loading">Checking health...</div>';
                
                const [healthResults, recordResults] = await Promise.all([
                    Promise.all(databases.map(async db => {
                        const result = await makeRequest(db.url + '/health');
                        return { name: db.name, color: db.color, ...result };
                    })),
                    Promise.all(databases.map(async db => {
                        const result = await makeRequest(db.url + '/all-records?limit=0');
                        return { name: db.name, total: result.total || 0 };
                    }))
                ]);

                const recordCounts = Object.fromEntries(
                    recordResults.map(r => [r.name, r.total])
                );

                healthGrid.innerHTML = healthResults.map(result => 
                    '<div class="health-card ' + (result.error ? 'unhealthy' : 'healthy') + '">' +
                    '<div class="database-name">' +
                    '<div class="database-indicator" style="background-color: ' + result.color + '"></div>' +
                    result.name +
                    '</div>' +
                    '<div style="margin: 0.5rem 0;"><strong>Status:</strong> ' + (result.error || result.status) + '</div>' +
                    '<div><strong>Records:</strong> ' + (recordCounts[result.name] || 0).toLocaleString() + '</div>' +
                    (result.uptime ? '<div><strong>Uptime:</strong> ' + result.uptime + '</div>' : '') +
                    '</div>'
                ).join('');
            }

            async function searchAll() {
                const query = document.getElementById('searchQuery').value;
                if (!query.trim()) return;

                const resultsDiv = document.getElementById('searchResults');
                resultsDiv.innerHTML = '<div class="loading">Searching all databases...</div>';

                const results = await Promise.all(
                    databases.map(async db => {
                        const result = await makeRequest(db.url + '/search?q=' + encodeURIComponent(query) + '&limit=10');
                        return { name: db.name, color: db.color, ...result };
                    })
                );

                resultsDiv.innerHTML = '<div class="results-grid">' + results.map(result => 
                    '<div class="database-card">' +
                    '<div class="database-name">' +
                    '<div class="database-indicator" style="background-color: ' + result.color + '"></div>' +
                    result.name +
                    '</div>' +
                    '<div class="metadata">' +
                    '<span><strong>Results:</strong> ' + (result.total || 0).toLocaleString() + '</span>' +
                    '<span><strong>Duration:</strong> ' + (result.duration || 'N/A') + '</span>' +
                    '</div>' +
                    (result.error ? 
                        '<div class="error">Error: ' + result.error + '</div>' :
                        (result.results || []).slice(0, 3).map(article => 
                            '<div class="article">' +
                            '<div class="article-title">' + (article.title || 'No title') + '</div>' +
                            '<div class="article-content">' + (article.content || '').substring(0, 120) + '...</div>' +
                            '<div class="article-meta">Author: ' + (article.author || 'Unknown') + 
                            (article.difficulty ? ' | Difficulty: ' + article.difficulty : '') +
                            (article.type ? ' | Type: ' + article.type : '') +
                            '</div>' +
                            '</div>'
                        ).join('')
                    ) +
                    '</div>'
                ).join('') + '</div>';
            }

            async function runBenchmarks() {
                const resultsDiv = document.getElementById('benchmarkResults');
                resultsDiv.innerHTML = '<div class="loading">Running comprehensive benchmarks...</div>';

                const results = await Promise.all(
                    databases.map(async db => {
                        const result = await makeRequest(db.url + '/benchmark');
                        return { name: db.name, color: db.color, ...result };
                    })
                );

                benchmarkData = results;
                displayBenchmarkResults(results);
            }

            async function runQuickBenchmark() {
                const queries = ['machine learning', 'performance', 'javascript'];
                const resultsDiv = document.getElementById('benchmarkResults');
                resultsDiv.innerHTML = '<div class="loading">Running quick benchmark...</div>';

                const results = [];
                for (const db of databases) {
                    const dbResult = { name: db.name, color: db.color, benchmarks: [], averageDuration: '0ms' };
                    const durations = [];
                    
                    for (const query of queries) {
                        const start = Date.now();
                        const result = await makeRequest(db.url + '/search?q=' + encodeURIComponent(query) + '&limit=100');
                        const duration = Date.now() - start;
                        durations.push(duration);
                        
                        dbResult.benchmarks.push({
                            query,
                            duration: duration + 'ms',
                            resultCount: result.total || 0
                        });
                    }
                    
                    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
                    dbResult.averageDuration = avgDuration + 'ms';
                    results.push(dbResult);
                }

                benchmarkData = results;
                displayBenchmarkResults(results);
            }

            function displayBenchmarkResults(results) {
                const resultsDiv = document.getElementById('benchmarkResults');
                
                const avgDurations = results.map(r => parseInt(r.averageDuration.replace('ms', '')));
                const minDuration = Math.min(...avgDurations);
                const maxDuration = Math.max(...avgDurations);
                
                resultsDiv.innerHTML = 
                    '<div class="benchmark-summary">' +
                    '<div class="summary-card"><div class="summary-value">' + results.length + '</div><div class="summary-label">Databases Tested</div></div>' +
                    '<div class="summary-card"><div class="summary-value">' + minDuration + 'ms</div><div class="summary-label">Fastest Average</div></div>' +
                    '<div class="summary-card"><div class="summary-value">' + maxDuration + 'ms</div><div class="summary-label">Slowest Average</div></div>' +
                    '<div class="summary-card"><div class="summary-value">' + Math.round(avgDurations.reduce((a, b) => a + b, 0) / avgDurations.length) + 'ms</div><div class="summary-label">Overall Average</div></div>' +
                    '</div>' +
                    '<div class="results-grid">' + results.map(result => 
                        '<div class="database-card">' +
                        '<div class="database-name">' +
                        '<div class="database-indicator" style="background-color: ' + result.color + '"></div>' +
                        result.name +
                        '</div>' +
                        '<div class="metadata"><span><strong>Average:</strong> ' + (result.averageDuration || 'N/A') + '</span></div>' +
                        (result.error ? 
                            '<div class="error">Error: ' + result.error + '</div>' :
                            (result.benchmarks || []).map(bench => 
                                '<div style="margin: 0.5rem 0; padding: 1rem; background: #f8f9fa; border-radius: 6px;">' +
                                '<div style="font-weight: 600;">Query: "' + bench.query + '"</div>' +
                                '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; margin-top: 0.5rem; font-size: 0.9rem;">' +
                                '<div><strong>Results:</strong> ' + (bench.resultCount || 0).toLocaleString() + '</div>' +
                                '<div><strong>Duration:</strong> ' + (bench.duration || bench.averageDuration || 'N/A') + '</div>' +
                                (bench.category ? '<div><strong>Category:</strong> ' + bench.category + '</div>' : '') +
                                '</div>' +
                                '</div>'
                            ).join('')
                        ) +
                        '</div>'
                    ).join('') + '</div>';
            }

            function loadSampleQueries() {
                const sampleDiv = document.getElementById('sampleQueries');
                const buttonsDiv = document.getElementById('sampleQueryButtons');
                
                const sampleQueries = [
                    'machine learning', 'artificial intelligence', 'javascript react', 
                    'database optimization', 'Dr. Sarah Chen', 'quantum computing',
                    'blockchain technology', 'security encryption', 'advanced tutorial'
                ];
                
                buttonsDiv.innerHTML = sampleQueries.map(query => 
                    '<button class="btn btn-secondary" onclick="document.getElementById(\'searchQuery\').value=\'' + 
                    query + '\'; searchAll();">' + query + '</button>'
                ).join('');
                
                sampleDiv.style.display = 'block';
            }

            function renderCharts() {
                if (!benchmarkData) return;
                
                Object.values(currentCharts).forEach(chart => chart.destroy());
                currentCharts = {};

                const avgTimes = benchmarkData.map(db => ({
                    name: db.name,
                    color: db.color,
                    avgTime: parseInt(db.averageDuration.replace('ms', ''))
                }));

                // Performance Chart
                const ctx1 = document.getElementById('performanceChart').getContext('2d');
                currentCharts.performance = new Chart(ctx1, {
                    type: 'bar',
                    data: {
                        labels: avgTimes.map(db => db.name),
                        datasets: [{
                            label: 'Average Response Time (ms)',
                            data: avgTimes.map(db => db.avgTime),
                            backgroundColor: avgTimes.map(db => db.color + '80'),
                            borderColor: avgTimes.map(db => db.color),
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: 'Response Time (ms)' }
                            }
                        }
                    }
                });

                // Category Chart - if we have detailed benchmark data
                if (benchmarkData[0]?.benchmarks?.[0]?.category) {
                    const categoryData = {};
                    benchmarkData.forEach(db => {
                        if (db.benchmarks) {
                            db.benchmarks.forEach(bench => {
                                if (!categoryData[bench.category]) categoryData[bench.category] = {};
                                categoryData[bench.category][db.name] = bench.averageDuration ? 
                                    parseInt(bench.averageDuration.replace('ms', '')) : 0;
                            });
                        }
                    });

                    const ctx2 = document.getElementById('categoryChart').getContext('2d');
                    const categories = Object.keys(categoryData);
                    const datasets = avgTimes.map(db => ({
                        label: db.name,
                        data: categories.map(cat => categoryData[cat][db.name] || 0),
                        backgroundColor: db.color + '80',
                        borderColor: db.color,
                        borderWidth: 1
                    }));

                    currentCharts.category = new Chart(ctx2, {
                        type: 'bar',
                        data: { labels: categories, datasets },
                        options: {
                            responsive: true,
                            scales: { y: { beginAtZero: true } }
                        }
                    });
                }

                // Scatter Chart
                const ctx3 = document.getElementById('scatterChart').getContext('2d');
                currentCharts.scatter = new Chart(ctx3, {
                    type: 'scatter',
                    data: {
                        datasets: avgTimes.map(db => ({
                            label: db.name,
                            data: [{ x: db.avgTime, y: Math.random() * 100 }], // placeholder accuracy
                            backgroundColor: db.color,
                            borderColor: db.color,
                            pointRadius: 8
                        }))
                    },
                    options: {
                        responsive: true,
                        scales: {
                            x: { title: { display: true, text: 'Response Time (ms)' }},
                            y: { title: { display: true, text: 'Accuracy Score' }}
                        }
                    }
                });
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

app.listen(port, () => {
  console.log(`Enhanced comparison dashboard running on port ${port}`);
  console.log(`Open http://localhost:${port} to view the dashboard`);
  console.log(`Features: Interactive charts, category analysis, real-time benchmarks`);
}); 