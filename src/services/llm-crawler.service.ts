import { WebCrawlerService, ScrapedData } from './web-crawler.service.js';
import { OpenAIService } from '../openai.service.js';
import { extractFromTags } from '../utils.js';

export interface CrawlQuestion {
  question: string;
  systemInstructions?: string;
  userInstructions?: string;
}

export interface AnswerResult {
  hasAnswer: boolean;
  answer?: string;
  nextUrl?: string;
}

export interface CrawlResult {
  answer: string;
  visitedPages: number;
  scrapedPages: number;
  answerFound: boolean;
}

/**
 * Service for answering questions by crawling websites with LLM guidance
 */
export class LLMCrawlerService {
  private webCrawlerService: WebCrawlerService;
  private openaiService: OpenAIService;
  private globalQueue: string[] = [];

  /**
   * Constructor for LLMCrawlerService
   * @param openaiService OpenAI Service instance (if not provided, creates a new one)
   * @param webCrawlerService WebCrawlerService instance (if not provided, creates a new one)
   * @param maxPages Maximum number of pages to crawl (default: 20)
   * @param maxAttempts Maximum attempts per question (default: 15)
   * @param modelName OpenAI model to use (default: 'gpt-4.1-mini')
   */
  constructor(
    openaiService?: OpenAIService,
    webCrawlerService?: WebCrawlerService,
    private maxPages: number = 20,
    private maxAttempts: number = 15,
    private modelName: string = 'gpt-4.1-mini'
  ) {
    this.openaiService = openaiService || new OpenAIService();
    this.webCrawlerService = webCrawlerService || new WebCrawlerService(maxPages);
  }

  /**
   * Crawl a website to answer a specific question
   * @param startUrl Starting URL for crawler
   * @param crawlQuestion The question to answer with optional instructions
   * @param maxPages Override for maximum pages to crawl
   * @returns Object with answer and crawling statistics
   */
  public async crawlWebsite(
    startUrl: string, 
    crawlQuestion: CrawlQuestion | string, 
    maxPages?: number
  ): Promise<CrawlResult> {
    // Handle string input conversion to CrawlQuestion
    const question = typeof crawlQuestion === 'string' 
      ? { question: crawlQuestion } 
      : crawlQuestion;
    
    if (maxPages) {
      this.maxPages = maxPages;
      this.webCrawlerService = new WebCrawlerService(maxPages);
    }

    // Reset the state for a new crawl
    this.webCrawlerService.reset();
    this.globalQueue = [startUrl];

    console.log(`Starting model-driven web crawl from ${startUrl} to find answer to: "${question.question}"`);

    let answer: string = "Information not found";
    let answerFound: boolean = false;

    // Process the URL and start crawling
    if (this.globalQueue.length > 0) {
      const url = this.globalQueue.shift()!;
      const { links } = await this.webCrawlerService.processUrl(url);
      this.addLinksToQueue(links);
      
      const result = await this.findAnswerThroughCrawling(question);
      answer = result.answer;
      answerFound = result.found;
    }

    const visited = this.webCrawlerService.getVisited();
    const scrapedData = this.webCrawlerService.getScrapedData();
    
    console.log(`Crawling complete. Visited ${visited.size} pages, collected ${scrapedData.length} pages.`);
    console.log(`Answer found: ${answerFound ? "YES" : "NO"}`);

    return {
      answer,
      visitedPages: visited.size,
      scrapedPages: scrapedData.length,
      answerFound
    };
  }

