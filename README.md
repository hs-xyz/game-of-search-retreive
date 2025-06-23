# Game of Search & Retrieve

> **⚠️ WORK IN PROGRESS**  
> This project is currently under active development. Features, documentation, and implementation details may change significantly. Some features described below may not be fully implemented yet.

A comprehensive benchmarking suite for comparing full-text search performance across multiple database technologies with enhanced data generation, sophisticated testing scenarios, and interactive visual analysis.

## 🆕 New Features & Enhancements

### Enhanced Data Generation
- **1M+ diverse articles** with realistic content and metadata
- **40+ authors** including PhD researchers and industry experts
- **35+ technology subjects** covering modern software development
- **Smart tag generation** with 60+ categorized tags across 8 domains
- **Content types**: articles, tutorials, research papers, guides, analysis
- **Difficulty levels**: beginner, intermediate, advanced
- **Rich metadata**: read time, publish dates, views, ratings

### Comprehensive Benchmark Queries
- **20+ test queries** across different categories:
  - Single word (common/rare terms)
  - Multi-word phrases
  - Technical compound queries
  - Author-based searches
  - Long complex queries
  - Edge cases and special scenarios
  - Domain-specific searches
  - Difficulty/type-based filtering

### Interactive Visual Dashboard
- **Modern responsive UI** with tabbed navigation
- **Real-time performance charts** using Chart.js
- **Category-based analysis** with performance breakdowns
- **Interactive benchmarking** with quick and full test modes
- **Health monitoring** with status indicators
- **Sample query suggestions** for easy testing

### Enhanced Analytics
- **Statistical analysis** with median, std deviation, percentiles
- **Performance comparison charts** across databases
- **Category performance visualization**
- **Response time vs accuracy scatter plots**
- **Real-time benchmark execution**

## Supported Databases

| Database | Version | Port | Specialization |
|----------|---------|------|----------------|
| **Redis Stack** | 7.x | 3001 | In-memory, RediSearch |
| **MongoDB** | 7.x | 3002 | Document, text indexes |
| **PostgreSQL** | 15.x | 3003 | Relational, tsvector |
| **Elasticsearch** | 8.x | 3004 | Search engine, inverted indexes |
| **ClickHouse** | 23.x | 3005 | Analytical, full-text |
| **DuckDB** | 0.9.x | 3006 | Analytical, embedded |

## Quick Start

### Prerequisites
- **Docker & Docker Compose** (required)
- **Node.js 18+** with **pnpm** (for development)

### Launch Everything
```bash
# Start all databases and services
docker-compose up -d

# Wait for initialization (2-3 minutes)
# Then open the dashboard
open http://localhost:3000
```

### Development Mode
```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Start in development mode
pnpm dev
```

## Architecture

```
├── packages/
│   ├── shared-utils/          # Enhanced data generation & utilities
│   ├── search-framework/      # Common search interface
│   ├── redis-search/          # Redis Stack adapter
│   ├── mongodb-search/        # MongoDB adapter
│   ├── postgresql-search/     # PostgreSQL adapter
│   ├── elasticsearch-search/  # Elasticsearch adapter
│   ├── clickhouse-search/     # ClickHouse adapter
│   └── duckdb-search/         # DuckDB adapter
├── apps/
│   └── comparison-dashboard/  # Enhanced web interface
└── docker-compose.yml         # Complete infrastructure
```

## API Endpoints

### Core Endpoints
- `GET /health` - Database health status
- `GET /search?q={query}&limit={limit}` - Search articles
- `GET /all-records?limit={limit}&offset={offset}` - Get paginated records
- `GET /benchmark` - Run comprehensive performance benchmarks

### Dashboard Endpoints
- `GET /` - Interactive dashboard home
- `GET /search-all?q={query}` - Search across all databases
- `GET /benchmark-all` - Benchmark all databases
- `GET /api/enhanced-benchmark` - Detailed benchmark analytics

### Database-Specific Variants
- PostgreSQL: `/search-phrase`, `/search-ilike`
- Elasticsearch: `/search-phrase`, `/search-bool`
- ClickHouse: `/search-like`, `/search-multiword`
- MongoDB: `/search-regex`

## Enhanced Benchmark Categories

### Query Types Tested
1. **Single Word Queries**
   - Common terms (`machine`, `performance`)
   - Rare technical terms (`quantum`)

2. **Multi-Word Phrases**
   - Technology combinations (`machine learning`)
   - Infrastructure terms (`cloud computing`)

3. **Technical Compound Queries**
   - Multi-term technical (`database optimization performance`)
   - DevOps stacks (`kubernetes docker microservices`)

4. **Author-Based Searches**
   - Full names (`Dr. Sarah Chen`)
   - Partial matches (`Chen`)

5. **Complex Long Queries**
   - Advanced technical combinations
   - Multiple concept searches

