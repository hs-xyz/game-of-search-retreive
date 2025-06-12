# Full-Text Search Comparison

A comprehensive comparison of full-text search capabilities across 6 different databases:

1. **Redis Stack** - In-memory database with RediSearch module
2. **MongoDB** - Document database with text indexes
3. **PostgreSQL** - Relational database with full-text search
4. **Elasticsearch** - Dedicated search engine
5. **ClickHouse** - Analytical database with text search
6. **LevelDB** - Fast key-value store with custom search

## Project Structure

```
├── packages/                   # Database implementations
│   ├── shared-utils/          # Common utilities and data
│   ├── redis-search/          # Redis Stack implementation
│   ├── mongodb-search/        # MongoDB implementation  
│   ├── postgresql-search/     # PostgreSQL implementation
│   ├── elasticsearch-search/  # Elasticsearch implementation
│   ├── clickhouse-search/     # ClickHouse implementation
│   └── leveldb-search/        # LevelDB implementation
└── apps/
    └── comparison-dashboard/   # Web interface for comparisons
```

## Quick Start

### Docker Compose (Recommended)
```bash
docker-compose up -d
```

### Manual Development
```bash
pnpm install
pnpm run dev
```

All services will be available at:

## Service Endpoints

All services implement the same REST API:

- **Redis**: http://localhost:3001
- **MongoDB**: http://localhost:3002  
- **PostgreSQL**: http://localhost:3003
- **Elasticsearch**: http://localhost:3004
- **ClickHouse**: http://localhost:3005
- **LevelDB**: http://localhost:3006

### Standard Endpoints

- `GET /health` - Service health check
- `GET /search?q={query}&limit={limit}` - Search articles
- `GET /benchmark` - Performance benchmarks

Additional endpoints vary by database (e.g., `/search-prefix` for LevelDB, `/search-phrase` for PostgreSQL).

## 🎯 Latest Technology Stack

This project uses the latest versions of all technologies:

- **Node.js 22** (latest LTS)
- **TypeScript 5.7** with ES2023 target
- **Express 5.0** (latest major version)
- **Turbo 2.3** (latest monorepo tools)
- **pnpm 10** (fastest package manager)
- **Docker images**: Latest stable versions of all databases

All packages have been updated to their latest versions for optimal performance and security.

## 🔧 Shared Utilities

The project uses a centralized `shared-utils` package that provides:

- **Common data types** and interfaces
- **Standardized seed data** (5 test articles)
- **Database-specific data transformers**
- **Benchmark query sets**

This eliminates code duplication and ensures consistency across all database implementations. 