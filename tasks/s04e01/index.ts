import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import { getCentralUrl } from "../../src/url.js";
import { extractFromTags } from "../../src/utils.js";

const openaiService = new OpenAIService();

/**
 * Stage 1: Extract photos and commands from the initial message
 */
async function extractPhotosAndCommands(): Promise<{ photos: string[]; commands: string[] }> {
    console.log('\n=== STAGE 1: Extracting URLs and Commands ===');
    
    const startResult = await sendReport('photos', "START");
    console.log('Initial response received:', startResult);

    const extractionPrompt = `Your task is to extract photos urls and commands to correct photos from the message below.
        
Extract:
1. Photo URLs from the message (full URLs with file names and extensions)
2. Available commands to correct photos

Return the result in this JSON format:
{
    "photos": ["url1", "url2", ...],
    "commands": ["command1", "command2", ...]
}

Message:
${startResult.message}

Use <thinking> to analyze the message and extract the required information.
Use <result> tags for the JSON result.`;

    const extractionResponse = await openaiService.getChatResponse(extractionPrompt);
    const extractedData = extractFromTags(extractionResponse, 'result');
    
    try {
        const photosAndCommands = JSON.parse(extractedData);
        console.log('Extracted photos and commands:', photosAndCommands);
        return photosAndCommands;
    } catch (error) {
        console.error('Error parsing extraction result:', error);
        console.log('Raw extraction result:', extractedData);
        throw new Error(`Failed to parse extracted data: ${error}`);
    }
}

/**
 * Stage 2: Get corrected photo URL with retry logic
 */
