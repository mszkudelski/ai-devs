import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { OpenAIService } from '../openai.service.js';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportMetadata {
  filename: string;
  date: string;
  sector?: string;
  type: 'standard' | 'classified' | 'other';
  source: string;
}

export interface ReportPoint {
  id: string;
  text: string;
  metadata: ReportMetadata;
}

export class VectorService {
  private client: QdrantClient;
  private openAIService: OpenAIService;
  private readonly COLLECTION_NAME = 'reports';

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
    this.openAIService = new OpenAIService();
  }

  async ensureReportsCollection() {
    try {
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(c => c.name === this.COLLECTION_NAME);
      
      if (!collectionExists) {
        console.log(`Creating collection: ${this.COLLECTION_NAME}`);
        await this.client.createCollection(this.COLLECTION_NAME, {
          vectors: { 
            size: 3072, // text-embedding-3-large dimensions
            distance: "Cosine" 
          }
        });
        console.log(`Collection ${this.COLLECTION_NAME} created successfully`);
        
        // Create indexes for filtering
        await this.createIndexes();
      } else {
        console.log(`Collection ${this.COLLECTION_NAME} already exists`);
        // Ensure indexes exist even if collection already exists
        await this.createIndexes();
      }
    } catch (error) {
      console.error('Error ensuring collection:', error);
      throw error;
    }
  }

  private async createIndexes() {
    try {
      console.log('Creating indexes for filtering...');
      
      // Create keyword index for type field
      await this.client.createPayloadIndex(this.COLLECTION_NAME, {
        field_name: 'type',
        field_schema: 'keyword'
      });
      console.log('Created index for "type" field');
      
      // Create keyword index for sector field
      await this.client.createPayloadIndex(this.COLLECTION_NAME, {
        field_name: 'sector',
        field_schema: 'keyword'
      });
      console.log('Created index for "sector" field');
      
      // Create keyword index for date field
      await this.client.createPayloadIndex(this.COLLECTION_NAME, {
        field_name: 'date',
        field_schema: 'keyword'
      });
      console.log('Created index for "date" field');
      
      // Create keyword index for filename field
      await this.client.createPayloadIndex(this.COLLECTION_NAME, {
        field_name: 'filename',
        field_schema: 'keyword'
      });
      console.log('Created index for "filename" field');
      
      console.log('All indexes created successfully');
    } catch (error) {
      // Index might already exist, log warning but don't fail
      console.warn('Warning creating indexes (might already exist):', error.message);
    }
  }

  async addReport(report: ReportPoint) {
    try {
      const embedding = await this.openAIService.createEmbedding(report.text);
      
      await this.client.upsert(this.COLLECTION_NAME, {
        wait: true,
        points: [{
          id: report.id,
          vector: embedding,
          payload: {
            text: report.text,
            filename: report.metadata.filename,
            date: report.metadata.date,
            sector: report.metadata.sector,
            type: report.metadata.type,
            source: report.metadata.source
          }
        }]
      });
      
      console.log(`Added report: ${report.metadata.filename}`);
    } catch (error) {
      console.error(`Error adding report ${report.metadata.filename}:`, error);
      throw error;
    }
  }

  async addReports(reports: ReportPoint[]) {
    try {
      const pointsToUpsert = await Promise.all(reports.map(async report => {
        const embedding = await this.openAIService.createEmbedding(report.text);
        return {
          id: report.id,
          vector: embedding,
          payload: {
            text: report.text,
            filename: report.metadata.filename,
            date: report.metadata.date,
            sector: report.metadata.sector,
            type: report.metadata.type,
            source: report.metadata.source
          }
        };
      }));

      await this.client.upsert(this.COLLECTION_NAME, {
        wait: true,
        points: pointsToUpsert
      });

      console.log(`Added ${reports.length} reports to vector database`);
    } catch (error) {
      console.error('Error adding reports:', error);
      throw error;
    }
  }

  async searchReports(query: string, limit: number = 5, filter?: any) {
    try {
      const queryEmbedding = await this.openAIService.createEmbedding(query);
      
      const searchParams: any = {
        vector: queryEmbedding,
        limit,
        with_payload: true
      };

      if (filter && Object.keys(filter).length > 0) {
        console.log('Applying filter:', JSON.stringify(filter, null, 2));
        searchParams.filter = filter;
      }

      const results = await this.client.search(this.COLLECTION_NAME, searchParams);
      return results;
    } catch (error) {
      console.error('Error searching reports:', error);
      throw error;
    }
  }

  async searchReportsByDate(query: string, dateFrom?: string, dateTo?: string, limit: number = 5) {
    const filter: any = {};
    
    if (dateFrom || dateTo) {
      filter.must = [];
      if (dateFrom) {
        filter.must.push({
          key: "date",
          range: {
            gte: dateFrom
          }
        });
      }
      if (dateTo) {
        filter.must.push({
          key: "date",
          range: {
            lte: dateTo
          }
        });
      }
    }

    return this.searchReports(query, limit, Object.keys(filter).length > 0 ? filter : undefined);
  }

  async searchReportsBySector(query: string, sector: string, limit: number = 5) {
    const filter = {
      must: [{
        key: "sector",
        match: {
          value: sector
        }
      }]
    };

    return this.searchReports(query, limit, filter);
  }

  async searchReportsByType(query: string, type: 'standard' | 'classified' | 'other', limit: number = 5) {
    const filter = {
      must: [{
        key: "type",
        match: {
          value: type
        }
      }]
    };

    return this.searchReports(query, limit, filter);
  }

  async getAllReports(limit: number = 100) {
    try {
      const result = await this.client.scroll(this.COLLECTION_NAME, {
        limit,
        with_payload: true
      });
      return result;
    } catch (error) {
      console.error('Error getting all reports:', error);
      throw error;
    }
  }

  async getCollectionInfo() {
    try {
      const info = await this.client.getCollection(this.COLLECTION_NAME);
      return info;
    } catch (error) {
      console.error('Error getting collection info:', error);
      throw error;
    }
  }

  async deleteCollection() {
    try {
      await this.client.deleteCollection(this.COLLECTION_NAME);
      console.log(`Collection ${this.COLLECTION_NAME} deleted`);
    } catch (error) {
      console.error('Error deleting collection:', error);
      throw error;
    }
  }

  // Utility method to extract metadata from filename
  static extractMetadataFromFilename(filename: string, source: string): ReportMetadata {
    const baseName = path.basename(filename, '.txt');
    
    // Extract date from filename
    let date = '';
    let sector = '';
    let type: 'standard' | 'classified' | 'other' = 'other';
    
    // Pattern for standard reports: 2024-11-12_report-XX-sektor_YY
    const standardMatch = baseName.match(/^(\d{4}-\d{2}-\d{2})_report-\d+-sektor_(.+)$/);
    if (standardMatch) {
      date = standardMatch[1];
      sector = standardMatch[2];
      type = 'standard';
    }
    
    // Pattern for classified reports: 2024_MM_DD
    const classifiedMatch = baseName.match(/^(\d{4})_(\d{2})_(\d{2})$/);
    if (classifiedMatch) {
      date = `${classifiedMatch[1]}-${classifiedMatch[2]}-${classifiedMatch[3]}`;
      type = 'classified';
    }
    
    return {
      filename: baseName,
      date,
      sector,
      type,
      source
    };
  }
}
