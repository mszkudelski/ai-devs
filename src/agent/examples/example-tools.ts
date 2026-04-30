import { Tool } from '../tool.js';
import { ToolInput } from '../types.js';

/**
 * Example tool for text analysis
 * Demonstrates the tool interface implementation
 */
export class TextAnalyzerTool extends Tool {
    constructor() {
        super(
            'text_analyzer',
            'Analyzes text for various properties like word count, sentiment, etc.',
            true
        );
    }

    protected async run(input: ToolInput): Promise<any> {
        const text = input.text as string;
        
        if (!text) {
            throw new Error('Text input is required');
        }

        // Simple text analysis
        const words = text.split(/\s+/).filter(word => word.length > 0);
        const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
        const characters = text.length;
        const charactersNoSpaces = text.replace(/\s/g, '').length;

        // Simple sentiment analysis (basic keyword matching)
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'perfect', 'love', 'happy'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 'disappointed'];
        
        const lowercaseText = text.toLowerCase();
        const positiveCount = positiveWords.filter(word => lowercaseText.includes(word)).length;
        const negativeCount = negativeWords.filter(word => lowercaseText.includes(word)).length;
        
        let sentiment = 'neutral';
        if (positiveCount > negativeCount) {
            sentiment = 'positive';
        } else if (negativeCount > positiveCount) {
            sentiment = 'negative';
        }

        return {
            wordCount: words.length,
            sentenceCount: sentences.length,
            characterCount: characters,
            characterCountNoSpaces: charactersNoSpaces,
            averageWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
            sentiment,
            sentimentScore: {
                positive: positiveCount,
                negative: negativeCount,
                ratio: negativeCount > 0 ? positiveCount / negativeCount : positiveCount
            }
        };
    }

    protected validate(input: ToolInput): { valid: boolean; error?: string } {
        if (!input.text || typeof input.text !== 'string') {
            return { valid: false, error: 'Text input is required and must be a string' };
        }
        
        if (input.text.trim().length === 0) {
            return { valid: false, error: 'Text input cannot be empty' };
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
                    text: {
                        type: 'string',
                        description: 'The text to analyze'
                    }
                },
                required: ['text']
            }
        };
    }
}

/**
 * Example tool for simple calculations
 */
export class CalculatorTool extends Tool {
    constructor() {
        super(
            'calculator',
            'Performs basic mathematical calculations',
            true
        );
    }

    protected async run(input: ToolInput): Promise<any> {
        const { operation, a, b } = input;
        
        const numA = Number(a);
        const numB = Number(b);
        
        if (isNaN(numA) || isNaN(numB)) {
            throw new Error('Both operands must be valid numbers');
        }

        let result: number;
        
        switch (operation) {
            case 'add':
                result = numA + numB;
                break;
            case 'subtract':
                result = numA - numB;
                break;
            case 'multiply':
                result = numA * numB;
                break;
            case 'divide':
                if (numB === 0) {
                    throw new Error('Division by zero is not allowed');
                }
                result = numA / numB;
                break;
            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }

        return {
            operation,
            operands: { a: numA, b: numB },
            result,
            expression: `${numA} ${this.getOperatorSymbol(operation)} ${numB} = ${result}`
        };
    }

    private getOperatorSymbol(operation: string): string {
        switch (operation) {
            case 'add': return '+';
            case 'subtract': return '-';
            case 'multiply': return '*';
            case 'divide': return '/';
            default: return '?';
        }
    }

    protected validate(input: ToolInput): { valid: boolean; error?: string } {
        const { operation, a, b } = input;
        
        if (!operation) {
            return { valid: false, error: 'Operation is required' };
        }
        
        if (!['add', 'subtract', 'multiply', 'divide'].includes(operation)) {
            return { valid: false, error: 'Operation must be one of: add, subtract, multiply, divide' };
        }
        
        if (a === undefined || b === undefined) {
            return { valid: false, error: 'Both operands (a and b) are required' };
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
                    operation: {
                        type: 'string',
                        enum: ['add', 'subtract', 'multiply', 'divide'],
                        description: 'The mathematical operation to perform'
                    },
                    a: {
                        type: 'number',
                        description: 'The first operand'
                    },
                    b: {
                        type: 'number',
                        description: 'The second operand'
                    }
                },
                required: ['operation', 'a', 'b']
            }
        };
    }
}
