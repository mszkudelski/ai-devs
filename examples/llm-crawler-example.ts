import { LLMCrawlerService } from '../src/services/llm-crawler.service.js';

async function runExample() {
  // Initialize the LLMCrawlerService
  const crawler = new LLMCrawlerService();
  
  // Define a question
  const question = {
    question: "What technologies does the website use?",
    systemInstructions: "As an expert web technology analyst, carefully identify technologies, frameworks, and programming languages mentioned on the website."
  };
  
  // Start URL
  const startUrl = 'https://example.com';
  
  // Run the crawler
  console.log(`Starting web crawl for question: "${question.question}"`);
  const result = await crawler.crawlWebsite(startUrl, question);
  
  // Display the results
  console.log('\n=== RESULTS ===');
  console.log(`Answer: ${result.answer}`);
  console.log(`Pages visited: ${result.visitedPages}`);
  console.log(`Pages scraped: ${result.scrapedPages}`);
  console.log(`Answer found: ${result.answerFound ? 'Yes' : 'No'}`);
}

// Run the example
runExample()
  .then(() => console.log('Example completed successfully'))
  .catch(error => console.error('Error running example:', error));
