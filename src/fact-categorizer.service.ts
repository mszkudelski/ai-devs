import fs from 'fs/promises';
import path from 'path';
import { OpenAIService } from './openai.service.js';
import type {
  CategorizedFact,
  FactCategorizerConfig,
  CategorizationPromptConfig,
  CategorizationResult,
  ProcessingStats,
  FactCategorizerOptions,
  FactProcessor,
  ErrorHandler,
} from './types/fact-categorizer.types.js';

export class FactCategorizerService {
  private openaiService: OpenAIService;
  private config: FactCategorizerConfig;
  private promptConfig: CategorizationPromptConfig;
  private retryAttempts: number;
  private batchSize: number;
  private enableLogging: boolean;
  private onError?: ErrorHandler;
  private postProcessor?: FactProcessor;

  constructor(options: FactCategorizerOptions) {
    this.openaiService = new OpenAIService();
    this.config = {
      inputDirectory: options.inputDirectory,
      outputDirectory: options.outputDirectory,
      model: options.model,
      fileExtension: options.fileExtension || '.txt',
    };

    this.promptConfig = {
      summaryLanguage: 'Polish',
      keywordsLanguage: 'Polish',
      summaryLength: 'short',
      keywordsCount: 7,
      ...options.promptConfig,
    };

    this.retryAttempts = options.retryAttempts || 3;
    this.batchSize = options.batchSize || 5;
    this.enableLogging = options.enableLogging !== false;
  }

  setErrorHandler(handler: ErrorHandler): void {
    this.onError = handler;
  }

  setPostProcessor(processor: FactProcessor): void {
    this.postProcessor = processor;
  }

  async categorizeAllFacts(): Promise<{ facts: CategorizedFact[]; stats: ProcessingStats }> {
    const startTime = Date.now();
    this.log(`Starting fact categorization process from ${this.config.inputDirectory}...`);

    await this.ensureOutputDirectory();
    const factFiles = await this.getFactFiles();

    this.log(`Found ${factFiles.length} fact files to process`);

    const results: CategorizedFact[] = [];
    const stats: ProcessingStats = {
      totalFiles: factFiles.length,
      processedFiles: 0,
      failedFiles: 0,
      processingTime: 0,
    };

    // Process files in batches
    for (let i = 0; i < factFiles.length; i += this.batchSize) {
      const batch = factFiles.slice(i, i + this.batchSize);
      await this.processBatch(batch, results, stats);
    }

    stats.processingTime = Date.now() - startTime;
    this.log(
      `Fact categorization process completed! Processed: ${stats.processedFiles}, Failed: ${stats.failedFiles}`
    );

    return { facts: results, stats };
  }

  async categorizeSingleFact(fileName: string): Promise<CategorizedFact> {
    await this.ensureOutputDirectory();
    return await this.categorizeFact(fileName);
  }

  async categorizeFromText(text: string, id: string): Promise<CategorizedFact> {
    const result = await this.getCategorization(text);

    let categorizedFact: CategorizedFact = {
      id,
      fullContent: text.trim(),
      summary: result.summary,
      keywords: result.keywords,
    };

    if (this.postProcessor) {
      categorizedFact = await this.postProcessor(categorizedFact);
    }

    return categorizedFact;
  }

  async categorizeAndSave(text: string, id: string): Promise<CategorizedFact> {
    const categorizedFact = await this.categorizeFromText(text, id);
    await this.saveCategorizedFact(categorizedFact);
    return categorizedFact;
  }

