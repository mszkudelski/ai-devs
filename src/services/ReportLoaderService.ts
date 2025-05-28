import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { VectorService, ReportPoint } from './VectorService.js';

export class ReportLoaderService {
  private vectorService: VectorService;

  constructor() {
    this.vectorService = new VectorService();
  }

  async loadReportsFromDirectory(directoryPath: string): Promise<ReportPoint[]> {
    const reports: ReportPoint[] = [];
    
    try {
      const files = fs.readdirSync(directoryPath);
      const txtFiles = files.filter(file => file.endsWith('.txt'));
      
      console.log(`Found ${txtFiles.length} text files in ${directoryPath}`);
      
      for (const file of txtFiles) {
        const filePath = path.join(directoryPath, file);
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        
        if (content) {
          const metadata = VectorService.extractMetadataFromFilename(file, directoryPath);
          const report: ReportPoint = {
            id: uuidv4(),
            text: content,
            metadata
          };
          
          reports.push(report);
        }
      }
      
      return reports;
    } catch (error) {
      console.error(`Error loading reports from ${directoryPath}:`, error);
      throw error;
    }
  }

  async loadAllReports(): Promise<ReportPoint[]> {
    const allReports: ReportPoint[] = [];
    
    // Load standard reports
    const standardReportsPath = '/Users/marek.szkudelski/cursor/ai-devs-tasks/data/pliki_z_fabryki';
    const standardReports = await this.loadReportsFromDirectory(standardReportsPath);
    allReports.push(...standardReports);
    
    // Load classified reports
    const classifiedReportsPath = '/Users/marek.szkudelski/cursor/ai-devs-tasks/data/pliki_z_fabryki/do-not-share';
    const classifiedReports = await this.loadReportsFromDirectory(classifiedReportsPath);
    allReports.push(...classifiedReports);
    
    console.log(`Loaded total of ${allReports.length} reports`);
    return allReports;
  }

  async initializeVectorDatabase(): Promise<void> {
    try {
      console.log('Initializing vector database...');
      
      // Ensure collection exists
      await this.vectorService.ensureReportsCollection();
      
      // Load all reports
      const reports = await this.loadAllReports();
      
      if (reports.length > 0) {
        // Add reports to vector database
        await this.vectorService.addReports(reports);
        console.log('Vector database initialized successfully');
      } else {
        console.log('No reports found to add to vector database');
      }
      
      // Show collection info
      const info = await this.vectorService.getCollectionInfo();
      console.log('Collection info:', {
        points_count: info.points_count,
        status: info.status
      });
      
    } catch (error) {
      console.error('Error initializing vector database:', error);
      throw error;
    }
  }

  async searchReports(query: string, options: {
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    sector?: string;
    type?: 'standard' | 'classified' | 'other';
  } = {}) {
    try {
      const { limit = 5, dateFrom, dateTo, sector, type } = options;
      
      let results;
      
      if (sector) {
        results = await this.vectorService.searchReportsBySector(query, sector, limit);
      } else if (type) {
        results = await this.vectorService.searchReportsByType(query, type, limit);
      } else if (dateFrom || dateTo) {
        results = await this.vectorService.searchReportsByDate(query, dateFrom, dateTo, limit);
      } else {
        results = await this.vectorService.searchReports(query, limit);
      }
      
      return results.map((result: any) => ({
        score: result.score,
        filename: result.payload?.filename,
        date: result.payload?.date,
        sector: result.payload?.sector,
        type: result.payload?.type,
        text: result.payload?.text,
        source: result.payload?.source
      }));
    } catch (error) {
      console.error('Error searching reports:', error);
      throw error;
    }
  }

  getVectorService(): VectorService {
    return this.vectorService;
  }
}
