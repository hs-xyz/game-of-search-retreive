#!/bin/bash

set -e

echo "🚀 Starting Full Text Search Database Comparison"
echo "================================================"

echo "📦 Starting Docker services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 30

echo "📚 Installing dependencies..."
pnpm install

echo "🔧 Building applications..."
pnpm run build

echo "🎯 Starting search packages and dashboard..."
echo ""
echo "Search packages (packages/) will start on these ports:"
echo "- Redis Stack: http://localhost:3001"
echo "- MongoDB: http://localhost:3002"
echo "- PostgreSQL: http://localhost:3003"
echo "- Elasticsearch: http://localhost:3004"
echo "- ClickHouse: http://localhost:3005"
echo "- LevelDB: http://localhost:3006"
echo "- RocksDB: http://localhost:3007"
echo ""
echo "Dashboard app (apps/comparison-dashboard):"
echo "- Dashboard: http://localhost:3000"
echo ""
echo "🌐 Starting all services..."
echo "Visit http://localhost:3000 to compare all databases!"
echo ""

pnpm run dev 