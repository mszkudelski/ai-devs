import { BaseAgent } from '../agent.js';
import { AgentConfig, AgentStatus } from '../types.js';
import { TextAnalyzerTool, CalculatorTool } from './example-tools.js';

/**
 * Example agent implementation demonstrating the framework usage
 * This agent can analyze text and perform calculations
 */
export class ExampleAgent extends BaseAgent {
    constructor(config?: AgentConfig) {
        super('example_task', config, 'example_agent');
    }

    protected initializeTools(): void {
        // Register available tools
        this.registerTool(new TextAnalyzerTool());
        this.registerTool(new CalculatorTool());
    }

    protected getTaskDescription(): string {
        return `I am an example agent that can analyze text and perform mathematical calculations. 
        I can help with tasks like:
        - Analyzing text properties (word count, sentiment, etc.)
        - Performing basic math operations (add, subtract, multiply, divide)
        - Combining these capabilities for complex analysis tasks`;
    }

    protected getObjectives(): string[] {
        return [
            'Understand user requests and determine appropriate tools to use',
            'Execute text analysis when text data is provided',
            'Perform calculations when mathematical operations are needed',
            'Provide comprehensive results combining multiple tool outputs',
            'Maintain context and build upon previous results'
        ];
    }

    /**
     * Custom method for analyzing text with calculations
     */
    async analyzeTextWithStats(text: string): Promise<any> {
        this.state.context.inputText = text;
        
        // Use the autonomous execution to handle this task
        return await this.executeTask(
            `Analyze the following text and provide comprehensive statistics: "${text}"`
        );
    }

    /**
     * Custom method for mathematical problem solving
     */
    async solveMathProblem(problem: string): Promise<any> {
        this.state.context.mathProblem = problem;
        
        return await this.executeTask(
            `Solve this mathematical problem: ${problem}`
        );
    }

    /**
     * Override getResults to provide formatted output
     */
    protected getResults(): any {
        const baseResults = super.getResults();
        
        return {
            ...baseResults,
            summary: this.generateSummary(),
            toolsUsed: this.getUsedTools(),
            insights: this.extractInsights()
        };
    }

    private generateSummary(): string {
        // Get only actions from the current task execution
        // Find the last occurrence of a 'thought' entry with 'Initial prompt' to identify task start
        let taskStartIndex = -1;
        for (let i = this.state.history.length - 1; i >= 0; i--) {
            if (this.state.history[i].type === 'thought' && 
                this.state.history[i].content.includes('Initial prompt:')) {
                taskStartIndex = i;
                break;
            }
        }
        
        const currentTaskActions = taskStartIndex >= 0 
            ? this.state.history.slice(taskStartIndex).filter(
                entry => entry.type === 'action' && entry.toolResult?.success
              )
            : this.state.history.filter(
                entry => entry.type === 'action' && entry.toolResult?.success
              ).slice(-5); // fallback to last 5 successful actions

        if (currentTaskActions.length === 0) {
            return 'No actions completed successfully in current task.';
        }

        const toolCounts = currentTaskActions.reduce((counts, action) => {
            const toolName = action.toolName || 'unknown';
            counts[toolName] = (counts[toolName] || 0) + 1;
            return counts;
        }, {} as Record<string, number>);

        const toolSummary = Object.entries(toolCounts)
            .map(([tool, count]) => `${tool} (${count}x)`)
            .join(', ');

        return `Completed ${currentTaskActions.length} actions using: ${toolSummary}`;
    }

    private getUsedTools(): string[] {
        // Get only tools used in the current task execution
        // Find the last occurrence of a 'thought' entry with 'Initial prompt' to identify task start
        let taskStartIndex = -1;
        for (let i = this.state.history.length - 1; i >= 0; i--) {
            if (this.state.history[i].type === 'thought' && 
                this.state.history[i].content.includes('Initial prompt:')) {
                taskStartIndex = i;
                break;
            }
        }
        
        const currentTaskActions = taskStartIndex >= 0 
            ? this.state.history.slice(taskStartIndex)
                .filter(entry => entry.type === 'action' && entry.toolName)
                .map(entry => entry.toolName!)
            : this.state.history
                .filter(entry => entry.type === 'action' && entry.toolName)
                .map(entry => entry.toolName!)
                .slice(-5); // fallback to last 5 tools used

        return [...new Set(currentTaskActions)];
    }

