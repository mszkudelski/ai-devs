import { getCentralDataUrl } from "../../src/url.js";
import { getRequest, postRequest } from "../../src/api.js"; 
import { sendReport } from "../../src/report.js";
import { OpenAIService } from "../../src/openai.service.js";
import { extractFromTags } from "../../src/utils.js";
import { JSDOM } from 'jsdom';

// Initialize OpenAI Service
const openaiService = new OpenAIService();

interface SoftoData {
  "01": string;
  "02": string;
  "03": string;
}

interface ScrapedData {
  url: string;
  content: string;
}

interface Question {
  id: string;
  question: string;
  answer?: string;
}

/**
 * Fetches data from the softo.json endpoint
 * @returns The data from the endpoint
 */
async function fetchSoftoData(): Promise<SoftoData> {
  try {
    // Using getCentralDataUrl which automatically includes the API key
    const softoUrl = getCentralDataUrl('softo.json');
    console.log(`Fetching data from: ${softoUrl}`);
    
    const data = await getRequest<any>(softoUrl);
    console.log('Successfully fetched data');
    
    return data;
  } catch (error) {
    console.error('Error fetching softo data:', error);
    throw error;
  }
}

/**
 * Fetches HTML content from a given URL and extracts useful information
 * @param url The URL to fetch
 * @returns The scraped data (URL and text content) and HTML content for link extraction
 */
