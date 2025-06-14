// Dashboard configuration and state
let benchmarkData = null;
let currentCharts = {};

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeText(text) {
    return text ? text.replace(/[<>"']/g, '') : '';
}

async function makeRequest(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        return { error: 'Connection failed: ' + error.message };
    }
}

// Tab navigation
function showTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'charts' && benchmarkData) {
        renderCharts();
    }
}

// Database configuration
async function getDatabaseConfig() {
    try {
        const response = await fetch('/api/config');
        return await response.json();
    } catch (error) {
        // Fallback configuration
        return [
            { name: 'Redis Stack', url: 'http://localhost:3001', port: 3001, color: '#DC382D' },
            { name: 'MongoDB', url: 'http://localhost:3002', port: 3002, color: '#47A248' },
            { name: 'PostgreSQL', url: 'http://localhost:3003', port: 3003, color: '#336791' },
            { name: 'Elasticsearch', url: 'http://localhost:3004', port: 3004, color: '#005571' },
            { name: 'ClickHouse', url: 'http://localhost:3005', port: 3005, color: '#FFCC02' },
            { name: 'DuckDB', url: 'http://localhost:3006', port: 3006, color: '#FFF000' }
        ];
    }
}

// Health check functionality
async function checkHealth() {
    const healthGrid = document.getElementById('healthGrid');
    healthGrid.innerHTML = '<div class="loading">Checking database health...</div>';
    
    const databases = await getDatabaseConfig();
    
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

    renderHealthCards(healthResults, recordCounts);
}

function renderHealthCards(healthResults, recordCounts) {
    const healthGrid = document.getElementById('healthGrid');
    
    healthGrid.innerHTML = healthResults.map(result => {
        const cardElement = document.createElement('div');
        cardElement.className = `health-card ${result.error ? 'unhealthy' : 'healthy'}`;
        
        cardElement.innerHTML = `
            <div class="database-name">
                <div class="database-indicator" style="background-color: ${result.color}"></div>
                ${escapeHtml(result.name)}
            </div>
            <div style="margin: 0.5rem 0;"><strong>Status:</strong> ${escapeHtml(result.error || result.status || 'Unknown')}</div>
            <div><strong>Records:</strong> ${(recordCounts[result.name] || 0).toLocaleString()}</div>
            ${result.uptime ? `<div><strong>Uptime:</strong> ${escapeHtml(result.uptime)}</div>` : ''}
        `;
        
        return cardElement.outerHTML;
    }).join('');
}

// Search functionality
async function searchAll() {
    const query = document.getElementById('searchQuery').value;
    if (!query.trim()) return;

    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div class="loading">Searching all databases...</div>';

    const databases = await getDatabaseConfig();
    const results = await Promise.all(
        databases.map(async db => {
            const result = await makeRequest(db.url + '/search?q=' + encodeURIComponent(query) + '&limit=10');
            return { name: db.name, color: db.color, ...result };
        })
    );

    renderSearchResults(results);
}

function renderSearchResults(results) {
    const resultsDiv = document.getElementById('searchResults');
    const gridDiv = document.createElement('div');
    gridDiv.className = 'results-grid';
    
    results.forEach(result => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'database-card';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'database-name';
        nameDiv.innerHTML = `
            <div class="database-indicator" style="background-color: ${result.color}"></div>
            ${escapeHtml(result.name)}
        `;
        
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'metadata';
        metadataDiv.innerHTML = `
            <span><strong>Results:</strong> ${(result.total || 0).toLocaleString()}</span>
            <span><strong>Duration:</strong> ${escapeHtml(result.duration || 'N/A')}</span>
        `;
        
        cardDiv.appendChild(nameDiv);
        cardDiv.appendChild(metadataDiv);
        
        if (result.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = 'Error: ' + result.error;
            cardDiv.appendChild(errorDiv);
        } else {
            const articles = (result.results || []).slice(0, 3);
            articles.forEach(article => {
                const articleDiv = document.createElement('div');
                articleDiv.className = 'article';
                
                const titleDiv = document.createElement('div');
                titleDiv.className = 'article-title';
                titleDiv.textContent = article.title || 'No title';
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'article-content';
                contentDiv.textContent = (article.content || '').substring(0, 120) + '...';
                
                const metaDiv = document.createElement('div');
                metaDiv.className = 'article-meta';
                metaDiv.textContent = `Author: ${article.author || 'Unknown'}${
                    article.difficulty ? ` | Difficulty: ${article.difficulty}` : ''
                }${
                    article.type ? ` | Type: ${article.type}` : ''
                }`;
                
                articleDiv.appendChild(titleDiv);
                articleDiv.appendChild(contentDiv);
                articleDiv.appendChild(metaDiv);
                cardDiv.appendChild(articleDiv);
            });
        }
        
        gridDiv.appendChild(cardDiv);
    });
    
    resultsDiv.innerHTML = '';
    resultsDiv.appendChild(gridDiv);
}

