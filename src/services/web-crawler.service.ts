import { JSDOM } from 'jsdom';

export interface ScrapedData {
  url: string;
  content: string;
}

export interface StructuredInfo {
  emails: string[];
  urls: string[];
  certificates: string[];
  addresses: string[];
  phones: string[];
  entities: string[];
}

/**
 * Service for crawling websites and extracting content
 */
export class WebCrawlerService {
  private visited = new Set<string>();
  private scrapedData: ScrapedData[] = [];

  /**
   * Constructor for WebCrawlerService
   * @param maxPages Maximum number of pages to crawl (default: 20)
   */
  constructor(private maxPages: number = 20) {}

  /**
   * Reset the crawler state
   */
  public reset(): void {
    this.visited.clear();
    this.scrapedData = [];
  }

  /**
   * Get the list of visited URLs
   * @returns Set of visited URLs
   */
  public getVisited(): Set<string> {
    return new Set(this.visited);
  }

  /**
   * Get the list of all scraped data
   * @returns Array of scraped data objects
   */
  public getScrapedData(): ScrapedData[] {
    return [...this.scrapedData];
  }

  /**
   * Process a URL and extract its content, metadata, and links
   * @param url URL to process
   * @param extractStructuredData Whether to extract structured data (emails, addresses, etc.)
   * @returns Object with the scraped data and extracted links
   */
  public async processUrl(url: string, extractStructuredData: boolean = true): Promise<{ 
    data: ScrapedData;
    links: string[];
    structuredInfo?: StructuredInfo 
  }> {
    // Skip if already visited
    if (this.visited.has(url)) {
      return { 
        data: this.scrapedData.find(data => data.url === url) || { url, content: '' },
        links: []
      };
    }

    // Mark as visited
    this.visited.add(url);
    
    try {
      // Fetch the HTML content
      const { data, html, links } = await this.fetchHtml(url);
      this.scrapedData.push(data);

      // Extract structured information if requested
      let structuredInfo: StructuredInfo | undefined;
      
      if (extractStructuredData) {
        structuredInfo = this.extractStructuredInfo(html, data.content);

        // Add extracted structured data to the content
        if (this.hasStructuredData(structuredInfo)) {
          // Build a formatted string with all structured data
          let structuredDataContent = `EXTRACTED STRUCTURED INFORMATION:\n`;
          
          for (const [type, items] of Object.entries(structuredInfo)) {
            if (items.length > 0) {
              structuredDataContent += `${type.toUpperCase()}: ${items.join(', ')}\n`;
            }
          }
          
          structuredDataContent += `\nORIGINAL CONTENT:\n${data.content}`;
          
          // Update the current page data with enriched content
          const currentPageIndex = this.scrapedData.findIndex(item => item.url === url);
          if (currentPageIndex !== -1) {
            this.scrapedData[currentPageIndex].content = structuredDataContent;
            data.content = structuredDataContent;
          }
        }
      }

      // Check if we've reached the maximum number of pages
      if (this.visited.size >= this.maxPages) {
        console.log(`Reached maximum number of pages (${this.maxPages}). Stopping crawler.`);
      }

      return { data, links, structuredInfo };
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      return { data: { url, content: `Error: ${error instanceof Error ? error.message : String(error)}` }, links: [] };
    }
  }

  /**
   * Process multiple URLs in sequence
   * @param urls Array of URLs to process
   * @param extractStructuredData Whether to extract structured data
   * @returns Array of processed data and links
   */
  public async processUrls(urls: string[], extractStructuredData: boolean = true): Promise<Array<{
    data: ScrapedData;
    links: string[];
    structuredInfo?: StructuredInfo;
  }>> {
    const results = [];

    for (const url of urls) {
      if (this.visited.size >= this.maxPages) {
        break;
      }
      
      const result = await this.processUrl(url, extractStructuredData);
      results.push(result);
    }

    return results;
  }

  /**
   * Fetches HTML content from a given URL and extracts useful information
   * @param url The URL to fetch
   * @returns The scraped data, HTML content, and extracted links
   */
  private async fetchHtml(url: string): Promise<{ data: ScrapedData; html: string; links: string[] }> {
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
      
      // Extract links from the page
      const linkElements = document.querySelectorAll('a[href]');
      const extractedLinks = Array.from(linkElements)
        .map(link => {
          const href = link.getAttribute('href');
          if (!href) return null;
          
          try {
            // Convert relative URLs to absolute
            const absoluteUrl = new URL(href, url).href;
            return absoluteUrl;
          } catch {
            return null;
          }
        })
        .filter((link): link is string => link !== null);
      
      console.log(`Successfully fetched HTML from ${url} (${content.length} chars, ${extractedLinks.length} links)`);
      return { 
        data: { url, content },
        html,
        links: extractedLinks
      };
    } catch (error) {
      console.error(`Error fetching HTML from ${url}:`, error);
      return { 
        data: { url, content: '' },
        html: '',
        links: []
      };
    }
  }

  /**
   * Check if structured data contains any non-empty values
   * @param structuredInfo Object with structured data
   * @returns Boolean indicating if structured data is present
   */
  private hasStructuredData(structuredInfo: StructuredInfo): boolean {
    return Object.values(structuredInfo).some(arr => arr.length > 0);
  }

  /**
   * Extracts structured information from HTML content based on common patterns
   * @param html The HTML content
   * @param text The text content
   * @returns Object with various extracted information
   */
  private extractStructuredInfo(html: string, text: string): StructuredInfo {
    return {
      emails: this.extractEmails(html),
      urls: this.extractInternalUrls(html),
      certificates: this.extractCertificates(text),
      addresses: this.extractAddresses(text),
      phones: this.extractPhones(text),
      entities: this.extractEntities(text)
    };
  }

  /**
   * Extracts email addresses from HTML content
   * @param html The HTML content
   * @returns Array of email addresses
   */
  private extractEmails(html: string): string[] {
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
  private extractInternalUrls(html: string): string[] {
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
  private extractCertificates(text: string): string[] {
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
  private extractAddresses(text: string): string[] {
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
  private extractPhones(text: string): string[] {
    // Phone number patterns (Polish format focus, but generalized)
    const patterns = [
      /(?:\+\d{2}|0\d)\s?(?:\d{3}\s?){2,3}\d{3}/g,  // +XX XXX XXX XXX format
      /\(\d{2}\)\s?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,   // (XX) XXX XX XX format
      /\d{3}[\s-]?\d{3}[\s-]?\d{3}/g                // XXX XXX XXX format
    ];
    
    const results = new Set<string>();
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => results.add(match.trim()));
      }
    }
    
    return [...results];
  }

  /**
   * Extracts potential named entities from text
   * @param text The text content
   * @returns Array of potential entity names
   */
  private extractEntities(text: string): string[] {
    // This is a simplified approach that looks for capitalized words that might be entities
    // In a production system, this would use more sophisticated NER
    const entities = new Set<string>();
    
    // Look for sequences of capitalized words
    const entityRegex = /\b([A-Z][a-zA-Z]*\s){1,5}[A-Z][a-zA-Z]*\b/g;
    const matches = text.match(entityRegex);
    
    if (matches) {
      matches.forEach(match => {
        // Only include if 2+ chars to avoid single letters
        if (match.length > 2) {
          entities.add(match.trim());
        }
      });
    }
    
    return [...entities];
  }
}
