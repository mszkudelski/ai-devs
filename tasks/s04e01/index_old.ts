import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import { getCentralUrl } from "../../src/url.js";
import { extractFromTags } from "../../src/utils.js";

const openaiService = new OpenAIService();

/**
 * Creates a prompt to extract photos and commands from the initial message
 */
function createExtractionPrompt(message: string): string {
    return `Your task is to extract photos urls and commands to correct photos given in below message.
        
        1. Extract photos urls from the message.
        2. Extract possible commands to correct photos from the message.

        3. Return the result in the following format:
        
        {
            "photos": ["url1", "url2", ...],
            "commands": ["command1", "command2", ...]
        }

        Here is the message:
        ${message}

        Remember to extract full photo URLs with file names and extensions.

       use thinging pattern to analyze the message and extract the required information.
       Use result tag to return the result in the specified format.
       Result should be JSON string.`;
}

/**
 * Creates a prompt to analyze a photo and determine correction command
 */
function createPhotoAnalysisPrompt(commands: string[], filename: string, previousFeedback?: string): string {
    const feedbackSection = previousFeedback 
        ? `\n\nPREVIOUS ATTEMPT FEEDBACK:
${previousFeedback}

Please take this feedback into consideration when determining the correction command.`
        : '';

    return `Analyze the photo provided in the image and determine what correction command should be applied.

Available commands:
${commands.join('\n')}

Filename: ${filename}

${feedbackSection}

Based on the photo analysis, respond with one of the available correction commands and filename in this exact format:
COMMAND <filename>

Example:
CORRECT IMG.jpg

Use thinking pattern to analyze the photo and determine the best correction command to apply.

Use result tag to return the command and filename.

Result should be string.

Example response:

<thinking>
Ok, I need to analyze the photo and determine the best correction command.
</thinking>
<result>
CORRECT IMG.jpg
</result>`;
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

    return `Based on the following individual photo descriptions, create a comprehensive description of person that includes all relevant details.

Individual photo descriptions:
${descriptions.map((desc, index) => `Photo ${index + 1}: ${desc}`).join('\n')}

${feedbackSection}

use thinking pattern to analysis.

Use result tag to return the description.`;
}

/**
 * Stage 2: Get corrected photo URL with retry logic
 */
async function getCorrectedPhotoUrl(photoUrl: string, commands: string[], maxRetries: number = 3): Promise<string> {
    const filename = photoUrl.split('/').pop() || '';
    let previousFeedback: string | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`  Stage 2 - Getting corrected photo URL (attempt ${attempt}/${maxRetries})...`);
        
        try {
            // Analyze photo and get correction command using vision
            const analysisPrompt = createPhotoAnalysisPrompt(commands, filename, previousFeedback);
            const analysisResponse = await openaiService.processImage(photoUrl, analysisPrompt, 'gpt-4-vision-preview');
            const correctionCommand = extractFromTags(analysisResponse, 'result');
            
            if (!correctionCommand || correctionCommand.trim().length === 0) {
                throw new Error(`Invalid correction command: ${correctionCommand}`);
            }
            
            console.log(`    Correction command: ${correctionCommand}`);
            
            // Send correction command to get corrected photo
            const correctionResult = await sendReport('photos', correctionCommand);
            
            // Check if the correction failed or doesn't make sense
            if (correctionResult.message && 
                (correctionResult.message.includes("nie wydaje") || 
                 correctionResult.message.includes("nie ma sens") || 
                 correctionResult.message.includes("źle") ||
                 correctionResult.message.includes("gorzej"))) {
                console.log(`    Correction not possible, will use original photo: ${correctionResult.message}`);
                
                // If correction fails and we've tried different commands, fall back to original
                if (attempt >= maxRetries) {
                    console.log(`    Using original photo URL: ${photoUrl}`);
                    return photoUrl;
                }
                
                // Try different command on retry
                previousFeedback = `Previous correction command "${correctionCommand}" failed: ${correctionResult.message}. Try a different command.`;
                continue;
            }
            
            // Extract corrected photo URL
            const extractionPrompt = `Extract the corrected photo URL from this response:
${JSON.stringify(correctionResult)}

The URL should be a filename ending with an image extension (.jpg, .png, etc).

If url is just filename add the central URL prefix: ${getCentralUrl(`dane/barbara`)}

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
            
            if (error instanceof Error) {
                previousFeedback = `Previous attempt failed with error: "${error.message}". Please adjust the correction command.`;
            }
            
            if (attempt < maxRetries) {
                console.log(`    Retrying stage 2 with feedback...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                // Final fallback: use original photo
                console.log(`    All correction attempts failed, using original photo: ${photoUrl}`);
                return photoUrl;
            }
        }
    }
    
    // This shouldn't be reached, but just in case
    return photoUrl;
}

/**
 * Stage 3: Get photo description
 */