  /**
   * Find an answer by analyzing scraped data and requesting more scraping as needed
   * @param question Question to answer with optional instructions
   * @returns The answer text and whether an answer was found
   */
  private async findAnswerThroughCrawling(
    question: CrawlQuestion
  ): Promise<{ answer: string; found: boolean }> {
    let attempts = 0;
    const maxAttempts = Math.min(this.maxAttempts, this.maxPages - this.webCrawlerService.getVisited().size);
    
    // Available links to explore (all unexplored links)
    let availableLinks = this.globalQueue.filter(
      url => !this.webCrawlerService.getVisited().has(url)
    );
    
    let finalAnswer: string | undefined;
    let answerFound = false;
    
    // Question-specific agent loop
    while (attempts < maxAttempts && !finalAnswer) {
      const scrapedData = this.webCrawlerService.getScrapedData();
      const result = await this.analyzeAndAnswer(question, scrapedData, availableLinks);
      
      if (result.hasAnswer) {
        // Make sure the answer doesn't contain scrape_url tags
        if (result.answer && !result.answer.includes('<scrape_url>')) {
          finalAnswer = result.answer;
          answerFound = true;
          console.log(`✓ Found answer: "${finalAnswer}"`);
        } else {
          // If it contains scrape_url tags, we need to parse and follow that URL
          console.log(`Answer contains scrape_url tags. Processing as URL request instead.`);
          
          // Extract the URL from the scrape_url tag if present
          const urlMatch = result.answer?.match(/<scrape_url>(.*?)<\/scrape_url>/);
          if (urlMatch && urlMatch[1]) {
            const extractedUrl = urlMatch[1].trim();
            if (!this.webCrawlerService.getVisited().has(extractedUrl)) {
              console.log(`Extracted URL from tags: ${extractedUrl}`);
              const { links } = await this.webCrawlerService.processUrl(extractedUrl);
              this.addLinksToQueue(links);
              
              // Update available links after processing the page
              availableLinks = this.globalQueue.filter(
                url => !this.webCrawlerService.getVisited().has(url)
              );
            }
          }
        }
      } else if (result.nextUrl) {
        // The model wants to explore a specific URL
        const urlToScrape = result.nextUrl;
        
        // Check if this URL is valid and not already visited
        if (!this.webCrawlerService.getVisited().has(urlToScrape)) {
          console.log(`Model requested to scrape: ${urlToScrape}`);
          const { links } = await this.webCrawlerService.processUrl(urlToScrape);
          this.addLinksToQueue(links);
          
          // Update available links after processing the page
          availableLinks = this.globalQueue.filter(
            url => !this.webCrawlerService.getVisited().has(url)
          );
        } else {
          console.log(`URL already visited: ${urlToScrape}. Asking model to choose another.`);
        }
      } else {
        // Should not reach here if analyzeAndAnswer is implemented correctly
        console.log("Model response unclear. Moving to next attempt.");
      }
      
      attempts++;
      
      // If we're out of links and still don't have an answer, try one final time
      // with all the data we've collected
      if (availableLinks.length === 0 && !finalAnswer && attempts === maxAttempts - 1) {
        console.log("No more links to explore. Attempting final analysis with all collected data.");
        const finalResult = await this.analyzeAndAnswer(question, 
          this.webCrawlerService.getScrapedData(), []);
        if (finalResult.hasAnswer && !finalResult.answer?.includes('<scrape_url>')) {
          finalAnswer = finalResult.answer;
          answerFound = true;
        } else {
          finalAnswer = "Information not found";
        }
      }
    }
    
    // Final validation check - ensure we never store answers with tags
    let cleanFinalAnswer = finalAnswer || "Information not found";
    
    // Check for scrape_url tags specifically
    if (cleanFinalAnswer.includes('<scrape_url>')) {
      console.error(`CRITICAL: Final answer still contains scrape_url tags! Replacing with default.`);
      cleanFinalAnswer = "Information not found";
    }
    
    // Remove any possible HTML tags as a final safety measure
    cleanFinalAnswer = cleanFinalAnswer.replace(/<[^>]*>/g, '').trim();
    if (!cleanFinalAnswer) {
      cleanFinalAnswer = "Information not found";
    }
    
    return { answer: cleanFinalAnswer, found: answerFound };
  }

  /**
   * Add new links to the global queue
   * @param links Array of links to add
   */
  private addLinksToQueue(links: string[]): void {
    // Filter out already visited or queued links
    const newLinks = links.filter(
      url => !this.webCrawlerService.getVisited().has(url) && !this.globalQueue.includes(url)
    );
    
    // Add new links to the queue
    this.globalQueue.push(...newLinks);
  }

