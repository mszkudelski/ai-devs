#!/usr/bin/env tsx

import { ReportLoaderService } from '../../src/services/ReportLoaderService.js';
import { sendReport } from '../../src/report.js';

async function searchForWeaponTheft() {
  try {
    console.log('🔍 Searching for "kradzież prototypu broni" (prototype weapon theft)...\n');

    const reportLoader = new ReportLoaderService();
    
    // Search for the phrase "kradzież prototypu broni" in both standard and classified reports
    const results = await reportLoader.searchReports('kradzież prototypu broni', { 
      limit: 10 
    });
    
    console.log(`Found ${results.length} results:`);
    
    let foundDate: string | null = null;
    let foundReport: any = null;
    
    for (const result of results) {
      console.log(`\n📄 File: ${result.filename}`);
      console.log(`📅 Date: ${result.date}`);
      console.log(`🔒 Type: ${result.type}`);
      console.log(`📊 Score: ${result.score?.toFixed(4)}`);
      console.log(`📝 Text preview: ${result.text?.substring(0, 200)}...`);
      
      // Look for the most relevant result (highest score)
      if (!foundDate || (result.score && result.score > (foundReport?.score || 0))) {
        foundDate = result.date;
        foundReport = result;
      }
    }
    
    if (foundDate && foundReport) {
      console.log(`\n✅ Most relevant report found!`);
      console.log(`📅 Date to submit: ${foundDate}`);
      console.log(`📄 Report: ${foundReport.filename}`);
      console.log(`📊 Score: ${foundReport.score?.toFixed(4)}`);
      
      // Send the report with the date
      console.log('\n📤 Sending report...');
      const response = await sendReport('wektory', foundDate);
      
      console.log('✅ Report sent successfully!');
      console.log('Response:', response);
      
    } else {
      console.log('\n❌ No relevant reports found for "kradzież prototypu broni"');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the search
if (import.meta.url === `file://${process.argv[1]}`) {
  searchForWeaponTheft();
}
