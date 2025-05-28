#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { ReportLoaderService } from '../src/services/ReportLoaderService.js';

dotenv.config();

async function main() {
  try {
    console.log('🚀 Starting Vector Database Demo...\n');

    const reportLoader = new ReportLoaderService();

    // Initialize the vector database with all reports
    console.log('📊 Initializing vector database...');
    await reportLoader.initializeVectorDatabase();

    console.log('\n✅ Vector database initialized successfully!\n');

    // Test search functionality
    console.log('🔍 Testing search functionality...');
    
    const testQueries = [
      'broń plazmowa',
      'Aleksander Ragowski',
      'sektor C4',
      'temperatura',
      'zabezpieczenia'
    ];

    for (const query of testQueries) {
      console.log(`\n--- Searching for: "${query}" ---`);
      const results = await reportLoader.searchReports(query, { limit: 3 });
      
      results.forEach((result, index) => {
        console.log(`${index + 1}. [Score: ${result.score?.toFixed(3)}] ${result.filename}`);
        console.log(`   Date: ${result.date} | Sector: ${result.sector || 'N/A'} | Type: ${result.type}`);
        console.log(`   Text: ${result.text?.substring(0, 100)}...`);
      });
    }

    // Test filtering by type
    console.log('\n🔒 Testing classified reports search...');
    const classifiedResults = await reportLoader.searchReports('broń', { 
      type: 'classified', 
      limit: 3 
    });
    
    console.log(`Found ${classifiedResults.length} classified reports about weapons:`);
    classifiedResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.filename} (${result.date})`);
      console.log(`   ${result.text?.substring(0, 150)}...`);
    });

    // Test filtering by sector
    console.log('\n🏭 Testing sector-based search...');
    const sectorResults = await reportLoader.searchReports('wykryto', { 
      sector: 'C4', 
      limit: 2 
    });
    
    console.log(`Found ${sectorResults.length} reports from sector C4:`);
    sectorResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.filename}`);
      console.log(`   ${result.text?.substring(0, 100)}...`);
    });

    console.log('\n🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error in demo:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