  /**
   * Analyzes scraped data to either answer a specific question or request more scraping
   * @param question The question object with optional instructions
   * @param scrapedData Array of scraped data
   * @param availableLinks Array of available links that can be scrape next
   * @returns An object with either the answer or the next URL to scrape
   */
  private async analyzeAndAnswer(
    question: CrawlQuestion, 
    scrapedData: ScrapedData[],
    availableLinks: string[] = []
  ): Promise<AnswerResult> {
    console.log(`Analyzing data for question: "${question.question}"`);
    
    // Create appropriate prompts based on system/user instructions
    const systemPrompt = this.createSystemPrompt(question);
    const userPrompt = this.createUserPrompt(question, scrapedData, availableLinks);
    
    // Use the specified model with separate system and user prompts
    const response = await this.openaiService.getChatResponseWithMessages([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], this.modelName);
    
    // Look for the full response text to analyze
    console.log(`Model response length: ${response.length} characters`);
    
    // First check if the AI provided an answer
    const answer = extractFromTags(response, 'answer');
    if (answer) {
      // Verify the answer doesn't contain scrape_url tags
      if (answer.includes('<scrape_url>')) {
        console.warn(`Found <scrape_url> tags inside an answer! Treating as URL request instead.`);
        // Extract the URL and return it as a next URL to scrape
        const urlMatch = answer.match(/<scrape_url>(.*?)<\/scrape_url>/);
        if (urlMatch && urlMatch[1]) {
          const extractedUrl = urlMatch[1].trim();
          console.log(`Extracted URL from nested tags: ${extractedUrl}`);
          return { hasAnswer: false, nextUrl: extractedUrl };
        }
        // If we can't extract a URL, continue on to other extraction methods
      } else {
        // Make sure the answer doesn't contain any tags at all
        const cleanAnswer = answer.replace(/<[^>]*>/g, '').trim();
        console.log(`Answer found: "${cleanAnswer}"`);
        return { hasAnswer: true, answer: cleanAnswer };
      }
    }
    
    // Check if the AI requested more scraping
    const nextUrl = extractFromTags(response, 'scrape_url');
    if (nextUrl) {
      // Clean up the URL just in case it has whitespace or other issues
      const cleanUrl = nextUrl.trim();
      console.log(`Model requested to scrape URL: ${cleanUrl}`);
      return { hasAnswer: false, nextUrl: cleanUrl };
    }
    
    // If we're here, check if there's a scrape_url tag in the full response
    // This is a fallback in case the extractFromTags function missed something
    const scrapeUrlMatch = response.match(/<scrape_url>(.*?)<\/scrape_url>/);
    if (scrapeUrlMatch && scrapeUrlMatch[1]) {
      const extractedUrl = scrapeUrlMatch[1].trim();
      console.log(`Found scrape_url in full response: ${extractedUrl}`);
      return { hasAnswer: false, nextUrl: extractedUrl };
    }
    
    // Check if the response contains a URL that seems relevant, especially if no links are available
    if (availableLinks.length === 0 && scrapedData.length > 0) {
      // Look for any URLs in the model's response that might be useful
      const urlPattern = /(https?:\/\/[^\s]+)/g;
      const urls = response.match(urlPattern);
      
      if (urls && urls.length > 0) {
        const cleanUrl = urls[0].replace(/[^\w\s:\/.-]/g, ''); // Remove punctuation that might be part of the match
        console.log(`No explicit scrape_url tag, but found URL in response: ${cleanUrl}`);
        return { hasAnswer: false, nextUrl: cleanUrl };
      }
    }
    
    // Default case if no answer or URL was extracted
    console.log(`No clear answer or URL request found. Treating as "Information not found"`);
    return { hasAnswer: true, answer: "Information not found" };
  }

  /**
   * Create a system prompt for the LLM combining default instructions with user-provided ones
   * @param question The question object with optional system instructions
   * @returns Formatted system prompt string
   */
  private createSystemPrompt(question: CrawlQuestion): string {
    const defaultSystemPrompt = `You are an AI web agent tasked with finding information from web pages to answer a specific question.

CRITICAL INSTRUCTIONS:
- When answering, NEVER include <scrape_url> tags inside <answer> tags
- If you have the answer, respond ONLY with <answer>exact plain text answer</answer> 
- If you need more data, respond ONLY with <scrape_url>URL</scrape_url>
- NEVER mix these two tag types together
- Be precise - the answer should be explicitly found in the content
- If you're not 100% confident in the answer, request to scrape more pages first
- If the answer cannot be found after checking all relevant pages, respond with <answer>Information not found</answer>

INSTRUCTIONS:
1. If you have DEFINITIVE information to answer the question accurately, respond with:
<answer>exact answer text</answer>

2. If you DON'T have enough information yet, request to scrape a specific URL by responding with:
<scrape_url>URL to scrape next</scrape_url>

Make your decision based solely on the content provided. Have you found the answer, or do you need to scrape another page?`;

    return question.systemInstructions 
      ? `${defaultSystemPrompt}\n\n${question.systemInstructions}`
      : defaultSystemPrompt;
  }

  /**
   * Create a user prompt for the LLM to analyze data and answer a question or request more scraping
   * @param question The question object with optional user instructions
   * @param scrapedData Array of scraped data
   * @param availableLinks Array of available links to scrape
   * @returns Formatted user prompt string
   */
  private createUserPrompt(
    question: CrawlQuestion,
    scrapedData: ScrapedData[],
    availableLinks: string[] = []
  ): string {
    // The main question becomes the primary user prompt
    let userPrompt = `${question.question}

Below is the content I've scraped so far from various web pages:

${scrapedData.map((data, index) => `
SOURCE ${index + 1} (URL: ${data.url}):
${data.content.substring(0, 1500)}${data.content.length > 1500 ? '... [content truncated]' : ''}
`).join('\n\n')}

${availableLinks.length > 0 ? `Here are links I found but haven't visited yet:
${availableLinks.map((url, i) => `${i + 1}. ${url}`).join('\n')}` : 'No additional links available to scrape.'}`;

    // Add any user-specific instructions if provided
    return question.userInstructions 
      ? `${userPrompt}\n\n${question.userInstructions}`
      : userPrompt;
  }
}
