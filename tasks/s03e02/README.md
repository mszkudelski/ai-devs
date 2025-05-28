# S03E02 - Do Not Share Files Embedding Processing

## Overview
This script processes all files from the "do-not-share" directory, creates embeddings using OpenAI, and stores them in a vector database with proper metadata including extracted dates.

## What was implemented:

### 1. Enhanced OpenAI Service
- Added `createBatchEmbeddings()` method for efficient processing of multiple texts
- Uses OpenAI's `text-embedding-3-large` model for high-quality embeddings
- Includes Langfuse tracing for monitoring

### 2. DoNotShareEmbeddingService
- **File Loading**: Automatically discovers and loads all `.txt` files from the do-not-share directory
- **Date Extraction**: Extracts dates from filenames (format: `2024_01_08.txt` → `2024-01-08`)
- **Batch Processing**: Processes files in batches of 5 to respect API rate limits
- **UUID Generation**: Uses proper UUIDs for vector database point IDs
- **Error Handling**: Comprehensive error handling and logging

### 3. Metadata Structure
Each embedding includes metadata:
```typescript
{
  filename: "2024_01_08.txt",
  date: "2024-01-08", 
  type: "classified",
  source: "do-not-share"
}
```

### 4. Vector Database Storage
- Uses existing Qdrant collection with proper indexes
- 3072-dimensional vectors (text-embedding-3-large)
- Cosine similarity for search
- Filterable by type, date, filename, and source

## Results
- **23 files processed** successfully
- **All embeddings created** and stored in vector database
- **Search functionality verified** with sample queries
- **Proper classification** as "classified" type documents

## Usage
```bash
cd /Users/marek.szkudelski/cursor/ai-devs-tasks
npm run build
node dist/tasks/s03e02/index.js
```

## Search Capabilities
The processed files can now be searched semantically:
- Filter by document type: `type: "classified"`
- Filter by date range
- Semantic search across document content
- Metadata-based filtering

Example search results show the system successfully indexes and retrieves classified documents based on semantic queries.
