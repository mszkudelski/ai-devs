#!/usr/bin/env tsx

/**
 * Simple Agent Framework Example
 * 
 * This demonstrates a clear question → steps → answer flow
 * Run with: tsx simple-agent-example.ts
 */

import { createExampleAgent } from './src/agent/examples/example-agent.js';

async function simpleExample() {
    console.log('🤖 Simple Agent Framework Example\n');
    console.log('=' .repeat(60));
    
    const agent = createExampleAgent({
        maxSteps: 5,
        enableReflection: false, // Simplified for cleaner output
        enableLogging: false
    });

    // Example 1: Text Analysis Question
    console.log('\n📝 EXAMPLE 1: Text Analysis');
    console.log('=' .repeat(40));
    console.log('👤 User Question: "How many words are in this text and what\'s the sentiment?"');
    console.log('📄 Text: "I absolutely love using AI tools! They make everything so much easier."');
    console.log('\n🔄 Agent Steps:');
    
    const textResult = await agent.analyzeTextWithStats(
        'I absolutely love using AI tools! They make everything so much easier.'
    );
    
    console.log('\n✅ Final Answer:');
    console.log(`📊 Word Count: ${textResult.context.text_analyzer_result?.wordCount || 'N/A'}`);
    console.log(`😊 Sentiment: ${textResult.context.text_analyzer_result?.sentiment || 'N/A'}`);
    console.log(`📈 Sentiment Score: ${JSON.stringify(textResult.context.text_analyzer_result?.sentimentScore) || 'N/A'}`);

    // Reset for next example
    agent.resetForNewTask();

    // Example 2: Math Problem
    console.log('\n\n🔢 EXAMPLE 2: Math Problem');
    console.log('=' .repeat(40));
    console.log('👤 User Question: "What is 25 + 17, then multiply that by 3?"');
    console.log('\n🔄 Agent Steps:');
    
    const mathResult = await agent.solveMathProblem(
        'Calculate 25 + 17, then multiply that result by 3'
    );
    
    console.log('\n✅ Final Answer:');
    const finalCalcResult = mathResult.context.calculator_result;
    if (finalCalcResult) {
        console.log(`🎯 Result: ${finalCalcResult.result}`);
        console.log(`📝 Final Expression: ${finalCalcResult.expression}`);
    } else {
        console.log('❌ No calculation result found');
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Examples completed! The agent successfully:');
    console.log('   • Analyzed text properties and sentiment');
    console.log('   • Solved multi-step math problems');
    console.log('   • Broke down complex tasks into simple steps');
}

// Run the example
simpleExample().catch(console.error);
