#!/usr/bin/env tsx
/**
 * Simple Multi-Tool Agent Demo Runner
 * Run with: npm run start --dir=src/agent/examples && node multi-tool-demo.js
 * Or directly: tsx multi-tool-demo.ts
 */

import { 
    createMultiToolAgent, 
    runMultiToolDemo, 
    quickMultiToolExample 
} from './multi-tool-example.js';

async function main() {
    console.log('🚀 Multi-Tool Agent Demo\n');
    
    // Show available demos
    console.log('Available demos:');
    console.log('1. Quick Example - Simple document analysis');
    console.log('2. Full Demo - All three comprehensive examples');
    console.log('3. Custom Task - Interactive agent chat\n');
    
    // For this demo, we'll run the quick example first
    console.log('🎯 Running Quick Example...\n');
    await quickMultiToolExample();
    
    console.log('\n' + '='.repeat(50));
    console.log('🔧 Running Full Multi-Tool Demo...\n');
    await runMultiToolDemo();
    
    console.log('\n' + '='.repeat(50));
    console.log('💬 Interactive Example...\n');
    
    // Interactive example
    const agent = createMultiToolAgent({ maxSteps: 8 });
    
    console.log('🤖 Agent: Hello! I can analyze documents with text and numbers.');
    console.log('📝 Let me show you what I can do...\n');
    
    const interactiveResult = await agent.executeTask(
        'I have this customer feedback: "The product is absolutely fantastic! Best purchase ever!" ' +
        'The customer gave ratings of [5, 4, 5, 5, 4] across different categories. ' +
        'Analyze the sentiment and calculate the average rating.'
    );
    
    console.log('📊 Interactive task completed!');
    console.log('🔧 Tools used:', interactiveResult.toolsUsed);
    console.log('📈 Status:', interactiveResult.status);
    console.log('💡 Key insights:', interactiveResult.insights?.slice(0, 2));
    
    console.log('\n✨ Demo completed! The agent successfully:');
    console.log('   • Coordinated multiple tools for complex tasks');
    console.log('   • Analyzed text sentiment and numerical data');
    console.log('   • Performed calculations and statistical analysis');
    console.log('   • Provided comprehensive insights from mixed content');
}

// Run the demo
main().catch(console.error);