    private extractInsights(): string[] {
        const insights: string[] = [];
        
        // Get only the most recent reflection entries (from current task execution)
        // Find the last occurrence of a 'thought' entry with 'Initial prompt' to identify task start
        let taskStartIndex = -1;
        for (let i = this.state.history.length - 1; i >= 0; i--) {
            if (this.state.history[i].type === 'thought' && 
                this.state.history[i].content.includes('Initial prompt:')) {
                taskStartIndex = i;
                break;
            }
        }
        
        // Extract insights only from reflection entries after the current task started
        const currentTaskReflections = taskStartIndex >= 0 
            ? this.state.history.slice(taskStartIndex).filter(entry => entry.type === 'reflection')
            : this.state.history.filter(entry => entry.type === 'reflection').slice(-1); // fallback to just the last reflection
        
        for (const reflection of currentTaskReflections) {
            // Extract meaningful insights from the reflection content
            const lines = reflection.content.split('\n');
            
            // Look for lines that contain insights (usually bullet points with "-")
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Look for lines starting with "- " which contain insights
                if (line.startsWith('- ')) {
                    insights.push(line);
                }
                
                // Also look for lines after "What was learned from this action?"
                if (line.includes('What was learned from this action?')) {
                    // Look at the next few lines for insights
                    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                        const nextLine = lines[j].trim();
                        if (nextLine.startsWith('- ')) {
                            insights.push(nextLine);
                        } else if (nextLine.length > 0 && !nextLine.match(/^\d+\./)) {
                            // Stop if we hit another numbered question or empty line
                            break;
                        }
                    }
                }
            }
        }

        const result = insights.length > 0 ? [...new Set(insights)] : ['Task completed without specific insights recorded'];
        return result;
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
 * Factory function to create and configure an example agent
 */
export function createExampleAgent(config?: Partial<AgentConfig>): ExampleAgent {
    const defaultConfig: AgentConfig = {
        maxSteps: 10,  // Reduced from 20 to prevent infinite loops
        maxRetries: 2,
        enableReflection: true,
        enableLogging: true,
        persistState: false
    };

    return new ExampleAgent({ ...defaultConfig, ...config });
}

/**
 * Demo function showing various agent capabilities
 */
export async function runAgentDemo(): Promise<void> {
    console.log('🤖 Starting Agent Framework Demo\n');

    const agent = createExampleAgent();

    try {
        // Demo 1: Text Analysis
        console.log('📝 Demo 1: Text Analysis');
        const textResult = await agent.analyzeTextWithStats(
            'This is a fantastic example of artificial intelligence in action! The future looks amazing.'
        );
        console.log('\n📋 Text analysis summary:', {
            status: textResult.status,
            insights: textResult.insights
        });

        // Demo 2: Math Problem
        console.log('\n🔢 Demo 2: Math Problem');
        agent.resetForNewTask(); // Reset state for fresh start
        const mathResult = await agent.solveMathProblem(
            'Calculate 15 + 23, then multiply the result by 2'
        );
        console.log('\n📋 Math problem summary:', {
            status: mathResult.status,
            insights: mathResult.insights
        });

        // Demo 3: Interactive Chat
        console.log('\n💬 Demo 3: Interactive Chat');
        agent.resetForNewTask(); // Reset state for fresh start
        await agent.chat('What tools do you have available?');
        await agent.chat('Can you analyze the sentiment of "I love this framework"?');

        console.log('\n✅ Demo completed successfully!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
    }
}

// Export everything for easy usage
export { TextAnalyzerTool, CalculatorTool } from './example-tools.js';
