#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';

dotenv.config();

async function testQdrantConnection() {
  try {
    console.log('🔗 Testing Qdrant connection...');
    
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = process.env.QDRANT_API_KEY;
    
    console.log(`📍 Connecting to: ${qdrantUrl}`);
    
    const client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });

    // Test connection by getting collections
    const collections = await client.getCollections();
    console.log('✅ Successfully connected to Qdrant!');
    console.log(`📊 Found ${collections.collections.length} existing collections`);
    
    if (collections.collections.length > 0) {
      console.log('Collections:');
      collections.collections.forEach(col => {
        console.log(`  - ${col.name}`);
      });
    }
    
    return true;
  } catch (error: any) {
    console.error('❌ Failed to connect to Qdrant:');
    console.error(error.message);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Make sure Qdrant is running:');
      console.log('   - Local: npm run start-qdrant');
      console.log('   - Cloud: Add QDRANT_URL and QDRANT_API_KEY to .env');
      console.log('2. Check if the URL is correct in .env file');
    }
    
    return false;
  }
}

async function testOpenAIConnection() {
  try {
    console.log('\n🤖 Testing OpenAI connection...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not found in .env file');
      return false;
    }
    
    const { OpenAIService } = await import('../src/openai.service.js');
    const openaiService = new OpenAIService();
    
    // Test with a simple embedding
    const testText = "This is a test";
    const embedding = await openaiService.createEmbedding(testText);
    
    console.log('✅ Successfully connected to OpenAI!');
    console.log(`📏 Embedding dimensions: ${embedding.length}`);
    
    await openaiService.shutdown();
    return true;
  } catch (error: any) {
    console.error('❌ Failed to connect to OpenAI:');
    console.error(error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 Make sure your OPENAI_API_KEY is valid in .env file');
    }
    
    return false;
  }
}

async function main() {
  console.log('🧪 Vector Database Setup Test\n');
  
  // Test Qdrant connection
  const qdrantOk = await testQdrantConnection();
  
  // Test OpenAI connection
  const openaiOk = await testOpenAIConnection();
  
  console.log('\n📋 Summary:');
  console.log(`Qdrant: ${qdrantOk ? '✅' : '❌'}`);
  console.log(`OpenAI: ${openaiOk ? '✅' : '❌'}`);
  
  if (qdrantOk && openaiOk) {
    console.log('\n🎉 All connections successful! You can now run:');
    console.log('npm run vector-db-demo');
  } else {
    console.log('\n⚠️ Fix the connection issues above before proceeding.');
    
    if (!qdrantOk) {
      console.log('\nQdrant Setup Options:');
      console.log('1. Local Docker: npm run start-qdrant');
      console.log('2. Qdrant Cloud: https://cloud.qdrant.io/');
    }
  }
  
  process.exit(qdrantOk && openaiOk ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