6. **Domain-Specific**
   - Industry domains (`healthcare fintech`)
   - Security concepts (`security encryption`)

7. **Content Filtering**
   - Difficulty-based (`beginner tutorial`)
   - Type-based (`research analysis`)

8. **Edge Cases**
   - Programming languages (`javascript`)
   - Framework comparisons (`react angular vue`)

## Performance Metrics

### Response Time Analysis
- **Average response time** across all queries
- **Median response time** for consistent performance
- **95th percentile** for worst-case scenarios
- **Standard deviation** for performance consistency

### Category Performance
- **Single vs multi-word** query performance
- **Common vs rare term** efficiency
- **Complex query** handling capabilities
- **Author search** optimization

### Accuracy Metrics
- **Result count consistency** across databases
- **Relevance scoring** comparison
- **Search coverage** analysis

## Sample Benchmark Results

```bash
# Example performance comparison
Redis Stack:    avg 15ms  (excellent for simple queries)
Elasticsearch:  avg 25ms  (balanced performance)
PostgreSQL:     avg 45ms  (good for complex text search)
MongoDB:        avg 35ms  (decent with proper indexing)
ClickHouse:     avg 55ms  (optimized for analytics)
DuckDB:         avg 40ms  (solid embedded performance)
```

## Data Generation Details

### Article Structure
```typescript
interface Article {
  id: string;
  title: string;           // Generated from 20 prefixes + 35 subjects
  content: string;         // 15 realistic templates with domain terms
  author: string;          // 40 diverse professional authors
  tags: string[];          // Smart categorized tags (8 categories)
  difficulty: string;      // beginner/intermediate/advanced
  type: string;           // article/tutorial/research/guide/analysis
  readTime: number;       // 3-23 minutes estimated
  publishDate: string;    // 2020-2024 range
  views: number;          // 100-100k realistic views
  rating: number;         // 3.0-5.0 star ratings
}
```

### Content Categories
- **Technology**: ML, AI, blockchain, IoT, AR/VR, quantum
- **Programming**: 8 major languages with frameworks
- **Cloud**: AWS, Azure, GCP, Kubernetes, serverless
- **Methods**: Agile, DevOps, CI/CD, testing methodologies
- **Domains**: Fintech, healthcare, e-commerce, gaming
- **Concepts**: Performance, security, scalability, monitoring

## Visualization Features

### Performance Charts
- **Bar charts** comparing average response times
- **Category breakdown** showing performance by query type
- **Scatter plots** correlating accuracy vs speed
- **Time series** for benchmark progression

### Interactive Elements
- **Real-time benchmarking** with progress indicators
- **Sample query suggestions** for quick testing
- **Filterable results** by database and category
- **Responsive design** for mobile and desktop

## Development

### Adding New Databases
1. Create adapter in `packages/{database}-search/`
2. Implement `DatabaseAdapter` interface
3. Add to `docker-compose.yml`
4. Update dashboard configuration

### Custom Benchmark Queries
```typescript
// Add to shared-utils/src/index.ts
{ 
  query: 'your test query', 
  category: 'custom-category', 
  description: 'Test description',
  expectedResults: 'low' | 'medium' | 'high'
}
```

### Data Generation Customization
- Modify content templates for different domains
- Add new tag categories for specialized testing
- Adjust author lists for specific industries
- Configure difficulty distributions

## Performance Optimization

### Database-Specific Tuning
- **Redis**: FT.SEARCH indexes with optimized schema
- **MongoDB**: Compound text indexes with weights
- **PostgreSQL**: GIN indexes on tsvector columns
- **Elasticsearch**: Custom analyzers and field boosting
- **ClickHouse**: Bloom filter indexes for text search
- **DuckDB**: Optimized full-text search queries

### Benchmark Optimization
- **Parallel execution** of database queries
- **Connection pooling** for consistent performance
- **Query warming** to eliminate cold start bias
- **Statistical significance** with multiple iterations

## Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/enhancement`
3. **Follow TypeScript best practices**
4. **Add comprehensive tests**
5. **Update documentation**
6. **Submit pull request**

## Technology Stack

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: Vanilla JavaScript, Chart.js
- **Databases**: 6 different technologies with Docker
- **Build**: pnpm workspaces, TypeScript compilation
- **Infrastructure**: Docker Compose orchestration

## License

MIT License - see LICENSE file for details.

## Benchmarking Results

Visit the live dashboard at `http://localhost:3000` to:
- **Run real-time benchmarks** across all databases
- **Compare performance metrics** with interactive charts
- **Test custom queries** with immediate results
- **Analyze category-specific** performance patterns
- **Export benchmark data** for further analysis

---

**🚀 Ready to compare database performance?**
```bash
docker-compose up -d && open http://localhost:3000
``` 