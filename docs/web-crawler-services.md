# Web Crawler and LLM Crawler Services

This document provides usage examples for the `WebCrawlerService` and `LLMCrawlerService` that have been implemented for crawling websites and answering questions based on the content.

## WebCrawlerService

The `WebCrawlerService` provides functionality to crawl websites, extract content, and process structured information (emails, URLs, addresses, etc.).

### Basic Usage

```typescript
import { WebCrawlerService } from '../../src/services/web-crawler.service.js';

// Create a new crawler with max 20 pages limit
const crawler = new WebCrawlerService(20);

// Process a single URL
const result = await crawler.processUrl('https://example.com');
console.log(`Processed URL: ${result.data.url}`);
console.log(`Found ${result.links.length} links`);

// Process multiple URLs
const urls = ['https://example.com/page1', 'https://example.com/page2'];
const results = await crawler.processUrls(urls);

// Get scraped data and visited URLs
const scrapedData = crawler.getScrapedData();
const visitedUrls = crawler.getVisited();
```

### Example: Basic Website Scraping

```typescript
import { WebCrawlerService } from '../../src/services/web-crawler.service.js';

async function scrapeWebsite(startUrl: string, maxPages: number = 10): Promise<void> {
  const crawler = new WebCrawlerService(maxPages);
  
  // Process the initial URL
  const { links } = await crawler.processUrl(startUrl);
  
  // Process discovered links recursively
  const queue = [...links];
  const visited = new Set([startUrl]);
  
  while (queue.length > 0 && crawler.getVisited().size < maxPages) {
    const url = queue.shift()!;
    if (!visited.has(url)) {
      visited.add(url);
      const { links: newLinks } = await crawler.processUrl(url);
      queue.push(...newLinks.filter(link => !visited.has(link)));
    }
  }
  
  // Get all scraped data
  const scrapedData = crawler.getScrapedData();
  console.log(`Scraped ${scrapedData.length} pages`);
}

// Usage
scrapeWebsite('https://example.com');
```

## LLMCrawlerService

The `LLMCrawlerService` builds on top of the `WebCrawlerService` to intelligently crawl websites based on LLM guidance to answer specific questions.

### LLMCrawlerService Usage

```typescript
import { OpenAIService } from '../../src/openai.service.js';
import { WebCrawlerService } from '../../src/services/web-crawler.service.js';
import { LLMCrawlerService, Question } from '../../src/services/llm-crawler.service.js';

// Initialize services
const openaiService = new OpenAIService();
const webCrawlerService = new WebCrawlerService();
const llmCrawlerService = new LLMCrawlerService(openaiService, webCrawlerService);

// Define questions
const questions: Question[] = [
  { id: '1', question: 'What is the company address?' },
  { id: '2', question: 'Who is the CEO?' },
  { id: '3', question: 'What products do they offer?' }
];

// Start crawling to answer the questions
const startUrl = 'https://example.com';
const results = await llmCrawlerService.crawlWebsite(startUrl, questions);

// Process results
console.log('Answers:');
for (const [id, answer] of Object.entries(results.answers)) {
  console.log(`Question ${id}: ${answer}`);
}

console.log(`Crawling statistics:`);
console.log(`- Visited pages: ${results.visitedPages}`);
console.log(`- Scraped pages: ${results.scrapedPages}`);
console.log(`- Answered questions: ${results.answeredQuestions}/${results.totalQuestions}`);
```

### Custom Prompts

You can customize the analysis prompt used by the LLM to answer questions:

```typescript
import { LLMCrawlerService } from '../../src/services/llm-crawler.service.js';

// Create a new LLM crawler with custom settings
const llmCrawler = new LLMCrawlerService(
  undefined, // Use default OpenAI service
  undefined, // Use default WebCrawlerService
  20,        // Max pages
  15,        // Max attempts per question
  'gpt-4'    // Model to use
);

// Create a custom prompt
const customPrompt = llmCrawler.createAnalysisPrompt(
  "What is the company's mission statement?",
  [{url: "https://example.com", content: "Example content..."}],
  ["https://example.com/about", "https://example.com/mission"]
);

console.log(customPrompt);
```

## Full Example: Answering Questions from a Website

```typescript
import { OpenAIService } from '../../src/openai.service.js';
import { WebCrawlerService } from '../../src/services/web-crawler.service.js';
import { LLMCrawlerService, Question } from '../../src/services/llm-crawler.service.js';

async function answerQuestionsFromWebsite(
  startUrl: string,
  questions: Record<string, string>,
  maxPages: number = 20
): Promise<Record<string, string>> {
  // Initialize services
  const openaiService = new OpenAIService();
  const webCrawlerService = new WebCrawlerService();
  const llmCrawlerService = new LLMCrawlerService(openaiService, webCrawlerService, maxPages);
  
  // Format questions
  const formattedQuestions: Question[] = Object.entries(questions).map(([id, question]) => ({
    id,
    question
  }));
  
  // Crawl and get answers
  const result = await llmCrawlerService.crawlWebsite(startUrl, formattedQuestions);
  
  // Log statistics
  console.log(`Crawling statistics: Visited ${result.visitedPages} pages, ` + 
              `collected ${result.scrapedPages} pages, ` +
              `answered ${result.answeredQuestions}/${result.totalQuestions} questions`);
  
  return result.answers;
}

// Usage
const questions = {
  '01': 'What is the company address?',
  '02': 'Who is the CEO?',
  '03': 'What certifications does the company have?'
};

answerQuestionsFromWebsite('https://example.com', questions)
  .then(answers => {
    console.log('Answers:', answers);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```
