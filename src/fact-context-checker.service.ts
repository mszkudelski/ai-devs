import { OpenAIService } from './openai.service.js';
import { FactCategorizerService } from './fact-categorizer.service.js';
import type { CategorizedFact } from './types/fact-categorizer.types.js';
import type {
  FactRelevanceRequest,
  FactRelevanceResponse,
  FactContextCheckerConfig,
} from './types/fact-context-checker.types.js';

export class FactContextCheckerService {
  private openaiService: OpenAIService;
  private config: FactContextCheckerConfig;

  constructor(config: FactContextCheckerConfig = {}) {
    this.openaiService = new OpenAIService();
    this.config = {
      relevanceThreshold: config.relevanceThreshold || 0.7,
      enableLogging: config.enableLogging !== false,
    };
  }

  async getAllFacts(factCategorizer: FactCategorizerService): Promise<CategorizedFact[]> {
    return await factCategorizer.getAllCategorizedFacts();
  }

  async checkFactRelevance(request: FactRelevanceRequest): Promise<FactRelevanceResponse> {
    const prompt = this.createRelevancePrompt(request);
    const response = await this.openaiService.getChatResponse(prompt, this.config.model);
    return this.parseResponse(response);
  }

  async getRelevantFacts(userPrompt: string, facts: CategorizedFact[]): Promise<CategorizedFact[]> {
    const relevantFacts: CategorizedFact[] = [];

    for (const fact of facts) {
      const request: FactRelevanceRequest = {
        userPrompt,
        fact: {
          id: fact.id,
          summary: fact.summary,
          keywords: fact.keywords,
          fullContent: fact.fullContent,
        },
      };

      const response = await this.checkFactRelevance(request);

      if (response.isRelevant && response.relevanceScore >= this.config.relevanceThreshold!) {
        relevantFacts.push(fact);
        this.log(`✓ ${fact.id}: ${response.relevanceScore.toFixed(2)} - ${response.reasoning}`);
      } else {
        this.log(`✗ ${fact.id}: ${response.relevanceScore.toFixed(2)} - ${response.reasoning}`);
      }
    }

    return relevantFacts;
  }

  private createRelevancePrompt(request: FactRelevanceRequest): string {
    return `Determine if this fact is relevant to the user's prompt.

User prompt: "${request.userPrompt}"

Fact:
Summary: ${request.fact.summary}
Keywords: ${request.fact.keywords.join(', ')}

Analyze if this fact should be included in the context for answering the user's prompt.

Respond in JSON format:
{
  "isRelevant": boolean,
  "relevanceScore": number (0.0 to 1.0),
  "reasoning": "brief explanation"
}`;
  }

  private parseResponse(response: string): FactRelevanceResponse {
    try {
      const parsed = JSON.parse(response);
      return {
        isRelevant: parsed.isRelevant,
        relevanceScore: Math.max(0, Math.min(1, parsed.relevanceScore)),
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      throw new Error(`Failed to parse response: ${error}`);
    }
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[FactContextChecker] ${message}`);
    }
  }

  async shutdown(): Promise<void> {
    await this.openaiService.shutdown();
  }
}
