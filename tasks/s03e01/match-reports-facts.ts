import path from 'path';
import { ReportFactMatcherService } from '../../src/report-fact-matcher.service.js';

export async function matchReportsWithFacts() {
  console.log('🔍 Starting report-fact matching process...\n');

  const reportFactMatcher = new ReportFactMatcherService(
    {
      factsInputDirectory: path.join(process.cwd(), 'data', 'pliki_z_fabryki', 'facts'),
      factsOutputDirectory: path.join(process.cwd(), 'data', 'categorized_facts'),
    },
    {
      relevanceThreshold: 0.6, // Lower threshold to capture more potential matches
      enableLogging: true,
      maxConcurrentRequests: 2, // Limit concurrent requests to avoid rate limiting
    }
  );

  try {
    // Load categorized reports
    const categorizedReports = await reportFactMatcher.loadCategorizedReports(
      path.join(process.cwd(), 'data', 'categorized_reports')
    );

    // Convert to the format expected by the matcher
    const reportsToProcess = categorizedReports.map(report => ({
      id: report.id,
      summary: report.summary,
      keywords: report.keywords,
    }));

    console.log(`📊 Processing ${reportsToProcess.length} reports...\n`);

    // Find relevant facts for all reports
    const matches = await reportFactMatcher.findRelevantFactsForMultipleReports(reportsToProcess);

    // Display results
    console.log('\n📋 REPORT-FACT MATCHING RESULTS:\n');
    console.log('='.repeat(80));

    for (const match of matches) {
      console.log(`\n📄 REPORT: ${match.reportId}`);
      console.log(`   Summary: ${match.reportSummary}`);
      console.log(`   Keywords: ${match.reportKeywords.join(', ')}`);
      
      if (match.relevantFacts.length > 0) {
        console.log(`\n   🎯 RELEVANT FACTS (${match.relevantFacts.length}):`);
        
        // Sort relevance scores by score (highest first)
        const sortedScores = match.relevanceScores.sort((a, b) => b.score - a.score);
        
        for (const scoreData of sortedScores) {
          const fact = match.relevantFacts.find(f => f.id === scoreData.factId);
          if (fact) {
            console.log(`\n      📌 ${fact.id} (Score: ${scoreData.score.toFixed(2)})`);
            console.log(`         Summary: ${fact.summary}`);
            console.log(`         Keywords: ${fact.keywords.join(', ')}`);
            console.log(`         Reasoning: ${scoreData.reasoning}`);
          }
        }
      } else {
        console.log('\n   ❌ No relevant facts found');
      }
      
      console.log('\n' + '-'.repeat(80));
    }

    // Summary statistics
    const totalMatches = matches.reduce((sum, match) => sum + match.relevantFacts.length, 0);
    const reportsWithMatches = matches.filter(match => match.relevantFacts.length > 0).length;
    
    console.log(`\n📈 SUMMARY STATISTICS:`);
    console.log(`   Total reports processed: ${matches.length}`);
    console.log(`   Reports with relevant facts: ${reportsWithMatches} (${((reportsWithMatches / matches.length) * 100).toFixed(1)}%)`);
    console.log(`   Total fact matches found: ${totalMatches}`);
    console.log(`   Average matches per report: ${(totalMatches / matches.length).toFixed(1)}`);

    return matches;

  } catch (error) {
    console.error('❌ Error during report-fact matching:', error);
    throw error;
  } finally {
    await reportFactMatcher.shutdown();
  }
}

// Example of using the service for a single report
export async function matchSingleReport() {
  console.log('🔍 Testing single report matching...\n');

  const reportFactMatcher = new ReportFactMatcherService(
    {
      factsInputDirectory: path.join(process.cwd(), 'data', 'pliki_z_fabryki', 'facts'),
      factsOutputDirectory: path.join(process.cwd(), 'data', 'categorized_facts'),
    },
    {
      relevanceThreshold: 0.5,
      enableLogging: true,
    }
  );

  try {
    // Example report data
    const testReport = {
      id: 'test-report-001',
      summary: 'O godzinie 22:43 wykryto jednostkę organiczną, która przedstawiła się jako Aleksander Ragowski i została potwierdzona w bazie danych, po czym przekazano ją do działu kontroli, a patrol kontynuowano.',
      keywords: ['jednostka organiczna', 'kontrola', 'skan biometryczny', 'bazadanych', 'rozpoznanie', 'patrol', 'fabryka']
    };

    const match = await reportFactMatcher.findRelevantFactsForReport(
      testReport.summary,
      testReport.keywords,
      testReport.id
    );

    console.log('📄 TEST REPORT RESULTS:');
    console.log(`   Report ID: ${match.reportId}`);
    console.log(`   Summary: ${match.reportSummary}`);
    console.log(`   Keywords: ${match.reportKeywords.join(', ')}\n`);

    if (match.relevantFacts.length > 0) {
      console.log(`🎯 Found ${match.relevantFacts.length} relevant facts:\n`);
      
      for (const scoreData of match.relevanceScores) {
        const fact = match.relevantFacts.find(f => f.id === scoreData.factId);
        if (fact) {
          console.log(`📌 ${fact.id} (Score: ${scoreData.score.toFixed(2)})`);
          console.log(`   Summary: ${fact.summary}`);
          console.log(`   Keywords: ${fact.keywords.join(', ')}`);
          console.log(`   Reasoning: ${scoreData.reasoning}\n`);
        }
      }
    } else {
      console.log('❌ No relevant facts found for this report');
    }

    return match;

  } catch (error) {
    console.error('❌ Error during single report matching:', error);
    throw error;
  } finally {
    await reportFactMatcher.shutdown();
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || 'all';
  
  if (mode === 'single') {
    matchSingleReport().catch(console.error);
  } else {
    matchReportsWithFacts().catch(console.error);
  }
}
