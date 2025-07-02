import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAIService } from "../../src/openai.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openaiService = new OpenAIService();

function createTextExtractionPrompt(): string {
    return `You are a precise OCR expert. Extract ALL text from this image page of a Polish notebook/diary. 

CRITICAL INSTRUCTIONS:
1. Extract EVERY piece of text you can see, even if it's handwritten, scattered, or in unusual positions
2. Preserve the original layout and structure as much as possible
3. If text appears to be arranged in a special pattern or layout, maintain that structure
4. Include ALL text elements: main text, marginal notes, scattered words, dates, names, etc.
5. Pay special attention to any text that might be flags, codes, or special markers (like {{FLG:...}})
6. If you see any special formatting or symbols, include them exactly as they appear
7. For handwritten text, make your best interpretation but indicate uncertainty with [?] if needed
8. Maintain line breaks and spacing that seem intentional
9. Include ANY text that appears to be overlaid or in different orientations

Output the extracted text exactly as you see it, preserving the layout and structure. Do not summarize or interpret - just extract the raw text content.`;
}

async function extractTextFromImageWithAI(imagePath: string): Promise<string> {
    console.log(`Extracting text from: ${path.basename(imagePath)} using OpenAI Vision`);
    
    try {
        const prompt = createTextExtractionPrompt();
        const response = await openaiService.processImage(imagePath, prompt, 'gpt-4o');
        return response;
    } catch (error) {
        console.error(`Failed to extract text from ${imagePath}:`, error);
        return `[ERROR: Could not extract text from ${path.basename(imagePath)}]`;
    }
}

async function extractAllTextWithAI(): Promise<void> {
    const dataDir = path.join(__dirname, 'data');
    const imagesDir = path.join(dataDir, 'images');
    
    if (!fs.existsSync(imagesDir)) {
        console.error('Images directory not found. Please run the main extraction first.');
        return;
    }
    
    const imageFiles = fs.readdirSync(imagesDir)
        .filter(file => file.endsWith('.png'))
        .sort() // Process in order
        .map(file => path.join(imagesDir, file));
    
    if (imageFiles.length === 0) {
        console.error('No PNG images found in the images directory.');
        return;
    }
    
    console.log(`Found ${imageFiles.length} images to process`);
    
    let allExtractedText = '';
    let pageNumber = 1;
    
    for (const imagePath of imageFiles) {
        console.log(`\nProcessing page ${pageNumber}/${imageFiles.length}...`);
        
        const extractedText = await extractTextFromImageWithAI(imagePath);
        
        allExtractedText += `\n${'='.repeat(50)}\n`;
        allExtractedText += `PAGE ${pageNumber} - ${path.basename(imagePath)}\n`;
        allExtractedText += `${'='.repeat(50)}\n`;
        allExtractedText += extractedText;
        allExtractedText += '\n\n';
        
        pageNumber++;
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save the extracted text
    const outputPath = path.join(dataDir, 'extracted-text-ai-vision.txt');
    fs.writeFileSync(outputPath, allExtractedText, 'utf8');
    
    console.log(`\n✅ Text extraction completed!`);
    console.log(`📄 Processed ${imageFiles.length} pages`);
    console.log(`💾 Extracted text saved to: ${outputPath}`);
    console.log(`📊 Total characters extracted: ${allExtractedText.length}`);
    
    // Also try to clean and save a more readable version
    const cleanedText = cleanAndStructureText(allExtractedText);
    const cleanedOutputPath = path.join(dataDir, 'extracted-text-ai-cleaned.txt');
    fs.writeFileSync(cleanedOutputPath, cleanedText, 'utf8');
    console.log(`📝 Cleaned version saved to: ${cleanedOutputPath}`);
}

function cleanAndStructureText(text: string): string {
    console.log('Cleaning and structuring extracted text...');
    
    // Basic cleaning while preserving important structure
    let cleaned = text
        // Normalize whitespace but preserve intentional spacing
        .replace(/[ \t]+/g, ' ')
        // Remove excessive blank lines (more than 2 consecutive)
        .replace(/\n{4,}/g, '\n\n\n')
        // Clean up common OCR artifacts
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        // Ensure proper spacing around punctuation
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/([.,!?;:])\s*/g, '$1 ')
        // Remove trailing spaces from lines
        .replace(/[ \t]+$/gm, '')
        // Trim overall
        .trim();
    
    return cleaned;
}

// Execute the improved extraction
extractAllTextWithAI().catch(console.error);
