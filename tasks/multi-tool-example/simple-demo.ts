#!/usr/bin/env tsx
/**
 * Simple Multi-Tool Agent Demonstration
 * 
 * This script demonstrates a practical agent that uses multiple tools
 * to complete tasks requiring both text analysis and numerical calculations.
 * 
 * Run: npm run start --dir=multi-tool-example
 */

import { createMultiToolAgent } from "../../src/agent/examples/multi-tool-example.js";

async function simpleDemo() {
    console.log('🤖 Simple Multi-Tool Agent Demo\n');
    
    const agent = createMultiToolAgent({
        maxSteps: 8,
        enableReflection: true,
        enableLogging: true
    });

    console.log('📝 Task: Analyze customer feedback with ratings\n');
    
    // Simple but realistic task that requires multiple tools
    const taskResult = await agent.executeTask(`
        Analyze this customer feedback data:
        
        "This product is absolutely amazing! The quality exceeded all my expectations. 
         Outstanding customer service and fantastic shipping speed!"
        
        Customer ratings: [5, 4, 5, 5, 4, 5] (scale 1-5)
        
        Your task:
        1. Analyze the sentiment of the text feedback
        2. Calculate the average rating from the numerical scores
        3. Determine if the text sentiment matches the numerical rating
        4. Provide insights about customer satisfaction
    `);

    console.log('\n✅ Task completed!');
    console.log('\n📊 Results:');
    console.log(`   Status: ${taskResult.status}`);
    console.log(`   Tools used: ${taskResult.toolsUsed?.join(', ')}`);
    console.log(`   Steps taken: ${taskResult.executionDetails?.totalSteps || 'N/A'}`);
    
    if (taskResult.insights && taskResult.insights.length > 0) {
        console.log('\n💡 Key insights:');
        taskResult.insights.slice(0, 3).forEach((insight: string, i: number) => {
            console.log(`   ${i + 1}. ${insight.replace('- ', '')}`);
        });
    }

    console.log('\n🎯 This demonstrates how the agent:');
    console.log('   • Automatically selected appropriate tools');
    console.log('   • Coordinated text analysis with numerical calculations');
    console.log('   • Provided comprehensive insights from mixed data types');
    console.log('   • Made intelligent decisions about tool usage order');
}

// Run the demonstration
simpleDemo().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
});
