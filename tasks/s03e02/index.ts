import { OpenAIService } from '../../src/openai.service.js';
import { VectorService } from '../../src/services/VectorService.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface DoNotShareFile {
  filename: string;
  content: string;
  date: string;
  fullPath: string;
}

export class DoNotShareEmbeddingService {
  private openAIService: OpenAIService;
  private vectorService: VectorService;
  private readonly DO_NOT_SHARE_PATH = '/Users/marek.szkudelski/cursor/ai-devs-tasks/data/pliki_z_fabryki/do-not-share';

  constructor() {
    this.openAIService = new OpenAIService();
    this.vectorService = new VectorService();
  }

  /**
   * Extract date from filename in format: 2024_01_08.txt
   */
  private extractDateFromFilename(filename: string): string {
    const match = filename.match(/(\d{4})_(\d{2})_(\d{2})\.txt/);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}`;
    }
    return 'unknown';
  }

  /**
   * Load all "do not share" files
   */
  async loadDoNotShareFiles(): Promise<DoNotShareFile[]> {
    try {
      console.log('📁 Loading "do not share" files...');
      
      const files = await fs.readdir(this.DO_NOT_SHARE_PATH);
      const txtFiles = files.filter(file => file.endsWith('.txt'));
      
      console.log(`Found ${txtFiles.length} files in do-not-share directory`);

      const doNotShareFiles: DoNotShareFile[] = [];

      for (const filename of txtFiles) {
        const fullPath = path.join(this.DO_NOT_SHARE_PATH, filename);
        const content = await fs.readFile(fullPath, 'utf-8');
        const date = this.extractDateFromFilename(filename);
        
        doNotShareFiles.push({
          filename,
          content,
          date,
          fullPath
        });
        
        console.log(`📄 Loaded: ${filename} (${date})`);
      }

      return doNotShareFiles;
    } catch (error) {
      console.error('Error loading do-not-share files:', error);
      throw error;
    }
  }

  /**
   * Create embeddings for all files and save to vector database
   */
  async createEmbeddingsAndSave(): Promise<void> {
    try {
      console.log('🚀 Starting embedding creation process...\n');

      // Ensure vector database collection exists
      await this.vectorService.ensureReportsCollection();

      // Load all do-not-share files
      const files = await this.loadDoNotShareFiles();
      
      if (files.length === 0) {
        console.log('No files found to process');
        return;
      }

      console.log(`\n🧠 Creating embeddings for ${files.length} files...`);

      // Process files in batches to avoid hitting OpenAI rate limits
      const batchSize = 5;
      const batches = [];
      
      for (let i = 0; i < files.length; i += batchSize) {
        batches.push(files.slice(i, i + batchSize));
      }

      let totalProcessed = 0;

      for (const [batchIndex, batch] of batches.entries()) {
        console.log(`\n📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`);
        
        // Create embeddings for this batch
        const texts = batch.map(file => file.content);
        const embeddings = await this.openAIService.createBatchEmbeddings(texts);
        
        // Prepare points for vector database
        const points = batch.map((file, index) => ({
          id: uuidv4(), // Use proper UUID
          text: file.content,
          metadata: {
            filename: file.filename,
            date: file.date,
            type: 'classified' as const,
            source: 'do-not-share'
          }
        }));

        // Add to vector database
        await this.vectorService.addReports(points);
        
        totalProcessed += batch.length;
        console.log(`✅ Batch ${batchIndex + 1} completed. Total processed: ${totalProcessed}/${files.length}`);
        
        // Small delay between batches to be respectful to API limits
        if (batchIndex < batches.length - 1) {
          console.log('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`\n🎉 Successfully created embeddings for all ${totalProcessed} files!`);
      console.log('📊 All embeddings have been saved to the vector database');
      
    } catch (error) {
      console.error('Error creating embeddings:', error);
      throw error;
    }
  }

  /**
   * Test the created embeddings with a sample search
   */
  async testEmbeddings(): Promise<void> {
    try {
      console.log('\n🔍 Testing embeddings with sample searches...\n');
      
      const testQueries = [
        'classified information',
        'secret project',
        'do not share',
        'confidential data'
      ];

      for (const query of testQueries) {
        console.log(`Searching for: "${query}"`);
        
        // Use the searchReportsByType method specifically for classified reports
        const results = await this.vectorService.searchReportsByType(query, 'classified', 3);
        
        console.log(`Found ${results.length} results:`);
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.payload?.filename} (score: ${result.score?.toFixed(4)})`);
        });
        console.log('');
      }
      
    } catch (error) {
      console.error('Error testing embeddings:', error);
      // Don't throw here - testing is optional
    }
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    try {
      await this.createEmbeddingsAndSave();
      await this.testEmbeddings();
    } catch (error) {
      console.error('Application error:', error);
      throw error;
    } finally {
      // Shutdown OpenAI service to clean up Langfuse connections
      await this.openAIService.shutdown();
    }
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new DoNotShareEmbeddingService();
  service.run().catch(console.error);
}