import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openaiService = new OpenAIService();

interface FineTuningExample {
    messages: {
        role: 'system' | 'user' | 'assistant';
        content: string;
    }[];
}

/**
 * Read and parse the correct and incorrect word files
 */
function readDataFiles(): { correct: string[], incorrect: string[] } {
    const correctPath = path.join(__dirname, 'lab_data', 'correct.txt');
    const incorrectPath = path.join(__dirname, 'lab_data', 'incorect.txt');
    
    const correct = fs.readFileSync(correctPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0);
    
    const incorrect = fs.readFileSync(incorrectPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0);
    
    return { correct, incorrect };
}

/**
 * Create the system prompt for the fine-tuning task
 */
function createSystemPrompt(): string {
    return `You are a language expert specializing in translation verification. Your task is to determine whether three given words are correct translations of the same concept across different languages.

Analyze the three words provided and respond with either "correct" if they represent the same concept in different languages, or "incorrect" if they do not represent the same concept.

Consider semantic meaning, not just linguistic similarity. Words that express the same idea, object, action, or concept should be considered correct translations even if they come from different language families.`;
}

/**
 * Generate fine-tuning examples from the data
 */
function generateFineTuningExamples(correct: string[], incorrect: string[]): FineTuningExample[] {
    const examples: FineTuningExample[] = [];
    const systemPrompt = createSystemPrompt();
    
    // Add correct examples
    for (const line of correct) {
        const words = line.trim();
        examples.push({
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: words
                },
                {
                    role: 'assistant',
                    content: 'correct'
                }
            ]
        });
    }
    
    // Add incorrect examples
    for (const line of incorrect) {
        const words = line.trim();
        examples.push({
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: words
                },
                {
                    role: 'assistant',
                    content: 'incorrect'
                }
            ]
        });
    }
    
    // Shuffle the examples to mix correct and incorrect
    for (let i = examples.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [examples[i], examples[j]] = [examples[j], examples[i]];
    }
    
    return examples;
}

/**
 * Save examples as JSONL file for OpenAI fine-tuning
 */
function saveAsJSONL(examples: FineTuningExample[], filename: string): void {
    const jsonlContent = examples
        .map(example => JSON.stringify(example))
        .join('\n');
    
    const outputPath = path.join(__dirname, filename);
    fs.writeFileSync(outputPath, jsonlContent, 'utf-8');
    console.log(`Saved ${examples.length} examples to ${outputPath}`);
}

/**
 * Test the model with verification data
 */
async function testWithVerificationData(): Promise<string[]> {
    const verifyPath = path.join(__dirname, 'lab_data', 'verify.txt');
    const verifyData = fs.readFileSync(verifyPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0);
    
    const results: string[] = [];
    const systemPrompt = createSystemPrompt();
    
    console.log('Testing with verification data...');
    
    for (const line of verifyData) {
        const [id, words] = line.split('=');
        console.log(`Testing ${id}: ${words}`);
        
        const prompt = `${systemPrompt}\n\nAnalyze these three words: ${words}`;
        const response = await openaiService.getChatResponse(prompt);
        
        // Extract just "correct" or "incorrect" from response
        const result = response.toLowerCase().includes('correct') && !response.toLowerCase().includes('incorrect') 
            ? 'correct' 
            : 'incorrect';
        
        results.push(result);
        console.log(`Result: ${result}`);
    }
    
    return results;
}

/**
 * Main execution function
 */
async function executeTask() {
    console.log('Starting S04E02 - Fine-tuning dataset preparation...');
    
    // Read the data files
    const { correct, incorrect } = readDataFiles();
    console.log(`Loaded ${correct.length} correct examples and ${incorrect.length} incorrect examples`);
    
    // Generate fine-tuning examples
    const examples = generateFineTuningExamples(correct, incorrect);
    console.log(`Generated ${examples.length} fine-tuning examples`);
    
    // Save as JSONL file
    saveAsJSONL(examples, 'fine_tuning_data.jsonl');
    
    // Test with current model on verification data
    // const verificationResults = await testWithVerificationData();
    
    // Create the answer in the format expected by the task
    // const answer = verificationResults.map((result, index) => {
    //     const lineNumber = String(index + 1).padStart(2, '0');
    //     return `${lineNumber}=${result}`;
    // });
    
    // console.log('Verification results:', answer);
    
    // // Submit the answer
    // await sendReport('research', answer);
    
    return {
        examples: examples.length,
        // verificationResults: answer
    };
}

executeTask().catch(console.error);