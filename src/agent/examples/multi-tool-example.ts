import { BaseAgent } from '../agent.js';
import { AgentConfig, AgentStatus } from '../types.js';
import { TextAnalyzerTool, CalculatorTool } from './example-tools.js';
import { Tool } from '../tool.js';
import { ToolInput } from '../types.js';

/**
 * Data Processing Tool - simulates processing structured data
 */
class DataProcessorTool extends Tool {
    constructor() {
        super(
            'data_processor',
            'Processes structured data and extracts metrics',
            true
        );
    }

    protected async run(input: ToolInput): Promise<any> {
        const { data, metric } = input;
        
        if (!Array.isArray(data)) {
            throw new Error('Data must be an array');
        }

        switch (metric) {
            case 'average':
                const numbers = data.filter(item => typeof item === 'number');
                if (numbers.length === 0) return { result: 0, count: 0 };
                return {
                    result: numbers.reduce((a, b) => a + b, 0) / numbers.length,
                    count: numbers.length,
                    metric: 'average'
                };
            
            case 'max':
                const maxNumbers = data.filter(item => typeof item === 'number');
                if (maxNumbers.length === 0) return { result: null, count: 0 };
                return {
                    result: Math.max(...maxNumbers),
                    count: maxNumbers.length,
                    metric: 'maximum'
                };
            
            case 'count':
                return {
                    result: data.length,
                    count: data.length,
                    metric: 'count'
                };
            
            default:
                throw new Error(`Unsupported metric: ${metric}`);
        }
    }

    protected validate(input: ToolInput): { valid: boolean; error?: string } {
        if (!input.data) {
            return { valid: false, error: 'Data array is required' };
        }
        
        if (!input.metric) {
            return { valid: false, error: 'Metric type is required' };
        }

        return { valid: true };
    }

    getSchema(): any {
        return {
            name: this.name,
            description: this.description,
            parameters: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        description: 'Array of data to process'
                    },
                    metric: {
                        type: 'string',
                        enum: ['average', 'max', 'count'],
                        description: 'Type of metric to calculate'
                    }
                },
                required: ['data', 'metric']
            }
        };
    }
}

/**
 * Multi-Tool Example Agent
 * Demonstrates using multiple tools together to complete complex tasks
 */
export class MultiToolAgent extends BaseAgent {
    constructor(config?: AgentConfig) {
        super('multi_tool_analysis', config, 'multi_tool_agent');
    }

    protected initializeTools(): void {
        // Register all available tools
        this.registerTool(new TextAnalyzerTool());
        this.registerTool(new CalculatorTool());
        this.registerTool(new DataProcessorTool());
    }

    protected getTaskDescription(): string {
        return `I am a multi-tool analysis agent that can:
        - Analyze text content for insights and metrics
        - Perform mathematical calculations and data processing
        - Extract structured information from mixed content
        - Combine multiple tools to provide comprehensive analysis
        
        I excel at tasks that require coordination between different types of analysis.`;
    }

    protected getObjectives(): string[] {
        return [
            'Analyze provided content using appropriate tools',
            'Coordinate multiple tools to achieve comprehensive results',
            'Extract meaningful insights from text and numerical data',
            'Perform calculations based on extracted information',
            'Provide structured reports combining all findings'
        ];
    }

    /**
     * Analyze a document containing both text and numerical data
     */
    async analyzeDocument(content: string): Promise<any> {
        this.state.context.document = content;
        
        const prompt = `Analyze this document thoroughly using all available tools:

"${content}"

Your task:
1. First, analyze the text content for readability and sentiment
2. Extract any numerical data and calculate relevant statistics
3. If there are any mathematical expressions, solve them
4. Provide a comprehensive summary of findings

Use multiple tools to gather complete information.`;

        return await this.executeTask(prompt);
    }

    /**
     * Process survey data with text responses and ratings
     */
    async processSurveyData(responses: Array<{text: string, rating: number}>): Promise<any> {
        this.state.context.surveyData = responses;
        
        const prompt = `Process this survey data comprehensively:

Survey Responses:
${responses.map((r, i) => `Response ${i+1}: "${r.text}" (Rating: ${r.rating})`).join('\n')}

Your task:
1. Analyze the sentiment of all text responses
2. Calculate statistics for the numerical ratings (average, max, count)
3. Identify any patterns or insights
4. Provide a summary report

Use appropriate tools for text analysis and data processing.`;

        return await this.executeTask(prompt);
    }

