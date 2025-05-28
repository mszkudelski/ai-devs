export interface Fact {
  id: string;
  summary: string;
  keywords: string[];
  fullContent?: string;
}

export interface FactRelevanceRequest {
  userPrompt: string;
  fact: Fact;
}

export interface FactRelevanceResponse {
  isRelevant: boolean;
  relevanceScore: number;
  reasoning: string;
}

export interface FactContextCheckerConfig {
  model?: string;
  relevanceThreshold?: number;
  enableLogging?: boolean;
}