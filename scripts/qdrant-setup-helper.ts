#!/usr/bin/env tsx

import dotenv from 'dotenv';

dotenv.config();

function main() {
  console.log('🔧 Qdrant Cloud URL Configuration Helper\n');
  
  const currentUrl = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  
  console.log('Current configuration:');
  console.log(`QDRANT_URL: ${currentUrl}`);
  console.log(`QDRANT_API_KEY: ${apiKey ? 'Present ✅' : 'Missing ❌'}\n`);
  
  if (currentUrl?.includes('your-cluster-url')) {
    console.log('❌ You need to replace the placeholder URL with your actual Qdrant Cloud cluster URL.\n');
    
    console.log('📋 How to find your Qdrant Cloud URL:');
    console.log('1. Go to https://cloud.qdrant.io/');
    console.log('2. Log in to your account');
    console.log('3. Click on your cluster');
    console.log('4. In the cluster details, find the "Cluster URL" or "Endpoint"');
    console.log('5. Copy the full URL (should look like: https://abc123-def456.api.gcp-us-west1.qdrant.tech:6333)');
    console.log('6. Update your .env file:\n');
    
    console.log('   QDRANT_URL=https://your-actual-cluster-url.api.region.qdrant.tech:6333\n');
    
    console.log('💡 Alternative: If you don\'t have a Qdrant Cloud account yet:');
    console.log('1. Sign up at https://cloud.qdrant.io/');
    console.log('2. Create a new cluster (free tier available)');
    console.log('3. Get the cluster URL and API key');
    console.log('4. Update your .env file\n');
    
    console.log('🧪 For testing without cloud setup, you can also run:');
    console.log('   npm run mock-vector-demo');
    
  } else {
    console.log('✅ Your URL looks correctly formatted. Let\'s test the connection...\n');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
