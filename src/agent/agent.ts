import { OpenAIService } from '../openai.service.js';
import { extractFromTags } from '../utils.js';
import { Tool, ToolRegistry } from './tool.js';
import { logger } from '../services/logging.service.js';
import {
    AgentState,
    AgentHistoryEntry,
    AgentStatus,
    AgentConfig,
    PlanningResult,
    ReflectionResult,
    ChatMessage,
    ChatHistory,
    ToolInput,
    ToolResult
} from './types.js';
import {
    createPlanningPrompt,
    createCompletionCheckPrompt,
    createErrorRecoveryPrompt
} from './planning.js';
import {
    createReflectionPrompt,
    createQualityAssessmentPrompt,
    createStrategyAdjustmentPrompt
} from './reflection.js';

/**
 * Base Agent class implementing ReAct pattern (Reasoning + Action + Observation)
 * Provides autonomous execution with planning, tool usage, and reflection
 */
export abstract class BaseAgent {
    protected openaiService: OpenAIService;
    protected toolRegistry: ToolRegistry;
    protected state: AgentState;
    protected config: AgentConfig;
    protected chatHistory: ChatHistory;

    constructor(
        taskType: string,
        config: AgentConfig = {},
        agentId?: string
    ) {
        this.openaiService = new OpenAIService();
        this.toolRegistry = new ToolRegistry();
        this.config = {
            maxSteps: 50,
            maxRetries: 3,
            enableReflection: true,
            enableLogging: true,
            persistState: false,
            ...config
        };

        this.state = {
            id: agentId || `agent_${Date.now()}`,
            taskType,
            currentStep: 0,
            history: [],
            context: {},
            tools: [],
            status: AgentStatus.IDLE,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.chatHistory = {
            messages: [],
            context: {}
        };

        this.initializeTools();
    }

    /**
     * Abstract method - implement tool registration in subclasses
     */
    protected abstract initializeTools(): void;

    /**
     * Abstract method - implement task-specific planning prompts in subclasses
     */
    protected abstract getTaskDescription(): string;

    /**
     * Abstract method - implement task objectives in subclasses
     */
    protected abstract getObjectives(): string[];

    /**
     * Register a tool with the agent
     */
    protected registerTool(tool: Tool): void {
        this.toolRegistry.register(tool);
        if (!this.state.tools.includes(tool.name)) {
            this.state.tools.push(tool.name);
        }
    }

    /**
     * Execute a task autonomously using ReAct pattern
     */
    async executeTask(initialPrompt?: string): Promise<any> {
        try {
            this.updateStatus(AgentStatus.PLANNING);
            
            if (initialPrompt) {
                console.log(`🤖 Starting task: ${initialPrompt}`);
                this.addToHistory('thought', `Initial prompt: ${initialPrompt}`);
                this.state.context.initialPrompt = initialPrompt;
                await logger.logAgentStep(this.state.id, 0, 'Task started', { prompt: initialPrompt });
            }

            // Main execution loop
            while (this.state.currentStep < this.config.maxSteps! && this.state.status !== AgentStatus.COMPLETED) {
                this.state.currentStep++;
                this.state.updatedAt = new Date();

                // Safety check: if we've been in error state for too many steps, break
                const recentErrors = this.state.history
                    .slice(-5)
                    .filter(entry => entry.type === 'action' && !entry.toolResult?.success).length;
                
                if (recentErrors >= 3) {
                    console.log('❌ Too many consecutive errors, stopping execution');
                    await logger.error(`agent-${this.state.id}`, 'Too many consecutive errors', { step: this.state.currentStep });
                    this.updateStatus(AgentStatus.ERROR);
                    break;
                }

                // Planning phase
                const planningResult = await this.plan();
                if (!planningResult) {
                    this.updateStatus(AgentStatus.ERROR);
                    break;
                }

                // Action phase
                const actionResult = await this.executeAction(planningResult);
                
                // Observation phase
                this.addToHistory('observation', `Action result: ${JSON.stringify(actionResult, null, 2)}`);

                // Reflection phase (if enabled and needed)
                if (this.config.enableReflection && planningResult.shouldReflect) {
                    await this.reflect();
                }

                // Check if task is complete
                if (await this.isTaskComplete()) {
                    this.updateStatus(AgentStatus.COMPLETED);
                    break;
                }

                // Additional safety: if we have successful results and are past minimum steps, check completion more aggressively
                if (this.state.currentStep >= 5) {
                    const hasSuccessfulActions = this.state.history.some(
                        entry => entry.type === 'action' && entry.toolResult?.success
                    );
                    
                    if (hasSuccessfulActions && Math.random() < 0.3) { // 30% chance to force completion check
                        await logger.debug(`agent-${this.state.id}`, 'Safety check: Forcing completion evaluation');
                        if (await this.isTaskComplete()) {
                            this.updateStatus(AgentStatus.COMPLETED);
                            break;
                        }
                    }
                }
            }

            const results = this.getResults();
            const completedActions = this.state.history.filter(
                entry => entry.type === 'action' && entry.toolResult?.success
            ).length;
            
            console.log(`📊 Task finished: ${this.state.status} after ${this.state.currentStep} steps (${completedActions} successful actions)`);
            await logger.info(`agent-${this.state.id}`, 'Task execution completed', { 
                status: this.state.status, 
                steps: this.state.currentStep, 
                successfulActions: completedActions,
                results 
            });

            return results;
        } catch (error) {
            this.updateStatus(AgentStatus.ERROR);
            this.addToHistory('observation', `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    /**
     * Interactive chat interface for conversational agent use
     */
    async chat(message: string): Promise<string> {
        console.log(`👤 User: ${message}`);
        
        this.chatHistory.messages.push({
            role: 'user',
            content: message,
            timestamp: new Date()
        });

        // Use planning to determine how to respond
        const response = await this.generateChatResponse(message);
        
        console.log(`🤖 Agent: ${response}`);
        
        this.chatHistory.messages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date()
        });

        await logger.info(`agent-${this.state.id}`, 'Chat interaction', { userMessage: message, agentResponse: response });

        return response;
    }

    /**
     * Planning phase - determine next action
     */
    protected async plan(): Promise<PlanningResult | null> {
        try {
            this.updateStatus(AgentStatus.PLANNING);
            
            const planningPrompt = createPlanningPrompt({
                taskDescription: this.getTaskDescription(),
                availableTools: this.toolRegistry.list(),
                currentContext: this.state.context,
                previousSteps: this.getRecentSteps(),
                objectives: this.getObjectives()
            });

            const response = await this.openaiService.getChatResponse(planningPrompt);
            
            const thinking = extractFromTags(response, 'thinking');
            const action = extractFromTags(response, 'action');
            const reflectionNeeded = extractFromTags(response, 'reflection_needed').toLowerCase() === 'yes';

            this.addToHistory('thought', thinking);

            // Parse action details
            const toolName = this.extractValue(action, 'Tool to use');
            const reasoning = this.extractValue(action, 'Reasoning');
            const inputText = this.extractValue(action, 'Input');

            let toolInput: ToolInput = {};
            try {
                // Try to parse as JSON first
                toolInput = JSON.parse(inputText);
            } catch {
                // If not valid JSON, parse based on tool type
                const cleanInput = inputText.trim();
                
                if (cleanInput.startsWith('"') && cleanInput.endsWith('"')) {
                    // It's a quoted string, remove quotes
                    const unquotedInput = cleanInput.slice(1, -1);
                    toolInput = this.parseToolInput(toolName, unquotedInput);
                } else {
                    toolInput = this.parseToolInput(toolName, cleanInput);
                }
            }

            const planningResult: PlanningResult = {
                nextAction: action,
                reasoning,
                toolToUse: toolName,
                toolInput,
                shouldReflect: reflectionNeeded
            };

            console.log(`💭 Planning: ${reasoning}`);
            this.addToHistory('thought', `Planning: ${reasoning}`);
            await logger.logAgentStep(this.state.id, this.state.currentStep, 'Planning completed', planningResult);
            
            return planningResult;
        } catch (error) {
            console.error('Planning error:', error);
            return null;
        }
    }

    /**
     * Execute an action using the specified tool
     */
    protected async executeAction(planningResult: PlanningResult): Promise<ToolResult> {
        try {
            this.updateStatus(AgentStatus.EXECUTING);

            if (!planningResult.toolToUse) {
                return {
                    success: false,
                    error: 'No tool specified in planning result'
                };
            }

            const tool = this.toolRegistry.get(planningResult.toolToUse);
            if (!tool) {
                return {
                    success: false,
                    error: `Tool '${planningResult.toolToUse}' not found`
                };
            }

            console.log(`🔧 ${tool.name}`);
            await logger.logToolExecution(tool.name, planningResult.toolInput, null);

            const result = await tool.execute(planningResult.toolInput || {});
            
            this.addToHistory('action', `Used tool: ${tool.name}`, tool.name, planningResult.toolInput, result);
            
            if (result.success && result.data) {
                // Update context with tool results
                this.state.context[`${tool.name}_result`] = result.data;
                console.log(`✅ ${tool.name} completed successfully`);
            } else {
                console.log(`❌ ${tool.name} failed: ${result.error}`);
            }

            await logger.logToolExecution(tool.name, planningResult.toolInput, result);

            return result;
        } catch (error) {
            const errorResult: ToolResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            
            this.addToHistory('action', `Tool execution failed: ${errorResult.error}`);
            return errorResult;
        }
    }

    /**
     * Reflection phase - evaluate progress and adjust strategy
     */
    protected async reflect(): Promise<ReflectionResult> {
        try {
            this.updateStatus(AgentStatus.REFLECTING);

            const lastEntry = this.state.history[this.state.history.length - 1];
            const completedSteps = this.getCompletedSteps();

            const reflectionPrompt = createReflectionPrompt({
                lastAction: lastEntry?.content || 'No previous action',
                actionResult: lastEntry?.toolResult?.data || 'No result',
                currentObjectives: this.getObjectives(),
                completedSteps,
                overallProgress: this.state.context
            });

            const response = await this.openaiService.getChatResponse(reflectionPrompt);
            
            const evaluation = extractFromTags(response, 'action_evaluation');
            const insights = extractFromTags(response, 'insights').split('\n').filter(line => line.trim().startsWith('-'));
            const nextSteps = extractFromTags(response, 'next_steps').split('\n').filter(line => line.trim().match(/^\d+\./));
            const shouldContinue = extractFromTags(response, 'should_continue').toLowerCase() === 'yes';
            const adjustments = extractFromTags(response, 'adjustments');

            const reflectionResult: ReflectionResult = {
                success: true,
                insights: insights.map(insight => insight.replace(/^-\s*/, '').trim()),
                nextSteps: nextSteps.map(step => step.replace(/^\d+\.\s*/, '').trim()),
                shouldContinue,
                adjustments: adjustments ? { strategy: adjustments } : undefined
            };

            this.addToHistory('reflection', `Reflection: ${evaluation}`);
            
            console.log('🤔 Reflecting on progress...');
            await logger.info(`agent-${this.state.id}`, 'Reflection completed', reflectionResult);

            return reflectionResult;
        } catch (error) {
            console.error('Reflection error:', error);
            return {
                success: false,
                insights: [],
                nextSteps: [],
                shouldContinue: true
            };
        }
    }

    /**
     * Check if the task is complete
     */
    protected async isTaskComplete(): Promise<boolean> {
        try {
            // First check if we have sufficient results
            const hasResults = Object.keys(this.state.context).some(key => 
                key.endsWith('_result') && this.state.context[key]
            );

            if (!hasResults) {
                return false;
            }

            // Check if we've made progress in recent steps
            const recentActions = this.state.history
                .slice(-3)
                .filter(entry => entry.type === 'action' && entry.toolResult?.success);

            if (recentActions.length === 0 && this.state.currentStep > 3) {
                // No successful actions in recent steps, might be stuck
                await logger.warn(`agent-${this.state.id}`, 'No successful actions in recent steps, considering task complete');
                return true;
            }

            // Use LLM to evaluate completion
            const completionPrompt = createCompletionCheckPrompt(
                this.getTaskDescription(),
                this.getObjectives(),
                this.state.context
            );

            const response = await this.openaiService.getChatResponse(completionPrompt);
            const status = extractFromTags(response, 'completion_status');
            
            const isComplete = status.includes('COMPLETE') && !status.includes('INCOMPLETE');
            
            if (isComplete) {
                console.log('✅ Task completed successfully');
            }
            
            await logger.info(`agent-${this.state.id}`, `Completion check: ${isComplete ? 'COMPLETE' : 'INCOMPLETE'}`, { status });
            
            return isComplete;
        } catch (error) {
            console.error('Completion check error:', error);
            // If completion check fails, consider task complete after reasonable number of steps
            return this.state.currentStep >= (this.config.maxSteps! * 0.8);
        }
    }

    /**
     * Generate chat response for interactive mode
     */
    protected async generateChatResponse(userMessage: string): Promise<string> {
        const context = this.chatHistory.messages.slice(-10); // Keep last 10 messages
        
        const prompt = `You are an AI agent assistant. Respond to the user's message in a helpful and conversational way.

Chat History:
${context.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current User Message: ${userMessage}

Provide a helpful response. If the user is asking about your capabilities or current task, explain based on your context.`;

        return await this.openaiService.getChatResponse(prompt, 'gpt-4.1');
    }

    // Utility methods

    protected updateStatus(status: AgentStatus): void {
        this.state.status = status;
        this.state.updatedAt = new Date();
    }

    protected addToHistory(
        type: 'thought' | 'action' | 'observation' | 'reflection',
        content: string,
        toolName?: string,
        toolInput?: ToolInput,
        toolResult?: ToolResult
    ): void {
        const entry: AgentHistoryEntry = {
            step: this.state.currentStep,
            type,
            content,
            toolName,
            toolInput,
            toolResult,
            timestamp: new Date()
        };

        this.state.history.push(entry);
    }

    protected getRecentSteps(count: number = 5): string[] {
        return this.state.history
            .slice(-count)
            .map(entry => `${entry.type}: ${entry.content}`)
            .filter(step => step.length > 0);
    }

    protected getCompletedSteps(): string[] {
        return this.state.history
            .filter(entry => entry.type === 'action' && entry.toolResult?.success)
            .map(entry => `${entry.toolName}: ${entry.content}`);
    }

    protected extractValue(text: string, key: string): string {
        const regex = new RegExp(`${key}:\\s*(.+?)(?:\\n|$)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    }

    /**
     * Get current results - override in subclasses for specific result format
     */
    protected getResults(): any {
        return {
            status: this.state.status,
            steps: this.state.currentStep,
            context: this.state.context,
            completed: this.state.status === AgentStatus.COMPLETED
        };
    }

    // Public getters
    public getState(): AgentState {
        return { ...this.state };
    }

    public getHistory(): AgentHistoryEntry[] {
        return [...this.state.history];
    }

    public getAvailableTools(): string[] {
        return this.toolRegistry.list();
    }

    public getChatHistory(): ChatHistory {
        return { ...this.chatHistory };
    }

    /**
     * Parse tool input based on tool type and natural language input
     */
    protected parseToolInput(toolName: string, input: string): ToolInput {
        switch (toolName) {
            case 'text_analyzer':
                return { text: input };
                
            case 'calculator':
                return this.parseCalculatorInput(input);
                
            default:
                // For unknown tools, try to be smart about input format
                return { input };
        }
    }

    /**
     * Parse calculator input from natural language
     */
    protected parseCalculatorInput(input: string): ToolInput {
        // Remove common words and normalize
        const normalized = input.toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        // Try to extract numbers
        const numbers = input.match(/\d+(?:\.\d+)?/g);
        if (!numbers || numbers.length < 2) {
            throw new Error('Calculator requires at least two numbers. For multi-step calculations, break them down into individual operations.');
        }

        const a = parseFloat(numbers[0]);
        const b = parseFloat(numbers[1]);

        // Determine operation based on keywords or symbols
        let operation = 'add'; // default
        
        if (normalized.includes('add') || normalized.includes('+') || normalized.includes('plus')) {
            operation = 'add';
        } else if (normalized.includes('subtract') || normalized.includes('-') || normalized.includes('minus')) {
            operation = 'subtract';
        } else if (normalized.includes('multiply') || normalized.includes('*') || normalized.includes('times') || normalized.includes('×')) {
            operation = 'multiply';
        } else if (normalized.includes('divide') || normalized.includes('/') || normalized.includes('÷')) {
            operation = 'divide';
        }

        return { operation, a, b };
    }
}
