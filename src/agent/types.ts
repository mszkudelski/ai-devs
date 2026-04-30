/**
 * Core types and interfaces for the reusable agent framework
 */

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
}

export interface ToolInput {
    [key: string]: any;
}

export interface AgentState {
    id: string;
    taskType: string;
    currentStep: number;
    history: AgentHistoryEntry[];
    context: Record<string, any>;
    tools: string[];
    status: AgentStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface AgentHistoryEntry {
    step: number;
    type: 'thought' | 'action' | 'observation' | 'reflection';
    content: string;
    toolName?: string;
    toolInput?: ToolInput;
    toolResult?: ToolResult;
    timestamp: Date;
}

export enum AgentStatus {
    IDLE = 'idle',
    PLANNING = 'planning',
    EXECUTING = 'executing',
    REFLECTING = 'reflecting',
    COMPLETED = 'completed',
    ERROR = 'error'
}

export interface PlanningResult {
    nextAction: string;
    reasoning: string;
    toolToUse?: string;
    toolInput?: ToolInput;
    shouldReflect: boolean;
}

export interface ReflectionResult {
    success: boolean;
    insights: string[];
    nextSteps: string[];
    shouldContinue: boolean;
    adjustments?: Record<string, any>;
}

export interface AgentConfig {
    maxSteps?: number;
    maxRetries?: number;
    enableReflection?: boolean;
    enableLogging?: boolean;
    persistState?: boolean;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp?: Date;
}

export interface ChatHistory {
    messages: ChatMessage[];
    context: Record<string, any>;
}
