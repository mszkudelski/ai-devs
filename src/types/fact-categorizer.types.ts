export interface CategorizedFact {
  id: string;
  fullContent: string;
  summary: string;
  keywords: string[];
}

export interface FactCategorizerConfig {
  inputDirectory: string;
  outputDirectory: string;
  model?: string;
  fileExtension?: string;
}

export interface CategorizationPromptConfig {
  summaryLanguage?: string;
  keywordsLanguage?: string;
  summaryLength?: 'short' | 'medium' | 'long';
  keywordsCount?: number;
  customInstructions?: string;
}

export interface CategorizationResult {
  summary: string;
  keywords: string[];
}

export interface ProcessingStats {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  processingTime: number;
}

export interface FactCategorizerOptions extends FactCategorizerConfig {
  promptConfig?: CategorizationPromptConfig;
  retryAttempts?: number;
  batchSize?: number;
  enableLogging?: boolean;
}

export type FactProcessor = (fact: CategorizedFact) => Promise<CategorizedFact>;
export type ErrorHandler = (error: Error, context: string) => void;