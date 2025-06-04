import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openaiService = new OpenAIService();

/**
 * Create the system prompt for the fine-tuned model
 */
function createSystemPrompt(): string {
    return `You are a language expert specializing in translation verification. Your task is to determine whether three given words are correct translations of the same concept across different languages.

Analyze the three words provided and respond with either "correct" if they represent the same concept in different languages, or "incorrect" if they do not represent the same concept.

Consider semantic meaning, not just linguistic similarity. Words that express the same idea, object, action, or concept should be considered correct translations even if they come from different language families.`;
}

/**
 * Test the fine-tuned model with verification data
 */
async function testWithFineTunedModel(): Promise<string[]> {
    const verifyPath = path.join(__dirname, 'lab_data', 'verify.txt');
    const verifyData = fs.readFileSync(verifyPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0);
    
    const correctIds: string[] = [];
    const systemPrompt = createSystemPrompt();
    const fineTunedModel = "ft:gpt-4.1-mini-2025-04-14:personal:devs3:Befm28H0";
    
    console.log('Testing with fine-tuned model...');
    console.log(`Using model: ${fineTunedModel}`);
    
    for (const line of verifyData) {
        const [id, words] = line.split('=');
        console.log(`Testing ${id}: ${words}`);
        
        try {
            // Use the completion method with the fine-tuned model
            const response = await openaiService.completion({
                model: fineTunedModel,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: words
                    }
                ],
                maxTokens: 50,
                stream: false
            });
            
            const result = response.choices[0]?.message?.content?.trim().toLowerCase() || '';
            console.log(`Raw response: ${result}`);
            
            // Check if the response indicates correct translation
            if (result === 'correct' || (result.includes('correct') && !result.includes('incorrect'))) {
                correctIds.push(id);
                console.log(`✅ ${id}: CORRECT - Adding to results`);
            } else {
                console.log(`❌ ${id}: INCORRECT`);
            }
            
        } catch (error) {
            console.error(`Error testing ${id}:`, error);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return correctIds;
}

/**
 * Main execution function
 */
async function executeVerification() {
    console.log('Starting S04E02 - Fine-tuned model verification...');
    
    try {
        // Test with the fine-tuned model
        const correctIds = await testWithFineTunedModel();
        
        console.log('\n=== VERIFICATION RESULTS ===');
        console.log(`Found ${correctIds.length} correct translations:`);
        console.log('Correct IDs:', correctIds);
        
        // Send the correct IDs to the report system
        console.log('\nSending results to report system...');
        await sendReport('research', correctIds);
        
        console.log('✅ Verification completed and results submitted!');
        
        return {
            correctIds,
            totalCorrect: correctIds.length
        };
        
    } catch (error) {
        console.error('Error during verification:', error);
        throw error;
    }
}

executeVerification().catch(console.error);
