#!/bin/bash

# Start Qdrant using Docker
echo "🚀 Starting Qdrant vector database..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running."
    echo ""
    echo "To start Docker on macOS:"
    echo "1. Open Docker Desktop application"
    echo "2. Or run: 'open -a Docker'"
    echo "3. Wait for Docker to start, then run this script again"
    echo ""
    echo "Alternative: Use Qdrant Cloud"
    echo "1. Sign up at https://cloud.qdrant.io/"
    echo "2. Create a cluster"
    echo "3. Add QDRANT_URL and QDRANT_API_KEY to your .env file"
    exit 1
fi

# Stop any existing Qdrant container
echo "🛑 Stopping any existing Qdrant container..."
docker stop qdrant 2>/dev/null || true
docker rm qdrant 2>/dev/null || true

# Start Qdrant container
echo "📦 Starting new Qdrant container..."
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant:latest

# Wait for Qdrant to be ready
echo "⏳ Waiting for Qdrant to be ready..."
sleep 5

# Check if Qdrant is running
if curl -s http://localhost:6333/health >/dev/null; then
    echo "✅ Qdrant is running successfully!"
    echo "📊 Dashboard: http://localhost:6333/dashboard"
    echo "🔧 API: http://localhost:6333"
else
    echo "❌ Failed to start Qdrant. Check Docker logs:"
    docker logs qdrant
    exit 1
fi
