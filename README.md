# Database Search Performance Comparison

A comprehensive comparison of full-text search capabilities across different database technologies.

## Supported Databases

1. **Redis Stack** - Using RediSearch for full-text indexing
2. **MongoDB** - Native text search with regex fallback
3. **PostgreSQL** - Full-text search with tsvector and GIN indexes
4. **Elasticsearch** - Dedicated search engine with advanced text analysis
5. **ClickHouse** - Fast columnar database with text search functions
6. **DuckDB** - Analytical SQL database with efficient text search

## Project Structure

```
├── apps/
│   └── comparison-dashboard/    # Web dashboard for comparisons
├── packages/
│   ├── shared-utils/           # Common utilities and test data
│   ├── search-framework/       # Base interfaces and types
│   ├── redis-search/           # Redis Stack implementation
│   ├── mongodb-search/         # MongoDB implementation
│   ├── postgresql-search/      # PostgreSQL implementation
│   ├── elasticsearch-search/   # Elasticsearch implementation
│   ├── clickhouse-search/      # ClickHouse implementation
│   └── duckdb-search/          # DuckDB implementation
└── docker-compose.yml          # All services configuration
```

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <repository>
   cd database-search-comparison
   ```

2. **Start All Services**
   ```bash
   docker compose up --build
   ```

3. **Access the Dashboard**
   - **Main Dashboard**: http://localhost:3000

## Individual Database APIs

- **Redis Stack**: http://localhost:3001
- **MongoDB**: http://localhost:3002
- **PostgreSQL**: http://localhost:3003
- **Elasticsearch**: http://localhost:3004
- **ClickHouse**: http://localhost:3005
- **DuckDB**: http://localhost:3006

## API Endpoints

Each database service provides these endpoints:
- `GET /health` - Service health status
- `GET /search?q={query}&limit={limit}` - Search articles
- `GET /all-records?limit={limit}&offset={offset}` - Get all records
- `GET /benchmark` - Run performance benchmarks

Additional endpoints vary by database (e.g., `/search-phrase` for PostgreSQL).

## Features

- **100,000 sample articles** for realistic testing
- **Consistent API** across all databases
- **Performance benchmarks** with timing metrics
- **Web dashboard** for easy comparison
- **Docker containerization** for easy deployment
- **Health monitoring** for all services

## Technology Stack

- **Backend**: Node.js + TypeScript
- **Frontend**: Vanilla JavaScript (dashboard)
- **Containerization**: Docker + Docker Compose
- **Package Management**: pnpm with workspaces

## Sample Queries

The benchmark includes these test queries:
- "machine learning"
- "database"
- "web development"
- "artificial intelligence"
- "data science"

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development mode
pnpm dev
``` 