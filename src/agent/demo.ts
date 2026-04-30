#!/usr/bin/env node
/**
 * Demo script for the reusable agent framework
 * Run this to see the framework in action
 */

import { runAgentDemo } from './examples/example-agent.js';

async function main() {
    try {
        await runAgentDemo();
    } catch (error) {
        console.error('Demo failed:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
