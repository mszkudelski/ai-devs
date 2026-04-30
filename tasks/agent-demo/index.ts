/**
 * Agent Framework Demo Task
 * 
 * This task demonstrates the reusable agent framework capabilities
 * Run with: npm run start --dir=agent-demo
 */

import { runAgentDemo } from '../../src/agent/examples/example-agent.js';

async function main() {
    try {
        console.log('🎯 Agent Framework Demo Task\n');
        console.log('Testing the reusable agent framework...\n');
        
        await runAgentDemo();
        
        console.log('\n🎉 Agent framework demo completed successfully!');
        console.log('\nFramework is ready for use in real tasks like S05E01');
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
        
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
        }
        
        process.exit(1);
    }
}

// Execute the demo
main();
