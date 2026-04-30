import { runAgentDemo } from './src/agent/examples/example-agent.js';

/**
 * Test script to demonstrate the new clean logging system
 */
async function testCleanLogging(): Promise<void> {
    console.log('🧪 Testing Agent Framework with Clean Logging\n');
    
    try {
        await runAgentDemo();
        
        console.log('\n📁 Check the logs/ directory for detailed logs:');
        console.log('- logs/openai-prompts.log - All AI prompts');
        console.log('- logs/openai-responses.log - All AI responses with token counts');
        console.log('- logs/agent-*.log - Agent step-by-step execution');
        console.log('- logs/tool-execution.log - Tool usage details');
        console.log('- logs/general.log - All logs combined');
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testCleanLogging();
