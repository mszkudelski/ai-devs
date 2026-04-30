#!/usr/bin/env tsx

/**
 * Clean Agent Example - Question → Steps → Answer
 * 
 * Run with: npm run start --dir=simple-agent-demo
 */

import { createExampleAgent } from '../../src/agent/examples/example-agent.js';

async function main() {
    console.log('🎯 Simple Agent Demo\n');
    
    // Create agent with minimal logging for clean output
    const agent = createExampleAgent({
        maxSteps: 5,
        enableReflection: false,
        enableLogging: false
    });

    try {
        // Example: Combined text analysis and math
        console.log('📋 USER REQUEST:');
        console.log('   "Analyze this text and then calculate: How many words per sentence?"');
        console.log('   Text: "AI is amazing. It helps us work faster. The future is bright!"');
        console.log('');

        console.log('🔄 AGENT STEPS:');
        
        // Step 1: Analyze the text
        console.log('   1. 🔍 Analyzing text properties...');
        const textResult = await agent.analyzeTextWithStats(
            'AI is amazing. It helps us work faster. The future is bright!'
        );
        
        const words = textResult.context.text_analyzer_result?.wordCount || 0;
        const sentences = textResult.context.text_analyzer_result?.sentenceCount || 1;
        
        console.log(`      ✅ Found: ${words} words, ${sentences} sentences`);
        
        // Step 2: Calculate words per sentence
        agent.resetForNewTask();
        console.log('   2. 🧮 Calculating words per sentence...');
        const mathResult = await agent.solveMathProblem(
            `Calculate ${words} divided by ${sentences}`
        );
        
        const wordsPerSentence = mathResult.context.calculator_result?.result || 0;
        console.log(`      ✅ Calculation: ${words} ÷ ${sentences} = ${wordsPerSentence}`);

        console.log('');
        console.log('✅ FINAL ANSWER:');
        console.log(`   📊 Text Analysis: ${words} words, ${sentences} sentences`);
        console.log(`   😊 Sentiment: ${textResult.context.text_analyzer_result?.sentiment}`);
        console.log(`   🎯 Words per sentence: ${wordsPerSentence}`);
        
        console.log('\n🎉 Task completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