async function getCorrectedPhotoUrl(photoUrl: string, commands: string[], maxRetries: number = 5): Promise<string> {
    const filename = photoUrl.split('/').pop() || '';
    let previousFeedback: string | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`  Stage 2 - Getting corrected photo URL (attempt ${attempt}/${maxRetries})...`);
        
        try {
            // Analyze photo and get correction command using vision
            const analysisPrompt = createPhotoAnalysisPrompt(commands, filename, previousFeedback);
            const analysisResponse = await openaiService.processImage(photoUrl, analysisPrompt);
            const correctionCommand = extractFromTags(analysisResponse, 'result');
            
            if (!correctionCommand || correctionCommand.trim().length === 0) {
                throw new Error(`Invalid correction command: ${correctionCommand}`);
            }
            
            console.log(`    Correction command: ${correctionCommand}`);
            
            // Send correction command to get corrected photo
            const correctionResult = await sendReport('photos', correctionCommand);
            
            // Check if correction failed or doesn't make sense
            if (correctionResult.message && (
                correctionResult.message.includes('nie można') || 
                correctionResult.message.includes('błąd') ||
                correctionResult.message.includes('error') ||
                correctionResult.message.includes('nie wydaje') || 
                correctionResult.message.includes('nie ma sens') || 
                correctionResult.message.includes('źle') ||
                correctionResult.message.includes('gorzej'))) {
                
                throw new Error(`Correction failed: ${correctionResult.message}`);
            }
            
            // Extract corrected photo URL
            const extractionPrompt = `Extract the corrected photo URL from this response:
${JSON.stringify(correctionResult)}

The URL should be a filename ending with an image extension (.jpg, .png, etc).
If the URL is just a filename, add the central URL prefix: ${getCentralUrl('dane/barbara')}

Use <result> tags for the extracted URL.`;

            const extractionResponse = await openaiService.getChatResponse(extractionPrompt);
            const correctedPhotoUrl = extractFromTags(extractionResponse, 'result');
            
            if (!correctedPhotoUrl || !/\.(jpe?g|png)$/i.test(correctedPhotoUrl)) {
                throw new Error(`Invalid photo URL extracted: ${correctedPhotoUrl}`);
            }
            
            console.log(`    Corrected photo URL: ${correctedPhotoUrl}`);
            return correctedPhotoUrl;
            
        } catch (error) {
            console.error(`    Stage 2 attempt ${attempt} failed:`, error);
            
            // Update feedback for next attempt
            if (error instanceof Error) {
                previousFeedback += `${error.message}\n`;
            }
            
            if (attempt < maxRetries) {
                console.log(`    Retrying Stage 2...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    console.log(`    Stage 2 failed after ${maxRetries} attempts, using original photo URL`);
    return photoUrl; // Fallback to original photo
}

/**
 * Stage 3: Get photo description using vision AI
 */
async function getPhotoDescription(photoUrl: string): Promise<string> {
    console.log(`  Stage 3 - Getting photo description...`);
    
    const descriptionPrompt = `Describe this photo in detail, focusing on:
- The person's physical characteristics (hair color, facial features, clothing)
- Any distinctive marks, tattoos, or accessories
- The setting and context of the photo
- The person's pose and expression

Be specific and detailed about identifying characteristics.

Use <result> tags for your description.`;
    
    const descriptionResponse = await openaiService.processImage(photoUrl, descriptionPrompt, 'gpt-4.1-mini');
    const description = extractFromTags(descriptionResponse, 'result');
    
    if (!description || description.trim().length === 0) {
        throw new Error(`Invalid description received`);
    }
    
    console.log(`    Description: ${description}`);
    return description;
}

/**
 * Stage 4: Create final description and submit with retry logic for stages 3, 4 and submission
 */
async function createFinalDescriptionAndSubmit(photoUrls: string[], maxRetries: number = 3): Promise<any> {
    let previousFeedback: string | undefined;
    let allDescriptions: string[] = [];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`  Stages 3-4 + Submission - Complete workflow (attempt ${attempt}/${maxRetries})...`);
        
        try {
            // Stage 3: Get descriptions for all photos (retry this stage if any later stage fails)
            console.log(`    Getting descriptions for ${photoUrls.length} photos...`);
            allDescriptions = [];
            
            for (let i = 0; i < photoUrls.length; i++) {
                const description = await getPhotoDescription(photoUrls[i]);
                allDescriptions.push(description);
            }
            
            // Stage 4: Create comprehensive summary
            const summaryPrompt = createSummaryPrompt(allDescriptions, previousFeedback);
            const summaryResponse = await openaiService.getChatResponse(summaryPrompt);
            const finalDescription = extractFromTags(summaryResponse, 'result');
            
            if (!finalDescription || finalDescription.trim().length === 0) {
                throw new Error(`Invalid final description received`);
            }
            
            console.log(`    Final description: ${finalDescription}`);
            
            // Final Submission: Submit the description
            console.log(`    Submitting final description...`);
            const finalResult = await sendReport('photos', finalDescription);
            
            if (finalResult && finalResult.code === 0) {
                console.log('Task completed successfully!');
                console.log('Final result:', finalResult);
                return finalResult;
            } else {
                throw new Error(finalResult
                );
            }
            
        } catch (error) {
            console.error(`    Complete workflow attempt ${attempt} failed:`, error);
            
            if (error instanceof Error) {
                previousFeedback = error.toString();
            }
            
            if (attempt < maxRetries) {
                console.log(`    Retrying complete workflow...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    
    throw new Error(`Failed to complete task after ${maxRetries} attempts`);
}

/**
 * Creates a prompt to analyze a photo and determine correction command
 */
function createPhotoAnalysisPrompt(commands: string[], filename: string, previousFeedback?: string): string {
    const feedbackSection = previousFeedback 
        ? `\n\nPREVIOUS ATTEMPTS FEEDBACK:
${previousFeedback}

Please take this feedback into consideration when determining the correction command.`
        : '';

    return `Analyze the photo provided and determine what correction command should be applied.

Available commands:
${commands.join('\n')}

Filename: ${filename}

${feedbackSection}

Based on the photo analysis, respond with one of the available correction commands and filename in this exact format:
COMMAND <filename>

Example:
REPAIR IMG_559.PNG

Use <thinking> to analyze the photo and determine the best correction command.
Use <result> tags to return the command and filename.`;
}

/**
 * Creates a prompt to summarize all photo descriptions
 */
function createSummaryPrompt(descriptions: string[], previousFeedback?: string): string {
    const feedbackSection = previousFeedback 
        ? `\n\nPREVIOUS ATTEMPT FEEDBACK:
${previousFeedback}

Please take this feedback into consideration when creating the description.`
        : '';

    return `Based on the following individual photo descriptions, create a comprehensive description of the women named Barbara that includes all relevant details.

Individual photo descriptions:
${descriptions.map((desc, index) => `Photo ${index + 1}: ${desc}`).join('\n')}

${feedbackSection}

Focus on creating a detailed description that captures the person's distinctive characteristics, appearance, and any identifying features.

Final description must be in polish language and should be concise but detailed.

Use <thinking> for analysis.
Use <result> tags for the final description.`;
}

/**
 * Main execution function for s04e01 task
 */
async function executeTask() {
    console.log('Starting s04e01 task...');
    
    try {
        // Stage 1: Extract photos and commands
        const { photos, commands } = await extractPhotosAndCommands();
        
        // Stage 2: Get corrected photo URLs
        console.log('\n=== STAGE 2: Processing Photo Corrections ===');
        const correctedPhotoUrls: string[] = [];
        
        for (let i = 0; i < photos.length; i++) {
            console.log(`Processing photo ${i + 1}/${photos.length}: ${photos[i]}`);
            const correctedUrl = await getCorrectedPhotoUrl(photos[i], commands);
            correctedPhotoUrls.push(correctedUrl);
        }
        
        // Stages 3, 4 & Final Submission: Get descriptions, create final description and submit with retry logic
        console.log('\n=== STAGES 3-4 + SUBMISSION: Creating Final Description and Submitting ===');
        const finalResult = await createFinalDescriptionAndSubmit(correctedPhotoUrls);
        
        return finalResult;
        
    } catch (error) {
        console.error('Task execution failed:', error);
        return null;
    }
}

executeTask();
