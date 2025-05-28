#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { OpenAIService } from '../src/openai.service.js';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface MockReport {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    filename: string;
    date: string;
    sector?: string;
    type: 'standard' | 'classified' | 'other';
    source: string;
  };
}

class MockVectorStore {
  private reports: MockReport[] = [];
  private openAIService: OpenAIService;

  constructor() {
    this.openAIService = new OpenAIService();
  }

  async addReport(text: string, metadata: any): Promise<void> {
    const embedding = await this.openAIService.createEmbedding(text);
    
    this.reports.push({
      id: `${metadata.filename}_${Date.now()}`,
      text,
      embedding,
      metadata
    });
  }

  async search(query: string, limit: number = 5): Promise<any[]> {
    const queryEmbedding = await this.openAIService.createEmbedding(query);
    
    // Calculate cosine similarity
    const results = this.reports.map(report => {
      const similarity = this.cosineSimilarity(queryEmbedding, report.embedding);
      return {
        score: similarity,
        payload: {
          text: report.text,
          filename: report.metadata.filename,
          date: report.metadata.date,
          sector: report.metadata.sector,
          type: report.metadata.type,
          source: report.metadata.source
        }
      };
    });

    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getReportsCount(): number {
    return this.reports.length;
  }

  async shutdown(): Promise<void> {
    await this.openAIService.shutdown();
  }
}

async function loadReports(vectorStore: MockVectorStore, directoryPath: string): Promise<number> {
  let count = 0;
  
  try {
    const files = fs.readdirSync(directoryPath);
    const txtFiles = files.filter(file => file.endsWith('.txt'));
    
    for (const file of txtFiles) {
      const filePath = path.join(directoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      
      if (content) {
        const baseName = path.basename(file, '.txt');
        let date = '';
        let sector = '';
        let type: 'standard' | 'classified' | 'other' = 'other';
        
        // Extract metadata from filename
        const standardMatch = baseName.match(/^(\d{4}-\d{2}-\d{2})_report-\d+-sektor_(.+)$/);
        if (standardMatch) {
          date = standardMatch[1];
          sector = standardMatch[2];
          type = 'standard';
        }
        
        const classifiedMatch = baseName.match(/^(\d{4})_(\d{2})_(\d{2})$/);
        if (classifiedMatch) {
          date = `${classifiedMatch[1]}-${classifiedMatch[2]}-${classifiedMatch[3]}`;
          type = 'classified';
        }
        
        await vectorStore.addReport(content, {
          filename: baseName,
          date,
          sector,
          type,
          source: directoryPath
        });
        
        count++;
        if (count % 5 === 0) {
          console.log(`  Processed ${count} reports...`);
        }
      }
    }
  } catch (error) {
    console.error(`Error loading reports from ${directoryPath}:`, error);
  }
  
  return count;
}

async function main() {
  try {
    console.log('🧪 Mock Vector Database Demo (No Qdrant needed)\n');

    const vectorStore = new MockVectorStore();

    // Load standard reports
    console.log('📚 Loading standard reports...');
    const standardPath = '/Users/marek.szkudelski/cursor/ai-devs-tasks/data/pliki_z_fabryki';
    const standardCount = await loadReports(vectorStore, standardPath);

    // Load classified reports
    console.log('🔒 Loading classified reports...');
    const classifiedPath = '/Users/marek.szkudelski/cursor/ai-devs-tasks/data/pliki_z_fabryki/do-not-share';
    const classifiedCount = await loadReports(vectorStore, classifiedPath);

    const totalReports = vectorStore.getReportsCount();
    console.log(`\n✅ Loaded ${totalReports} reports total (${standardCount} standard, ${classifiedCount} classified)\n`);

    // Test searches
    const testQueries = [
      'broń plazmowa',
      'Aleksander Ragowski', 
      'sektor C4',
      'temperatura',
      'zabezpieczenia'
    ];

    console.log('🔍 Testing search functionality...\n');

    for (const query of testQueries) {
      console.log(`--- Searching for: "${query}" ---`);
      const results = await vectorStore.search(query, 3);
      
      if (results.length === 0) {
        console.log('  No results found.');
      } else {
        results.forEach((result, index) => {
          console.log(`${index + 1}. [Score: ${result.score.toFixed(3)}] ${result.payload.filename}`);
          console.log(`   Date: ${result.payload.date} | Sector: ${result.payload.sector || 'N/A'} | Type: ${result.payload.type}`);
          console.log(`   Text: ${result.payload.text.substring(0, 100)}...\n`);
        });
      }
    }

    console.log('🎉 Mock demo completed successfully!');
    console.log('\n💡 To use the full Qdrant setup:');
    console.log('1. Set up Qdrant (local Docker or cloud)');
    console.log('2. Run: npm run test-connections');
    console.log('3. Run: npm run vector-db-demo');

    await vectorStore.shutdown();

  } catch (error) {
    console.error('❌ Error in mock demo:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