  private async processBatch(
    batch: string[],
    results: CategorizedFact[],
    stats: ProcessingStats
  ): Promise<void> {
    const promises = batch.map(async (fileName) => {
      try {
        this.log(`Processing ${fileName}...`);
        const categorizedFact = await this.categorizeFact(fileName);
        await this.saveCategorizedFact(categorizedFact);
        results.push(categorizedFact);
        stats.processedFiles++;
        this.log(`✓ Completed ${fileName}`);
        return categorizedFact;
      } catch (error) {
        stats.failedFiles++;
        const errorMessage = `✗ Error processing ${fileName}: ${error}`;
        this.log(errorMessage);

        if (this.onError) {
          this.onError(error as Error, fileName);
        } else {
          console.error(errorMessage);
        }
        return null;
      }
    });

    await Promise.all(promises);
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.access(this.config.outputDirectory);
    } catch {
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
    }
  }

  private async getFactFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.inputDirectory);
      return files.filter((file) => file.endsWith(this.config.fileExtension || '.txt')).sort();
    } catch (error) {
      throw new Error(`Failed to read input directory ${this.config.inputDirectory}: ${error}`);
    }
  }

  private async categorizeFact(fileName: string): Promise<CategorizedFact> {
    const filePath = path.join(this.config.inputDirectory, fileName);
    const fullContent = await fs.readFile(filePath, 'utf-8');
    const id = path.basename(fileName, this.config.fileExtension);
    return await this.categorizeFromText(fullContent, id);
  }

  private async getCategorization(text: string): Promise<CategorizationResult> {
    const prompt = this.createCategorizationPrompt(text);

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.openaiService.getChatResponse(prompt);
        return this.parseCategorizationResponse(response);
      } catch (error) {
        this.log(`Attempt ${attempt} failed: ${error}`);
        if (attempt === this.retryAttempts) {
          throw new Error(`Failed to categorize after ${this.retryAttempts} attempts: ${error}`);
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Unexpected error in categorization');
  }

  private createCategorizationPrompt(text: string): string {
    const summaryLengthInstruction = this.getSummaryLengthInstruction();
    const customInstructions = this.promptConfig.customInstructions
      ? `\nAdditional instructions: ${this.promptConfig.customInstructions}`
      : '';

    return `Analyze the following text and provide:
1. A summary ${summaryLengthInstruction} (in ${this.promptConfig.summaryLanguage})
2. ${this.promptConfig.keywordsCount} relevant keywords (in ${this.promptConfig.keywordsLanguage})${customInstructions}

Text to analyze:
${text}

Please respond in JSON format:
{
  "summary": "your summary here",
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}`;
  }

  private getSummaryLengthInstruction(): string {
    switch (this.promptConfig.summaryLength) {
      case 'short':
        return 'in 1-2 sentences';
      case 'medium':
        return 'in 3-4 sentences';
      case 'long':
        return 'in 5-6 sentences';
      default:
        return 'in 1-2 sentences';
    }
  }

  private parseCategorizationResponse(response: string): CategorizationResult {
    try {
      const parsed = JSON.parse(response);

      if (!parsed.summary || !Array.isArray(parsed.keywords)) {
        throw new Error('Invalid response format: missing summary or keywords');
      }

      return {
        summary: parsed.summary,
        keywords: parsed.keywords,
      };
    } catch (error) {
      throw new Error(`Failed to parse OpenAI response: ${error}`);
    }
  }

  private async saveCategorizedFact(categorizedFact: CategorizedFact): Promise<void> {
    const outputPath = path.join(this.config.outputDirectory, `${categorizedFact.id}.json`);
    const jsonContent = JSON.stringify(categorizedFact, null, 2);
    await fs.writeFile(outputPath, jsonContent, 'utf-8');
  }

  private log(message: string): void {
    if (this.enableLogging) {
      console.log(message);
    }
  }

  async loadCategorizedFact(id: string): Promise<CategorizedFact | null> {
    try {
      const filePath = path.join(this.config.outputDirectory, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async getAllCategorizedFacts(): Promise<CategorizedFact[]> {
    try {
      const files = await fs.readdir(this.config.outputDirectory);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      const facts: CategorizedFact[] = [];
      for (const file of jsonFiles) {
        const filePath = path.join(this.config.outputDirectory, file);
        const content = await fs.readFile(filePath, 'utf-8');
        facts.push(JSON.parse(content));
      }

      return facts.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      throw new Error(`Failed to load categorized facts: ${error}`);
    }
  }

  async searchFactsByKeywords(keywords: string[]): Promise<CategorizedFact[]> {
    const allFacts = await this.getAllCategorizedFacts();
    return allFacts.filter((fact) =>
      keywords.some((keyword) =>
        fact.keywords.some((factKeyword) =>
          factKeyword.toLowerCase().includes(keyword.toLowerCase())
        )
      )
    );
  }

  async getStats(): Promise<ProcessingStats> {
    const allFacts = await this.getAllCategorizedFacts();
    return {
      totalFiles: allFacts.length,
      processedFiles: allFacts.length,
      failedFiles: 0,
      processingTime: 0,
    };
  }

  async shutdown(): Promise<void> {
    await this.openaiService.shutdown();
  }
}

export type {
  CategorizedFact,
  FactCategorizerConfig,
  FactCategorizerOptions,
} from './types/fact-categorizer.types.js';
