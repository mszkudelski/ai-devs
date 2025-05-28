# Vector Database Setup Guide

This guide will help you set up a vector database using Qdrant to store and search through factory reports with semantic search capabilities.

## 🚀 Quick Start

### 1. Test Your Current Setup
```bash
npm run test-connections
```

This will check if OpenAI and Qdrant connections are working.

### 2. Choose Your Qdrant Setup

#### Option A: Qdrant Cloud (Recommended - No Docker needed)
1. Go to [Qdrant Cloud](https://cloud.qdrant.io/)
2. Sign up for a free account
3. Create a new cluster
4. Copy your cluster URL and API key
5. Update your `.env` file:
```env
QDRANT_URL=https://your-cluster-url.qdrant.io
QDRANT_API_KEY=your-api-key-here
```

#### Option B: Local Docker Setup
1. Make sure Docker Desktop is running
2. Run: `npm run start-qdrant`
3. Access dashboard at http://localhost:6333/dashboard

### 3. Initialize the Vector Database
```bash
npm run vector-db-demo
```

## 📊 What Gets Created

The setup creates a `reports` collection in Qdrant with:

- **3072-dimensional vectors** (using OpenAI's text-embedding-3-large)
- **Cosine similarity** for search
- **Rich metadata** including:
  - Filename and date
  - Sector information
  - Report type (standard/classified)
  - Full text content

## 📁 Report Structure

### Standard Reports
- **Location**: `data/pliki_z_fabryki/`
- **Format**: `2024-11-12_report-XX-sektor_YY.txt`
- **Example**: Contains security patrol reports, incident logs

### Classified Reports  
- **Location**: `data/pliki_z_fabryki/do-not-share/`
- **Format**: `2024_MM_DD.txt` 
- **Example**: Contains weapon testing reports, classified research

## 🔍 Search Examples

### Basic Search
```typescript
import { ReportLoaderService } from './src/services/ReportLoaderService.js';

const reportLoader = new ReportLoaderService();

// Find reports about weapons
const results = await reportLoader.searchReports('broń plazmowa', { limit: 5 });
```

### Advanced Filtering
```typescript
// Search only classified reports
const classified = await reportLoader.searchReports('weapon testing', {
  type: 'classified',
  limit: 3
});

// Search specific sector
const sectorC4 = await reportLoader.searchReports('wykryto', {
  sector: 'C4',
  limit: 5
});

// Search by date range
const recentReports = await reportLoader.searchReports('incident', {
  dateFrom: '2024-02-01',
  dateTo: '2024-03-31'
});
```

## 🛠 Available Commands

| Command | Description |
|---------|-------------|
| `npm run test-connections` | Test Qdrant and OpenAI connections |
| `npm run start-qdrant` | Start local Qdrant with Docker |
| `npm run vector-db-demo` | Initialize database and run demo searches |

## 📈 Demo Output

The demo will:
1. ✅ Create the `reports` collection
2. 📚 Load all reports from both directories  
3. 🧠 Generate embeddings for each report
4. 💾 Store in vector database
5. 🔍 Run sample searches to demonstrate capabilities

Example searches include:
- `"broń plazmowa"` - Find plasma weapon reports
- `"Aleksander Ragowski"` - Find person mentions
- `"sektor C4"` - Find sector-specific reports
- `"temperatura"` - Find temperature-related content

## 🔧 Troubleshooting

### Qdrant Connection Issues
```
❌ Failed to connect to Qdrant: fetch failed
```
**Solutions:**
- For local: Make sure Docker is running and `npm run start-qdrant`
- For cloud: Check QDRANT_URL and QDRANT_API_KEY in .env

### OpenAI API Issues
```
❌ Failed to connect to OpenAI
```
**Solutions:**
- Verify OPENAI_API_KEY in .env file
- Check API quota and billing status

### Import/Module Issues
```
❌ Cannot find module
```
**Solutions:**
- Run `npm install` to ensure all dependencies are installed
- Check that file extensions (.js) are included in imports

## 📊 Monitoring

### Qdrant Dashboard
- **Local**: http://localhost:6333/dashboard
- **Cloud**: Available in your Qdrant Cloud console

### Collection Stats
```typescript
const vectorService = new VectorService();
const info = await vectorService.getCollectionInfo();
console.log('Points count:', info.points_count);
```

## 🔄 Data Management

### Re-initialize Database
```bash
# This will recreate the collection and reload all reports
npm run vector-db-demo
```

### Add New Reports
```typescript
const reportLoader = new ReportLoaderService();
const vectorService = reportLoader.getVectorService();

// Add single report
await vectorService.addReport({
  id: 'unique-id',
  text: 'Report content...',
  metadata: {
    filename: 'new-report',
    date: '2024-01-01',
    type: 'standard',
    source: 'manual'
  }
});
```

## 💡 Next Steps

After setup, you can:
1. 🔍 **Search Capabilities**: Implement in your applications
2. 📊 **Analytics**: Build dashboards on top of search results  
3. 🤖 **AI Integration**: Use search results as context for AI responses
4. 📈 **Scaling**: Add more document types and sources

## 🛡 Security Notes

- Classified reports are stored with `type: 'classified'` metadata
- Use filtering to control access based on user permissions
- Consider encryption for sensitive data in production
