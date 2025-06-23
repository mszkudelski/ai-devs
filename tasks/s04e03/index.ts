import { getCentralDataUrl } from "../../src/url.js";
import { getRequest } from "../../src/api.js"; 
import { sendReport } from "../../src/report.js";
import { WebCrawlerService } from "../../src/services/web-crawler.service.js";
import { LLMCrawlerService, CrawlQuestion } from "../../src/services/llm-crawler.service.js";
import { OpenAIService } from "../../src/openai.service.js";

// Initialize services
const openaiService = new OpenAIService();
const webCrawlerService = new WebCrawlerService();
const llmCrawlerService = new LLMCrawlerService(openaiService, webCrawlerService);

interface SoftoData {
  "01": string;
  "02": string;
  "03": string;
}

/**
 * Fetches data from the softo.json endpoint
 * @returns The data from the endpoint
 */
async function fetchSoftoData(): Promise<Record<string, string>> {
  try {
    // Using getCentralDataUrl which automatically includes the API key
    const softoUrl = getCentralDataUrl('softo.json');
    console.log(`Fetching data from: ${softoUrl}`);
    
    const data = await getRequest<Record<string, string>>(softoUrl);
    console.log('Successfully fetched data');
    
    return data;
  } catch (error) {
    console.error('Error fetching softo data:', error);
    throw error;
  }
}

/**
 * Execute the main task logic
 */
async function executeTask(): Promise<SoftoData> {
  try {
    // Fetch questions from the API
    console.log('Starting softo task...');
    const questionsData = await fetchSoftoData();
    
    console.log(`Processing ${Object.keys(questionsData).length} questions`);
    Object.entries(questionsData).forEach(([id, question]) => {
      console.log(`- ${id}: ${question}`);
    });
    
    // Create result object to store answers
    const answers: SoftoData = {} as SoftoData;
    
    // Process each question individually with the new API
    const startUrl = 'https://softo.ag3nts.org';
    console.log(`Starting web crawl from: ${startUrl}`);
    
    // Process each question separately
    for (const [id, questionText] of Object.entries(questionsData)) {
      console.log(`\nProcessing question ${id}: "${questionText}"`);
      
      // Create a CrawlQuestion object with system instructions
      const crawlQuestion: CrawlQuestion = {
        question: questionText + "\nPlease provide short, concise answers.",
        systemInstructions: 
          "You are an AI assistant tasked with finding specific information from the Softo website. " +
          "Be precise and factual in your answers, only using information directly found in the content."
      };
      
      // Process this specific question
      const result = await llmCrawlerService.crawlWebsite(startUrl, crawlQuestion, 20);
      answers[id as keyof SoftoData] = result.answer;
      
      console.log(`Found answer for question ${id}: "${result.answer}"`);
      
      // Reset crawler state (though the service should do this internally)
      webCrawlerService.reset();
    }
    
    console.log('\nAll answers found:');
    Object.entries(answers).forEach(([id, answer]) => {
      console.log(`- ${id}: ${answer}`);
    });
    
    // Validate answers before submission - ensure no tags are present
    const validatedAnswers: SoftoData = { ...answers };
    Object.entries(validatedAnswers).forEach(([id, answer]) => {
      // Clean any potential tags or unwanted formatting
      let cleanAnswer = answer;
      
      // First check specifically for scrape_url tags
      if (typeof cleanAnswer === 'string' && cleanAnswer.includes('<scrape_url>')) {
        console.warn(`WARNING: Answer for ${id} contains scrape_url tags! Replacing with "Information not found"`);
        cleanAnswer = "Information not found";
      } else if (typeof cleanAnswer === 'string') {
        // Remove any HTML/XML tags
        cleanAnswer = cleanAnswer.replace(/<[^>]*>/g, '').trim();
        
        // Replace with default if empty after cleaning
        if (!cleanAnswer) {
          cleanAnswer = "Information not found";
        }
      }
      
      validatedAnswers[id as keyof SoftoData] = cleanAnswer;
      console.log(`Validated answer for ${id}: "${cleanAnswer}"`);
    });
    
    // Extra safety check - hard filter any answers with tags 
    const finalAnswers: SoftoData = { ...validatedAnswers };
    let hasFixedAnswers = false;
    
    // Final check to absolutely ensure no tags
    for (const id in finalAnswers) {
      const key = id as keyof SoftoData;
      const value = finalAnswers[key];
      
      if (typeof value === 'string' && (value.includes('<') || value.includes('>'))) {
        console.error(`CRITICAL: Answer for ${id} still contains angle brackets after cleaning!`);
        finalAnswers[key] = "Information not found";
        hasFixedAnswers = true;
      }
    }
    
    if (hasFixedAnswers) {
      console.log('Applied emergency fix to some answers that still contained tags:');
      Object.entries(finalAnswers).forEach(([id, answer]) => {
        console.log(`- ${id}: ${answer}`);
      });
    }
    
    // Log crawling statistics
    const totalQuestions = Object.keys(questionsData).length;
    const answeredQuestions = Object.values(finalAnswers).filter(a => a !== "Information not found").length;
    console.log(`Crawling statistics: Processed ${totalQuestions} questions, found answers for ${answeredQuestions}/${totalQuestions} questions`);
    
    // Submit the fully validated answers
    console.log('Submitting answers to the API...');
    await sendReport('softo', finalAnswers);
    console.log('Answers submitted successfully!');
    
    return finalAnswers;
  } catch (error) {
    console.error('Task execution failed:', error);
    throw error;
  }
}

// Run the task
executeTask()
  .then(() => console.log('Task completed successfully'))
  .catch(error => console.error('Task failed:', error));
