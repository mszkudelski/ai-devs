import { ToolInput, ToolResult } from './types.js';

/**
 * Abstract base class for all agent tools
 * Provides standardized interface and common functionality
 */
export abstract class Tool {
    public readonly name: string;
    public readonly description: string;
    protected readonly validateInput: boolean;

    constructor(name: string, description: string, validateInput: boolean = true) {
        this.name = name;
        this.description = description;
        this.validateInput = validateInput;
    }

    /**
     * Execute the tool with given input
     */
    async execute(input: ToolInput): Promise<ToolResult> {
        try {
            // Validate input if enabled
            if (this.validateInput) {
                const validation = this.validate(input);
                if (!validation.valid) {
                    return {
                        success: false,
                        error: `Invalid input: ${validation.error}`,
                        metadata: { tool: this.name }
                    };
                }
            }

            // Execute the tool logic
            const result = await this.run(input);
            
            return {
                success: true,
                data: result,
                metadata: { 
                    tool: this.name,
                    executedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                metadata: { 
                    tool: this.name,
                    errorType: error instanceof Error ? error.constructor.name : 'Unknown'
                }
            };
        }
    }

    /**
     * Validate tool input - override in subclasses for custom validation
     */
    protected validate(input: ToolInput): { valid: boolean; error?: string } {
        if (!input || typeof input !== 'object') {
            return { valid: false, error: 'Input must be an object' };
        }
        return { valid: true };
    }

    /**
     * Abstract method - implement tool logic in subclasses
     */
    protected abstract run(input: ToolInput): Promise<any>;

    /**
     * Get tool schema for OpenAI function calling format
     */
    abstract getSchema(): {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: Record<string, any>;
            required?: string[];
        };
    };
}

/**
 * Registry for managing available tools
 */
export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    getSchemas(): any[] {
        return this.getAll().map(tool => tool.getSchema());
    }

    has(name: string): boolean {
        return this.tools.has(name);
    }

    remove(name: string): boolean {
        return this.tools.delete(name);
    }

    clear(): void {
        this.tools.clear();
    }

    list(): string[] {
        return Array.from(this.tools.keys());
    }
}
