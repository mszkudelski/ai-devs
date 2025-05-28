# Reports Vector Database with Qdrant

This project sets up a vector database using Qdrant to store and search through various types of reports using semantic search capabilities.

## Features

- **Report Types Support**: 
  - Standard reports (from factory sectors)
  - Classified reports (do-not-share folder)
  - Automatic metadata extraction from filenames

- **Search Capabilities**:
  - Semantic search across all reports
  - Filter by date range
  - Filter by sector
  - Filter by report type (standard/classified)

- **Vector Storage**: Uses OpenAI's `text-embedding-3-large` model for high-quality embeddings

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `OPENAI_API_KEY`: Your OpenAI API key
- `QDRANT_URL`: Qdrant server URL (default: http://localhost:6333)
- `QDRANT_API_KEY`: Optional, for Qdrant Cloud

### 3. Start Qdrant

#### Option A: Using Docker (Recommended)
```bash
./scripts/start-qdrant.sh
```

#### Option B: Using Qdrant Cloud
Sign up at [Qdrant Cloud](https://cloud.qdrant.io/) and update your `.env` with the provided URL and API key.

### 4. Initialize the Vector Database

```bash
npm run start vector-db-demo
```

This will:
- Create the `reports` collection in Qdrant
- Load all reports from `data/pliki_z_fabryki/` and `data/pliki_z_fabryki/do-not-share/`
- Generate embeddings for each report
- Store them in the vector database
- Run several test searches

## Usage

### Basic Search

```typescript
import { ReportLoaderService } from './src/services/ReportLoaderService.js';

const reportLoader = new ReportLoaderService();

// Search all reports
const results = await reportLoader.searchReports('weapon testing', {
  limit: 5
});
```

### Advanced Filtering

```typescript
// Search only classified reports
const classifiedResults = await reportLoader.searchReports('plasma weapon', {
  type: 'classified',
  limit: 3
});

// Search by sector
const sectorResults = await reportLoader.searchReports('security breach', {
  sector: 'C4',
  limit: 5
});

// Search by date range
const dateResults = await reportLoader.searchReports('incident report', {
  dateFrom: '2024-01-01',
  dateTo: '2024-03-31',
  limit: 10
});
```

### Direct Vector Service Usage

```typescript
import { VectorService } from './src/services/VectorService.js';

const vectorService = new VectorService();

// Ensure collection exists
await vectorService.ensureReportsCollection();

// Get collection information
const info = await vectorService.getCollectionInfo();
console.log('Points count:', info.points_count);

// Raw search with custom filters
const results = await vectorService.searchReports('query', 5, {
  must: [{
    match: {
      key: "type",
      value: "classified"
    }
  }]
});
```

## Report Structure

The system automatically extracts metadata from filenames:

### Standard Reports
- **Format**: `2024-11-12_report-XX-sektor_YY.txt`
- **Example**: `2024-11-12_report-00-sektor_C4.txt`
- **Extracted**: Date: `2024-11-12`, Sector: `C4`, Type: `standard`

### Classified Reports
- **Format**: `2024_MM_DD.txt`
- **Example**: `2024_02_01.txt`
- **Extracted**: Date: `2024-02-01`, Type: `classified`

## API Reference

### ReportLoaderService

- `initializeVectorDatabase()`: Initialize database and load all reports
- `searchReports(query, options)`: Search with optional filters
- `loadAllReports()`: Load reports from all directories

### VectorService

- `ensureReportsCollection()`: Create collection if it doesn't exist
- `addReport(report)`: Add single report
- `addReports(reports)`: Add multiple reports
- `searchReports(query, limit, filter)`: Raw search with custom filters
- `searchReportsByDate/Sector/Type()`: Convenience search methods
- `getCollectionInfo()`: Get collection statistics

## Dashboard

When running Qdrant locally, access the dashboard at:
http://localhost:6333/dashboard

## Troubleshooting

### Common Issues

1. **Qdrant Connection Error**
   - Ensure Qdrant is running: `curl http://localhost:6333/health`
   - Check Docker container: `docker ps | grep qdrant`

2. **OpenAI API Errors**
   - Verify API key in `.env`
   - Check API quota and billing

3. **File Loading Issues**
   - Ensure report files exist in expected directories
   - Check file permissions

### Logs

All operations include detailed logging. Check console output for:
- Collection creation status
- Number of reports loaded
- Search results and metadata
- Error messages with stack traces
