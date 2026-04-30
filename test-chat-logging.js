// Test chat interaction with new logging
import { createExampleAgent } from './src/agent/examples/example-agent.js';

async function testChatLogging() {
    console.log('🧪 Testing chat logging...\n');

    try {
        const agent = createExampleAgent();
        
        // Test chat interactions
        await agent.chat('What tools do you have available?');
        await agent.chat('Can you calculate 25 + 17?');
        
        console.log('\n✅ Chat test completed!');
        console.log('Check the agent log for chat interactions.');
        
    } catch (error) {
        console.error('❌ Chat test failed:', error);
    }
}

testChatLogging();