// Benchmark functionality
async function runBenchmarks() {
    const resultsDiv = document.getElementById('benchmarkResults');
    resultsDiv.innerHTML = '<div class="loading">Running comprehensive benchmarks...</div>';

    const databases = await getDatabaseConfig();
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

    const databases = await getDatabaseConfig();
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
    
    // Create summary cards
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'benchmark-summary';
    
    const summaryData = [
        { value: results.length, label: 'Databases Tested' },
        { value: minDuration + 'ms', label: 'Fastest Average' },
        { value: maxDuration + 'ms', label: 'Slowest Average' },
        { value: Math.round(avgDurations.reduce((a, b) => a + b, 0) / avgDurations.length) + 'ms', label: 'Overall Average' }
    ];
    
    summaryData.forEach(data => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'summary-card';
        cardDiv.innerHTML = `
            <div class="summary-value">${data.value}</div>
            <div class="summary-label">${data.label}</div>
        `;
        summaryDiv.appendChild(cardDiv);
    });
    
    // Create results grid
    const gridDiv = document.createElement('div');
    gridDiv.className = 'results-grid';
    
    results.forEach(result => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'database-card';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'database-name';
        nameDiv.innerHTML = `
            <div class="database-indicator" style="background-color: ${result.color}"></div>
            ${escapeHtml(result.name)}
        `;
        
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'metadata';
        metadataDiv.innerHTML = `<span><strong>Average:</strong> ${escapeHtml(result.averageDuration || 'N/A')}</span>`;
        
        cardDiv.appendChild(nameDiv);
        cardDiv.appendChild(metadataDiv);
        
        if (result.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = 'Error: ' + result.error;
            cardDiv.appendChild(errorDiv);
        } else {
            (result.benchmarks || []).forEach(bench => {
                const benchDiv = document.createElement('div');
                benchDiv.className = 'benchmark-query';
                
                const titleDiv = document.createElement('div');
                titleDiv.className = 'benchmark-query-title';
                titleDiv.textContent = `Query: "${bench.query}"`;
                
                const statsDiv = document.createElement('div');
                statsDiv.className = 'benchmark-stats';
                
                const stats = [
                    { label: 'Results', value: (bench.resultCount || 0).toLocaleString() },
                    { label: 'Duration', value: bench.duration || bench.averageDuration || 'N/A' }
                ];
                
                if (bench.category) {
                    stats.push({ label: 'Category', value: bench.category });
                }
                
                stats.forEach(stat => {
                    const statDiv = document.createElement('div');
                    statDiv.innerHTML = `<strong>${stat.label}:</strong> ${escapeHtml(stat.value)}`;
                    statsDiv.appendChild(statDiv);
                });
                
                benchDiv.appendChild(titleDiv);
                benchDiv.appendChild(statsDiv);
                cardDiv.appendChild(benchDiv);
            });
        }
        
        gridDiv.appendChild(cardDiv);
    });
    
    resultsDiv.innerHTML = '';
    resultsDiv.appendChild(summaryDiv);
    resultsDiv.appendChild(gridDiv);
}

// Sample queries functionality
function loadSampleQueries() {
    const sampleDiv = document.getElementById('sampleQueries');
    const buttonsDiv = document.getElementById('sampleQueryButtons');
    
    const sampleQueries = [
        'machine learning', 'artificial intelligence', 'javascript react', 
        'database optimization', 'Dr. Sarah Chen', 'quantum computing',
        'blockchain technology', 'security encryption', 'advanced tutorial'
    ];
    
    buttonsDiv.innerHTML = '';
    
    sampleQueries.forEach(query => {
        const button = document.createElement('button');
        button.className = 'btn btn-secondary';
        button.textContent = query;
        button.onclick = () => setQueryAndSearch(query);
        buttonsDiv.appendChild(button);
    });
    
    sampleDiv.style.display = 'block';
}

function setQueryAndSearch(query) {
    document.getElementById('searchQuery').value = query;
    searchAll();
}

// Chart rendering functionality
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
    const ctx1 = document.getElementById('performanceChart');
    if (ctx1) {
        currentCharts.performance = new Chart(ctx1.getContext('2d'), {
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
    }

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

        const ctx2 = document.getElementById('categoryChart');
        if (ctx2) {
            const categories = Object.keys(categoryData);
            const datasets = avgTimes.map(db => ({
                label: db.name,
                data: categories.map(cat => categoryData[cat][db.name] || 0),
                backgroundColor: db.color + '80',
                borderColor: db.color,
                borderWidth: 1
            }));

            currentCharts.category = new Chart(ctx2.getContext('2d'), {
                type: 'bar',
                data: { labels: categories, datasets },
                options: {
                    responsive: true,
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    }

    // Scatter Chart
    const ctx3 = document.getElementById('scatterChart');
    if (ctx3) {
        currentCharts.scatter = new Chart(ctx3.getContext('2d'), {
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
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    checkHealth();
    
    // Set up search on Enter key
    const searchInput = document.getElementById('searchQuery');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchAll();
            }
        });
    }
});

// Make functions globally available
window.showTab = showTab;
window.checkHealth = checkHealth;
window.searchAll = searchAll;
window.runBenchmarks = runBenchmarks;
window.runQuickBenchmark = runQuickBenchmark;
window.loadSampleQueries = loadSampleQueries;
window.setQueryAndSearch = setQueryAndSearch; 