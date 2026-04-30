// Simple test to check if the new logging system works
import { createExampleAgent } from './src/agent/examples/example-agent.js';

async function testLogging() {
    console.log('🧪 Testing new logging system...\n');

    try {
        const agent = createExampleAgent();
        
        // Test a simple task
        console.log('Running agent with a simple text analysis task...\n');
        await agent.analyzeTextWithStats('Hello world! This is a test message.');
        
        console.log('\n✅ Test completed!');
        console.log('\n📁 Check the logs/ directory for detailed logs:');
        console.log('- logs/openai-prompts.log');
        console.log('- logs/openai-responses.log'); 
        console.log('- logs/agent-*.log');
        console.log('- logs/tool-execution.log');
        console.log('- logs/general.log');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testLogging();
