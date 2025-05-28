import path from 'path';
import { FactCategorizerService } from '../../src/fact-categorizer.service.js';

export async function categorizeReports() {
  const factCategorizer = new FactCategorizerService({
    inputDirectory: path.join(process.cwd(), 'data', 'pliki_z_fabryki'),
    outputDirectory: path.join(process.cwd(), 'data', 'categorized_reports'),
    enableLogging: true,
  });

  try {
    const result = await factCategorizer.categorizeAllFacts();
    const { facts, stats } = result;

    console.log(`\nProcessing completed in ${stats.processingTime}ms`);
    console.log(`Successfully categorized ${facts.length} facts:`);
    console.log(`Processed: ${stats.processedFiles}, Failed: ${stats.failedFiles}`);

    facts.forEach((fact) => {
      console.log(`\n📄 ${fact.id}:`);
      console.log(`   Summary: ${fact.summary}`);
      console.log(`   Keywords: ${fact.keywords.join(', ')}`);
    });

    return facts;
  } catch (error) {
    console.error('Error during fact categorization:', error);
    process.exit(1);
  } finally {
    await factCategorizer.shutdown();
  }
}