async function getPhotoDescription(correctedPhotoUrl: string): Promise<string> {
    console.log(`  Stage 3 - Getting photo description...`);
    
    const descriptionPrompt = `Analyze this corrected photo and provide a detailed description of the person shown.
    
Focus on:
- Physical appearance (hair, facial features, clothing, etc.)
- Age estimation
- Any distinctive characteristics
- Setting or background details

Use <result> tags for your description.`;
    
    const descriptionResponse = await openaiService.processImage(correctedPhotoUrl, descriptionPrompt, 'gpt-4-vision-preview');
    const description = extractFromTags(descriptionResponse, 'result');
    
    if (!description || description.trim().length === 0) {
        throw new Error(`Invalid description received: ${description}`);
    }
    
    console.log(`    Description: ${description}`);
    return description;
}

/**
 * Stage 4: Create final description with retry logic for stages 3 and 4
 */
async function createFinalDescription(photos: string[], commands: string[], maxRetries: number = 3): Promise<{ descriptions: string[]; finalDescription: string }> {
    let previousFeedback: string | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Stage 4 - Creating final description (attempt ${attempt}/${maxRetries})...`);
        
        try {
            const descriptions: string[] = [];
            
            // Stage 2 & 3: Process each photo
            for (let i = 0; i < photos.length; i++) {
                console.log(`Processing photo ${i + 1}/${photos.length}: ${photos[i]}`);
                
                // Stage 2: Get corrected photo URL (has its own retry logic)
                const correctedPhotoUrl = await getCorrectedPhotoUrl(photos[i], commands);
                
                // Stage 3: Get photo description
                const description = await getPhotoDescription(correctedPhotoUrl);
                descriptions.push(description);
                
                console.log(`Photo ${i + 1} completed successfully`);
            }
            
            // Stage 4: Create comprehensive summary
            console.log('Creating comprehensive summary...');
            const summaryPrompt = createSummaryPrompt(descriptions, previousFeedback);
            const summaryResponse = await openaiService.getChatResponse(summaryPrompt);
            const finalDescription = extractFromTags(summaryResponse, 'result');
            
            if (!finalDescription || finalDescription.trim().length === 0) {
                throw new Error(`Invalid final description: ${finalDescription}`);
            }
            
            console.log('Final description created successfully');
            return { descriptions, finalDescription };
            
        } catch (error) {
            console.error(`Stage 4 attempt ${attempt} failed:`, error);
            
            if (error instanceof Error) {
                previousFeedback = `Previous attempt failed with error: "${error.message}". Please adjust the description to be more accurate and comprehensive.`;
            }
            
            if (attempt < maxRetries) {
                console.log(`Retrying stages 3 & 4 with feedback...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
                throw new Error(`Failed to create final description after ${maxRetries} attempts: ${error}`);
            }
        }
    }
    
    throw new Error(`Failed to create final description after ${maxRetries} attempts`);
}

/**
 * Main execution function for s04e01 task
 */
async function executeTask() {
    console.log('Starting s04e01 task...');
    
    // Stage 1: Extract photos and commands
    console.log('\n=== STAGE 1: Extracting URLs and Commands ===');
    const startResult = await sendReport('photos', "START");
    console.log('Initial response received:', startResult);

    const extractionPrompt = createExtractionPrompt(startResult.message);
    const extractionResponse = await openaiService.getChatResponse(extractionPrompt);
    const extractedData = extractFromTags(extractionResponse, 'result');
    
    let photosAndCommands;
    try {
        photosAndCommands = JSON.parse(extractedData);
        console.log('Extracted photos and commands:', photosAndCommands);
    } catch (error) {
        console.error('Error parsing extraction result:', error);
        console.log('Raw extraction result:', extractedData);
        return;
    }

    const { photos, commands } = photosAndCommands;
    
    // Process with stages 2, 3, and 4 (with retry logic for final submission)
    const maxRetries = 3;
    let previousFeedback: string | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`\n=== FINAL SUBMISSION ATTEMPT ${attempt}/${maxRetries} ===`);
        
        try {
            // Stages 2, 3, 4: Process photos and create description
            const result = await createFinalDescription(photos, commands);
            
            // Submit final description
            console.log('Submitting final description...');
            const finalResult = await sendReport('photos', result.finalDescription);
            
            if (finalResult && finalResult.code === 0) {
                console.log('Final report result:', finalResult);
                console.log('Task completed successfully!');
                return {
                    descriptions: result.descriptions,
                    finalDescription: result.finalDescription,
                    finalResult
                };
            } else {
                throw new Error(`Report submission failed: ${finalResult?.message || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error(`Final submission attempt ${attempt} failed:`, error);
            
            if (error instanceof Error) {
                previousFeedback = `Previous submission failed with message: "${error.message}". Please adjust the description accordingly.`;
            }
            
            if (attempt < maxRetries) {
                console.log(`Retrying final submission with feedback...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    
    console.error(`Failed to complete task after ${maxRetries} attempts`);
    return null;
}

executeTask();