async function fetchHtml(url: string): Promise<{data: ScrapedData, html: string}> {
  try {
    console.log(`Fetching HTML from: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Extract text content, removing script and style elements
    const scripts = document.querySelectorAll('script, style');
    scripts.forEach(script => script.remove());
    
    // Get the cleaned text content
    const content = document.body.textContent?.trim() || '';
    
    console.log(`Successfully fetched HTML from ${url} (${content.length} chars)`);
    return { 
      data: { url, content },
      html 
    };
  } catch (error) {
    console.error(`Error fetching HTML from ${url}:`, error);
    return { 
      data: { url, content: '' },
      html: ''
    };
  }
}

/**
 * Extracts structured information from HTML content based on common patterns
 * @param html The HTML content
 * @param text The text content
 * @returns Object with various extracted information
 */
function extractStructuredInfo(html: string, text: string): Record<string, string[]> {
  return {
    emails: extractEmails(html),
    urls: extractInternalUrls(html),
    certificates: extractCertificates(text),
    addresses: extractAddresses(text),
    phones: extractPhones(text),
    entities: extractEntities(text)
  };
}

/**
 * Extracts email addresses from HTML content
 * @param html The HTML content
 * @returns Array of email addresses
 */
function extractEmails(html: string): string[] {
  // Regular expression for email addresses - catches both mailto: links and text emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  
  const emails = new Set<string>();
  
  // Extract plain emails
  const matches = html.match(emailRegex);
  if (matches) {
    matches.forEach(email => emails.add(email));
  }
  
  // Extract mailto links
  const mailtoMatches = [...html.matchAll(mailtoRegex)];
  mailtoMatches.forEach(match => {
    if (match[1]) {
      emails.add(match[1]);
    }
  });
  
  return [...emails];
}

/**
 * Extracts URLs from HTML content
 * @param html The HTML content
 * @returns Array of URLs
 */
function extractInternalUrls(html: string): string[] {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const links = document.querySelectorAll('a[href]');
    
    return Array.from(links)
      .map(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();
        if (!href) return null;
        
        // Include the link text as part of the result for better context
        return { href, text };
      })
      .filter((link): link is { href: string, text: string | undefined } => link !== null)
      .map(link => `${link.href}${link.text ? ` (${link.text})` : ''}`);
  } catch {
    return [];
  }
}

/**
 * Extracts potential certificate information from text
 * @param text The text content
 * @returns Array of potential certificate mentions
 */
function extractCertificates(text: string): string[] {
  // Common certificate patterns
  const patterns = [
    /ISO\s*\d+[\s:-]*\d+/gi,             // ISO standards like ISO 9001:2015
    /\bISO\s*\d+\b/gi,                   // Simple ISO numbers
    /\b(?:ISO|IEC)\s*\d+[^\s,.:;]*/gi,   // ISO/IEC standards
    /\bCertyfikat\s+[\w\s-]+\d+/gi,      // "Certyfikat" followed by words and numbers
    /\b(?:certyfikat|certificate)\b[^\.\n]{5,50}/gi  // "certyfikat" with surrounding context
  ];
  
  const results = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => results.add(match));
    }
  }
  
  return [...results];
}

/**
 * Extracts potential physical addresses from text
 * @param text The text content
 * @returns Array of potential address mentions
 */
function extractAddresses(text: string): string[] {
  // Simple patterns for address-like content
  const patterns = [
    /\b(?:ul|ulica|aleja|al)\.\s+[\w\s-]+\s+\d+/gi,  // Street patterns
    /\d{2}[-\s]?\d{3}\s+[\w\s-]+/gi                  // Postal code patterns
  ];
  
  const results = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => results.add(match));
    }
  }
  
  return [...results];
}

/**
 * Extracts potential phone numbers from text
 * @param text The text content
 * @returns Array of potential phone numbers
 */
function extractPhones(text: string): string[] {
  // Phone number patterns
  const patterns = [
    /(?:\+\d{2}|\(\+\d{2}\))\s*\d{2,3}(?:[\s-]\d{2,3}){2,}/g,  // International format
    /\d{3}[\s-]?\d{3}[\s-]?\d{3}/g,                            // Standard 9-digit
    /\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g                  // Alternative formats
  ];
  
  const results = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => results.add(match));
    }
  }
  
  return [...results];
}

/**
 * Extracts potential named entities from text
 * @param text The text content
 * @returns Array of potential entity names
 */
function extractEntities(text: string): string[] {
  // Pattern to find capitalized words in sequences (potential company/product names)
  const entityRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  
  const matches = [...text.matchAll(entityRegex)];
  const entities = matches.map(match => match[0]);
  
  return [...new Set(entities)];
}

/**
 * Extracts all links from HTML content for crawling purposes
 * @param baseUrl The base URL for resolving relative links
 * @param html The HTML content
 * @returns Array of absolute URLs
 */
function extractLinks(baseUrl: string, html: string): string[] {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const links = document.querySelectorAll('a[href]');
    
    const urls = Array.from(links)
      .map(link => {
        const href = link.getAttribute('href');
        if (!href) return null;
        
        // Skip anchor links, javascript, mailto, and tel links
        if (href.startsWith('#') || 
            href.startsWith('javascript:') ||
            href.startsWith('mailto:') || 
            href.startsWith('tel:')) {
          return null;
        }
        
        try {
          // Convert to absolute URL
          return new URL(href, baseUrl).href;
        } catch (e) {
          // Skip invalid URLs
          return null;
        }
      })
      .filter((url): url is string => url !== null);
    
    // Remove duplicates
    return [...new Set(urls)];
  } catch (error) {
    console.error('Error extracting links:', error);
    return [];
  }
}

/**
 * Creates a prompt for the AI to analyze data and either answer a question or request more pages to scrape
 * @param question The question to answer
 * @param scrapedData Array of scraped data from various URLs
 * @param availableLinks Array of available links that can be scraped next
 * @returns The formatted prompt for the AI
 */
function createAnalysisPrompt(
  question: string, 
  scrapedData: ScrapedData[], 
  availableLinks: string[] = []
): string {
  return `You are an AI web agent tasked with finding information from web pages to answer a specific question.

QUESTION: ${question}

Below is the content I've scraped so far from various web pages:

${scrapedData.map((data, index) => `
SOURCE ${index + 1} (URL: ${data.url}):
${data.content.substring(0, 1500)}${data.content.length > 1500 ? '... [content truncated]' : ''}
`).join('\n\n')}

${availableLinks.length > 0 ? `Here are links I found but haven't visited yet:
${availableLinks.map((url, i) => `${i + 1}. ${url}`).join('\n')}` : 'No additional links available to scrape.'}

INSTRUCTIONS:
1. If you have DEFINITIVE information to answer the question accurately, respond with:
<answer>exact answer text</answer>

2. If you DON'T have enough information yet, request to scrape a specific URL by responding with:
<scrape_url>URL to scrape next</scrape_url>

Important guidelines:
- Provide ONLY the exact answer with NO tags inside the answer tags
- Your answer must NOT include any <scrape_url> tags inside the <answer> tags
- If requesting more information, choose the most relevant URL from the list
- If the answer cannot be found after checking all relevant pages, respond with <answer>Information not found</answer>
- Be precise - the answer should be explicitly found in the content
- Do NOT return a URL as an answer - only use <scrape_url> tags for URLs you want to scrape next

CRITICAL: If you're not 100% confident in the answer, request to scrape more pages first.

Make your decision based solely on the content provided. Have you found the answer, or do you need to scrape another page?
`;
}

/**
 * Analyzes scraped data to either answer a specific question or request more scraping
 * @param question The question object
 * @param scrapedData Array of scraped data
 * @param availableLinks Array of available links that can be scraped next
 * @returns An object with either the answer or the next URL to scrape
 */
async function analyzeAndAnswer(
  question: Question, 
  scrapedData: ScrapedData[],
  availableLinks: string[] = []
): Promise<{ hasAnswer: boolean; answer?: string; nextUrl?: string }> {
  console.log(`Analyzing data for question ${question.id}: "${question.question}"`);
  
  // Create a stronger prompt with additional instructions at the beginning
  const enhancedPrompt = `CRITICAL INSTRUCTION: 
- When answering, NEVER include <scrape_url> tags inside <answer> tags
- If you have the answer, respond ONLY with <answer>exact plain text answer</answer> 
- If you need more data, respond ONLY with <scrape_url>URL</scrape_url>
- NEVER mix these two tag types together

${createAnalysisPrompt(question.question, scrapedData, availableLinks)}`;
  
  // Use a more capable model if available, fallback to the default
  const response = await openaiService.getChatResponse(enhancedPrompt, 'gpt-4o');
  
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
      console.log(`Answer found for question ${question.id}: "${cleanAnswer}"`);
      return { hasAnswer: true, answer: cleanAnswer };
    }
  }
  
  // Check if the AI requested more scraping
  const nextUrl = extractFromTags(response, 'scrape_url');
  if (nextUrl) {
    // Clean up the URL just in case it has whitespace or other issues
    const cleanUrl = nextUrl.trim();
    console.log(`Model requested to scrape URL for question ${question.id}: ${cleanUrl}`);
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
 * Web crawler function that uses the model to decide whether to answer questions or crawl more pages
 * @param startUrl The starting URL for crawling
 * @param questions Array of questions to answer
 * @param maxPages Maximum number of pages to crawl (to prevent infinite loops)
 * @returns Object with answers to questions
 */
async function crawlWebsite(startUrl: string, questions: Question[], maxPages: number = 20): Promise<SoftoData> {
  // Track visited pages and collected data
  const visited = new Set<string>();
  const scrapedData: ScrapedData[] = [];
  const pendingQuestions = [...questions];
  const answers: SoftoData = {} as SoftoData;
  
  // Initialize with the start URL
  const globalQueue: string[] = [startUrl];
  
  console.log(`Starting model-driven web crawl from ${startUrl} to find answers to ${questions.length} questions`);
  
  // Continue until we've answered all questions, reached the page limit, or exhausted all links
  while (pendingQuestions.length > 0 && visited.size < maxPages) {
    if (globalQueue.length === 0) {
      console.log("No more URLs to explore. Some questions may remain unanswered.");
      break;
    }
    
    // Process one question at a time
    const currentQuestion = pendingQuestions[0];
    console.log(`Working on question ${currentQuestion.id}: "${currentQuestion.question}"`);
    
    // Start with the first page if we haven't visited any yet
    if (visited.size === 0) {
      const url = globalQueue.shift()!;
      await processPage(url);
    }
    
    // Let the model decide what to do for the current question
    let attempts = 0;
    const maxAttempts = Math.min(15, maxPages - visited.size); // Increased max attempts per question
    
    // Available links to explore (all unexplored links)
    let availableLinks = globalQueue.filter(url => !visited.has(url));
    
    let finalAnswer: string | undefined;
    
    // Question-specific agent loop
    while (attempts < maxAttempts && !finalAnswer) {
      const result = await analyzeAndAnswer(currentQuestion, scrapedData, availableLinks);
      
      if (result.hasAnswer) {
        // Make sure the answer doesn't contain scrape_url tags
        if (result.answer && !result.answer.includes('<scrape_url>')) {
          finalAnswer = result.answer;
          console.log(`✓ Found answer for question ${currentQuestion.id}: "${finalAnswer}"`);
        } else {
          // If it contains scrape_url tags, we need to parse and follow that URL
          console.log(`Answer contains scrape_url tags. Processing as URL request instead.`);
          
          // Extract the URL from the scrape_url tag if present
          const urlMatch = result.answer?.match(/<scrape_url>(.*?)<\/scrape_url>/);
          if (urlMatch && urlMatch[1]) {
            const extractedUrl = urlMatch[1].trim();
            if (!visited.has(extractedUrl)) {
              console.log(`Extracted URL from tags: ${extractedUrl}`);
              await processPage(extractedUrl);
              availableLinks = globalQueue.filter(url => !visited.has(url));
            }
          }
        }
      } else if (result.nextUrl) {
        // The model wants to explore a specific URL
        const urlToScrape = result.nextUrl;
        
        // Check if this URL is valid and not already visited
        if (!visited.has(urlToScrape)) {
          console.log(`Model requested to scrape: ${urlToScrape}`);
          await processPage(urlToScrape);
          
          // Update available links after processing the page
          availableLinks = globalQueue.filter(url => !visited.has(url));
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
        const finalResult = await analyzeAndAnswer(currentQuestion, scrapedData, []);
        if (finalResult.hasAnswer && !finalResult.answer?.includes('<scrape_url>')) {
          finalAnswer = finalResult.answer;
        } else {
          finalAnswer = "Information not found";
        }
      }
    }
    
    // Final validation check - ensure we never store answers with tags
    let cleanFinalAnswer = finalAnswer || "Information not found";
    
    // Check for scrape_url tags specifically
    if (cleanFinalAnswer.includes('<scrape_url>')) {
      console.error(`CRITICAL: Final answer for ${currentQuestion.id} still contains scrape_url tags! Replacing with default.`);
      cleanFinalAnswer = "Information not found";
    }
    
    // Remove any possible HTML tags as a final safety measure
    cleanFinalAnswer = cleanFinalAnswer.replace(/<[^>]*>/g, '').trim();
    if (!cleanFinalAnswer) {
      cleanFinalAnswer = "Information not found";
    }
    
    // Store the clean answer and move to the next question
    answers[currentQuestion.id as keyof SoftoData] = cleanFinalAnswer;
    pendingQuestions.shift();
    console.log(`Completed question ${currentQuestion.id} after ${attempts} attempts (${pendingQuestions.length} questions remaining)`);
  }
  
  // Log crawling statistics
  console.log(`Crawling complete. Visited ${visited.size} pages, collected ${scrapedData.length} pages.`);
  console.log(`Found answers for ${questions.length - pendingQuestions.length}/${questions.length} questions`);
  
  // If we still have unanswered questions due to page limit, mark them as not found
  if (pendingQuestions.length > 0) {
    console.log(`${pendingQuestions.length} questions remain unanswered due to reaching limits.`);
    for (const question of pendingQuestions) {
      answers[question.id as keyof SoftoData] = "Information not found";
    }
  }
  
  return answers;
  
  /**
   * Helper function to process a single page
   * @param url URL to process
   */
  async function processPage(url: string): Promise<void> {
    // Skip if already visited
    if (visited.has(url)) return;
    
    // Mark as visited
    visited.add(url);
    console.log(`Crawling page ${visited.size}/${maxPages}: ${url}`);
    
    try {
      // Fetch the HTML content
      const { data, html } = await fetchHtml(url);
      scrapedData.push(data);
      
      // Extract structured information that might be useful for answering questions
      const structuredInfo = extractStructuredInfo(html, data.content);
      
      // Add extracted structured data to the content
      const hasStructuredData = Object.values(structuredInfo).some(arr => arr.length > 0);
      if (hasStructuredData) {
        // Build a formatted string with all structured data
        let structuredDataContent = `EXTRACTED STRUCTURED INFORMATION:\n`;
        
        for (const [type, items] of Object.entries(structuredInfo)) {
          if (items.length > 0) {
            structuredDataContent += `${type.toUpperCase()}: ${items.join(', ')}\n`;
          }
        }
        
        structuredDataContent += `\nORIGINAL CONTENT:\n${data.content}`;
        
        // Update the current page data with enriched content
        const currentPageIndex = scrapedData.findIndex(item => item.url === url);
        if (currentPageIndex !== -1) {
          scrapedData[currentPageIndex].content = structuredDataContent;
        }
        
        // Log what we found
        for (const [type, items] of Object.entries(structuredInfo)) {
          if (items.length > 0) {
            console.log(`Found ${items.length} ${type} on page`);
          }
        }
      }
      
      // Extract links from the page
      const links = extractLinks(url, html);
      const startUrlObj = new URL(startUrl);
      
      // Filter new links: same domain and not visited
      for (const link of links) {
        try {
          const linkObj = new URL(link);
          
          // Only add links from the same domain that we haven't queued yet
          if (linkObj.hostname === startUrlObj.hostname && 
              !visited.has(link) && 
              !globalQueue.includes(link)) {
            globalQueue.push(link);
          }
        } catch (e) {
          // Skip invalid URLs
          continue;
        }
      }
      
      console.log(`Added ${links.length} new links to the global queue`);
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }
}

/**
 * Executes the main task
 */
async function executeTask() {
  try {
    console.log('Starting the SoftoAI web scraping task...');
    
    // Fetch questions from the endpoint
    const questionsData = await fetchSoftoData();
    console.log('Questions received:', JSON.stringify(questionsData, null, 2));
    
    // Format questions for processing
    const questions: Question[] = Object.entries(questionsData).map(([id, question]) => ({
      id,
      question
    }));
    
    console.log(`Processing ${questions.length} questions:`);
    questions.forEach(q => console.log(`- ${q.id}: ${q.question}`));
    
    // Crawl the website to find answers
    const startUrl = 'https://softo.ag3nts.org';
    console.log(`Starting web crawl from: ${startUrl}`);
    const answers = await crawlWebsite(startUrl, questions, 20);
    
    console.log('Found answers:');
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
    
    // Submit the fully validated answers
    console.log('Submitting answers to the API...');
    await sendReport('softo', finalAnswers);
    console.log('Answers submitted successfully!');
    
    return validatedAnswers;
  } catch (error) {
    console.error('Task execution failed:', error);
    throw error;
  }
}

// Run the task
executeTask()
  .then(() => console.log('Task completed successfully'))
  .catch(error => console.error('Task failed:', error));
