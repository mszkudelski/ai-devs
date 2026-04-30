#!/usr/bin/env tsx

import { createExampleAgent } from './src/agent/examples/example-agent.js';

async function testCalculator() {
    console.log('🧪 Testing Calculator Demo\n');
    
    const agent = createExampleAgent({
        maxSteps: 5,
        enableReflection: true,
        enableLogging: true
    });

    try {
        const result = await agent.solveMathProblem('Calculate 15 + 23, then multiply the result by 2');
        
        console.log('\n📊 Final Result:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n✅ Calculator demo completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testCalculator();
