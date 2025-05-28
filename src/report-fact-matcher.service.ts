import { FactContextCheckerService } from './fact-context-checker.service.js';
import { FactCategorizerService } from './fact-categorizer.service.js';
import type { CategorizedFact } from './types/fact-categorizer.types.js';

export interface ReportFactMatch {
  reportId: string;
  reportSummary: string;
  reportKeywords: string[];
  relevantFacts: CategorizedFact[];
  relevanceScores: Array<{
    factId: string;
    score: number;
    reasoning: string;
  }>;
}

export interface ReportFactMatcherConfig {
  relevanceThreshold?: number;
  enableLogging?: boolean;
  maxConcurrentRequests?: number;
}

export class ReportFactMatcherService {
  private factContextChecker: FactContextCheckerService;
  private factCategorizer: FactCategorizerService;
  private config: Required<ReportFactMatcherConfig>;

  constructor(
    factCategorizerConfig: {
      factsInputDirectory: string;
      factsOutputDirectory: string;
    },
    config: ReportFactMatcherConfig = {}
  ) {
    this.config = {
      relevanceThreshold: config.relevanceThreshold || 0.7,
      enableLogging: config.enableLogging !== false,
      maxConcurrentRequests: config.maxConcurrentRequests || 3,
    };

    this.factContextChecker = new FactContextCheckerService({
      relevanceThreshold: this.config.relevanceThreshold,
      enableLogging: this.config.enableLogging,
    });

    this.factCategorizer = new FactCategorizerService({
      inputDirectory: factCategorizerConfig.factsInputDirectory,
      outputDirectory: factCategorizerConfig.factsOutputDirectory,
      enableLogging: this.config.enableLogging,
    });
  }

  async findRelevantFactsForReport(
    reportSummary: string,
    reportKeywords: string[],
    reportId: string
  ): Promise<ReportFactMatch> {
    this.log(`Finding relevant facts for report ${reportId}...`);

    // Get all available facts
    const allFacts = await this.factCategorizer.getAllCategorizedFacts();
    this.log(`Loaded ${allFacts.length} facts for analysis`);

    // Create a prompt that includes both summary and keywords
    const userPrompt = this.createReportPrompt(reportSummary, reportKeywords, reportId);

    // Find relevant facts using the context checker
    const relevantFacts = await this.factContextChecker.getRelevantFacts(userPrompt, allFacts);

    // Get detailed relevance scores for logging
    const relevanceScores = await this.getDetailedRelevanceScores(userPrompt, relevantFacts);

    this.log(`Found ${relevantFacts.length} relevant facts for report ${reportId}`);

    return {
      reportId,
      reportSummary,
      reportKeywords,
      relevantFacts,
      relevanceScores,
    };
  }

  async findRelevantFactsForMultipleReports(
    reports: Array<{
      id: string;
      summary: string;
      keywords: string[];
    }>
  ): Promise<ReportFactMatch[]> {
    this.log(`Processing ${reports.length} reports for fact matching...`);

    const results: ReportFactMatch[] = [];

    // Process reports in batches to avoid overwhelming the API
    for (let i = 0; i < reports.length; i += this.config.maxConcurrentRequests) {
      const batch = reports.slice(i, i + this.config.maxConcurrentRequests);
      
      const batchPromises = batch.map(report => 
        this.findRelevantFactsForReport(report.summary, report.keywords, report.id)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      this.log(`Completed batch ${Math.floor(i / this.config.maxConcurrentRequests) + 1}/${Math.ceil(reports.length / this.config.maxConcurrentRequests)}`);

      // Add delay between batches to respect rate limits
      if (i + this.config.maxConcurrentRequests < reports.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async loadCategorizedReports(reportsDirectory: string): Promise<CategorizedFact[]> {
    this.log(`Loading categorized reports from ${reportsDirectory}...`);
    
    const reportsFactCategorizer = new FactCategorizerService({
      inputDirectory: reportsDirectory,
      outputDirectory: reportsDirectory,
      enableLogging: this.config.enableLogging,
    });

    const reports = await reportsFactCategorizer.getAllCategorizedFacts();
    this.log(`Loaded ${reports.length} categorized reports`);
    
    await reportsFactCategorizer.shutdown();
    return reports;
  }

  private createReportPrompt(summary: string, keywords: string[], reportId: string): string {
    return `Analyze this factory report for relevant context:

Report ID: ${reportId}
Report Summary: ${summary}
Report Keywords: ${keywords.join(', ')}

Find facts that are relevant to understanding the people, locations, events, equipment, or procedures mentioned in this report. Consider both direct mentions and contextual connections.`;
  }

  private async getDetailedRelevanceScores(
    userPrompt: string, 
    facts: CategorizedFact[]
  ): Promise<Array<{ factId: string; score: number; reasoning: string }>> {
    const scores: Array<{ factId: string; score: number; reasoning: string }> = [];

    for (const fact of facts) {
      try {
        const response = await this.factContextChecker.checkFactRelevance({
          userPrompt,
          fact: {
            id: fact.id,
            summary: fact.summary,
            keywords: fact.keywords,
            fullContent: fact.fullContent,
          },
        });

        scores.push({
          factId: fact.id,
          score: response.relevanceScore,
          reasoning: response.reasoning,
        });
      } catch (error) {
        this.log(`Error getting relevance score for fact ${fact.id}: ${error}`);
        scores.push({
          factId: fact.id,
          score: 0,
          reasoning: 'Error during relevance check',
        });
      }
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ReportFactMatcher] ${message}`);
    }
  }

  async shutdown(): Promise<void> {
    await this.factContextChecker.shutdown();
    await this.factCategorizer.shutdown();
  }
}