    /**
     * Analyze financial report with text and numbers
     */
    async analyzeFinancialReport(report: string, expenses: number[], revenue: number[]): Promise<any> {
        this.state.context.financialData = { report, expenses, revenue };
        
        const prompt = `Analyze this financial report and data:

Report Text:
"${report}"

Expenses: [${expenses.join(', ')}]
Revenue: [${revenue.join(', ')}]

Your task:
1. Analyze the sentiment and key themes in the report text
2. Calculate average, maximum expenses and revenue
3. Calculate total profit (sum of revenue minus sum of expenses)
4. Provide insights combining text analysis with financial calculations

Use text analysis, data processing, and calculator tools as needed.`;

        return await this.executeTask(prompt);
    }

    /**
     * Reset agent state for a fresh start (useful between demo tasks)
     */
    public resetForNewTask(): void {
        // Clear history but keep basic configuration
        this.state.history = [];
        this.state.currentStep = 0;
        this.state.context = {};
        this.updateStatus(AgentStatus.IDLE);
        
        // Clear chat history too
        this.chatHistory.messages = [];
        this.chatHistory.context = {};
    }
}

/**
 * Factory function to create a multi-tool agent
 */
export function createMultiToolAgent(config?: Partial<AgentConfig>): MultiToolAgent {
    const defaultConfig: AgentConfig = {
        maxSteps: 15,
        maxRetries: 2,
        enableReflection: true,
        enableLogging: true,
        persistState: false
    };

    return new MultiToolAgent({ ...defaultConfig, ...config });
}

/**
 * Demo showing multi-tool coordination
 */
export async function runMultiToolDemo(): Promise<void> {
    console.log('🔧 Starting Multi-Tool Agent Demo\n');

    const agent = createMultiToolAgent();

    try {
        // Demo 1: Document Analysis
        console.log('📄 Demo 1: Document Analysis with Mixed Content');
        const docResult = await agent.analyzeDocument(
            `This excellent quarterly report shows outstanding performance. Our team achieved amazing results this quarter. 
            Key metrics: Sales increased by 25%, customer satisfaction rating of 4.8/5.0, and we processed 1,250 orders.
            Calculate total revenue if each order averages $45.`
        );
        console.log('\n📋 Document analysis completed:', {
            status: docResult.status,
            toolsUsed: docResult.toolsUsed,
            insights: docResult.insights?.slice(0, 3) // Show first 3 insights
        });

        // Demo 2: Survey Data Processing
        console.log('\n📊 Demo 2: Survey Data Processing');
        agent.resetForNewTask();
        const surveyData = [
            { text: "This product is amazing! I love using it every day.", rating: 5 },
            { text: "Good quality but could be better. Satisfied overall.", rating: 4 },
            { text: "Disappointed with the service. Not what I expected.", rating: 2 },
            { text: "Excellent customer support and fantastic features!", rating: 5 },
            { text: "Average product, nothing special about it.", rating: 3 }
        ];
        
        const surveyResult = await agent.processSurveyData(surveyData);
        console.log('\n📋 Survey analysis completed:', {
            status: surveyResult.status,
            toolsUsed: surveyResult.toolsUsed,
            insights: surveyResult.insights?.slice(0, 3)
        });

        // Demo 3: Financial Report Analysis
        console.log('\n💰 Demo 3: Financial Report Analysis');
        agent.resetForNewTask();
        const financialResult = await agent.analyzeFinancialReport(
            "This month showed excellent growth with outstanding performance across all departments. Sales team exceeded targets and customer feedback was very positive.",
            [12000, 8500, 15000, 9200, 11800], // expenses
            [25000, 18000, 32000, 21000, 28000] // revenue
        );
        console.log('\n📋 Financial analysis completed:', {
            status: financialResult.status,
            toolsUsed: financialResult.toolsUsed,
            insights: financialResult.insights?.slice(0, 3)
        });

        console.log('\n✅ Multi-Tool Demo completed successfully!');
        console.log('\n💡 This demo showed how an agent can coordinate multiple tools:');
        console.log('   • Text analysis for sentiment and readability');
        console.log('   • Calculator for mathematical operations');
        console.log('   • Data processor for statistical analysis');
        console.log('   • Intelligent tool selection based on task requirements');
        
    } catch (error) {
        console.error('❌ Multi-Tool Demo failed:', error);
    }
}

// Quick example usage
export async function quickMultiToolExample(): Promise<void> {
    console.log('⚡ Quick Multi-Tool Example\n');
    
    const agent = createMultiToolAgent({ maxSteps: 10 });
    
    const result = await agent.analyzeDocument(
        `Great news! Our customer satisfaction is at an all-time high. 
         Survey results: [4.2, 4.8, 4.1, 4.9, 4.3, 4.7] out of 5.0.
         Calculate the average satisfaction score.`
    );
    
    console.log('🎯 Task completed!');
    console.log('📊 Tools used:', result.toolsUsed);
    console.log('💭 Key insights:', result.insights?.slice(0, 2));
    console.log('✨ Status:', result.status);
}
