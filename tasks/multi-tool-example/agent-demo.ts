/**
 * Real Agent Multi-Tool Example
 * 
 * This demonstrates an actual agent using the agent framework
 * to autonomously coordinate multiple tools for complex tasks.
 */

import { createMultiToolAgent } from "../../src/agent/examples/multi-tool-example.js";

/**
 * Agent-based multi-tool demonstration
 */
async function executeAgentMultiToolDemo(): Promise<void> {
    console.log('🤖 AGENT MULTI-TOOL COORDINATION DEMO');
    console.log('=' .repeat(60));
    console.log('This demo shows an autonomous agent coordinating multiple tools\n');

    // Create the agent with proper configuration
    const agent = createMultiToolAgent({
        maxSteps: 12,
        enableReflection: true,
        enableLogging: true,
        persistState: false
    });

    try {
        // Demo 1: Customer Feedback Analysis
        console.log('📊 Demo 1: Customer Feedback Analysis with Agent');
        console.log('-'.repeat(50));
        console.log('🎯 Task: Analyze customer feedback and ratings comprehensively\n');

        const feedbackData = [
            { text: "This product is absolutely amazing! Best purchase ever!", rating: 5 },
            { text: "Good quality but shipping was slow. Overall satisfied.", rating: 4 },
            { text: "Poor customer service. Very disappointed.", rating: 2 },
            { text: "Excellent features and fantastic design!", rating: 5 },
            { text: "Average product, nothing special.", rating: 3 }
        ];

        console.log('📝 Input Data:');
        feedbackData.forEach((item, i) => {
            console.log(`   ${i+1}. "${item.text}" (Rating: ${item.rating}/5)`);
        });
        console.log('');

        console.log('🤖 Agent starting autonomous analysis...\n');
        
        const result1 = await agent.processSurveyData(feedbackData);
        
        console.log('\n✅ Agent Analysis Complete!');
        console.log('📊 Results Summary:');
        console.log(`   • Status: ${result1.status}`);
        console.log(`   • Steps Taken: ${result1.executionDetails?.totalSteps || 'N/A'}`);
        console.log(`   • Tools Used: ${result1.toolsUsed?.join(', ') || 'None recorded'}`);
        
        if (result1.insights && result1.insights.length > 0) {
            console.log('   • Key Insights:');
            result1.insights.slice(0, 3).forEach((insight: string) => {
                console.log(`     - ${insight.replace('- ', '')}`);
            });
        }

        console.log('\n' + '🔗'.repeat(30) + '\n');

        // Demo 2: Business Document Analysis
        console.log('📈 Demo 2: Business Document Analysis with Agent');
        console.log('-'.repeat(50));
        console.log('🎯 Task: Analyze business report with mixed text and numerical data\n');

        // Reset agent for new task
        agent.resetForNewTask();

        const businessDocument = `
        Q3 Performance Report: Outstanding Results Achieved!
        
        This quarter has been absolutely excellent for our company with fantastic growth.
        Customer satisfaction reached new heights and our team delivered amazing results.
        
        Key Metrics:
        - Customer satisfaction scores: [4.2, 4.8, 4.6, 4.9, 4.3, 4.7, 4.5]
        - Monthly revenue growth: 23% increase over Q2
        - We processed 2,847 orders this quarter
        - Average order value increased to $67.50
        
        Financial Performance:
        - Monthly expenses: [45000, 52000, 48000]
        - Monthly revenue: [89000, 95000, 102000]
        
        The team's performance was outstanding and customer feedback overwhelmingly positive.
        Calculate our total quarterly profit and average customer satisfaction score.
        `;

        console.log('📄 Document Content:');
        console.log(businessDocument.trim());
        console.log('');

        console.log('🤖 Agent starting autonomous document analysis...\n');

        const result2 = await agent.analyzeDocument(businessDocument);

        console.log('\n✅ Agent Document Analysis Complete!');
        console.log('📊 Results Summary:');
        console.log(`   • Status: ${result2.status}`);
        console.log(`   • Steps Taken: ${result2.executionDetails?.totalSteps || 'N/A'}`);
        console.log(`   • Tools Used: ${result2.toolsUsed?.join(', ') || 'None recorded'}`);
        
        if (result2.insights && result2.insights.length > 0) {
            console.log('   • Key Insights:');
            result2.insights.slice(0, 3).forEach((insight: string) => {
                console.log(`     - ${insight.replace('- ', '')}`);
            });
        }

        console.log('\n' + '🔗'.repeat(30) + '\n');

        // Demo 3: Financial Analysis
        console.log('💰 Demo 3: Financial Report Analysis with Agent');
        console.log('-'.repeat(50));
        console.log('🎯 Task: Comprehensive financial analysis with sentiment and calculations\n');

        // Reset agent for new task
        agent.resetForNewTask();

        const financialReport = "The company demonstrated excellent growth this quarter with outstanding performance across all departments. Revenue exceeded expectations magnificently.";
        const expenses = [125000, 134000, 118000, 145000, 128000];
        const revenue = [245000, 267000, 289000, 301000, 278000];

        console.log('📄 Financial Report:');
        console.log(`   Text: "${financialReport}"`);
        console.log(`   Expenses: [${expenses.join(', ')}]`);
        console.log(`   Revenue: [${revenue.join(', ')}]`);
        console.log('');

        console.log('🤖 Agent starting autonomous financial analysis...\n');

        const result3 = await agent.analyzeFinancialReport(financialReport, expenses, revenue);

        console.log('\n✅ Agent Financial Analysis Complete!');
        console.log('📊 Results Summary:');
        console.log(`   • Status: ${result3.status}`);
        console.log(`   • Steps Taken: ${result3.executionDetails?.totalSteps || 'N/A'}`);
        console.log(`   • Tools Used: ${result3.toolsUsed?.join(', ') || 'None recorded'}`);
        
        if (result3.insights && result3.insights.length > 0) {
            console.log('   • Key Insights:');
            result3.insights.slice(0, 3).forEach((insight: string) => {
                console.log(`     - ${insight.replace('- ', '')}`);
            });
        }

        // Final Summary
        console.log('\n' + '🎯'.repeat(30));
        console.log('✅ AGENT MULTI-TOOL DEMO COMPLETED SUCCESSFULLY!\n');
        
        console.log('🤖 What the Agent Accomplished:');
        console.log('   • Autonomously selected appropriate tools for each task');
        console.log('   • Coordinated text analysis, data processing, and calculations');
        console.log('   • Made intelligent decisions about tool usage sequence');
        console.log('   • Generated comprehensive insights from mixed data types');
        console.log('   • Demonstrated real autonomous multi-tool coordination');
        
        console.log('\n🔧 Agent Framework Features Demonstrated:');
        console.log('   • Autonomous task planning and execution');
        console.log('   • Intelligent tool selection based on task requirements');
        console.log('   • Multi-step reasoning with tool coordination');
        console.log('   • Reflection and insight generation');
        console.log('   • State management between different tasks');

        console.log('\n🚀 This showcases true agent-based multi-tool coordination!');

    } catch (error) {
        console.error('❌ Agent demo execution failed:', error);
        throw error;
    }
}

// Execute the agent-based demo
executeAgentMultiToolDemo().catch(console.error);
