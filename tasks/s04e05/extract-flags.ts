import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAIService } from "../../src/openai.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openaiService = new OpenAIService();

function createFlagExtractionPrompt(): string {
    return `You are an expert at extracting text from documents, especially flags and hidden content.

CRITICAL INSTRUCTIONS:
1. Look for ANY text that contains "FLG" or appears to be in the format {{FLG:...}} or similar flag patterns
2. Extract ALL text content from this image, paying special attention to:
   - Any curly braces {{ }} content
   - Any text that says "FLG" or "FLAG"
   - Any scattered or unusual text positioning
   - Any text that appears to be codes, markers, or special formatting
3. If you see scattered letters that might form words when combined, try to reconstruct them
4. Include EVERYTHING you can see, even single letters or partial words
5. Pay attention to text that might be overlapping or in different colors/styles
6. Look for text in margins, corners, or unusual positions

Extract all text content exactly as you see it. Do not interpret or modify - just extract the raw content preserving any special formatting or symbols.`;
}

async function extractFlagsFromSpecificPages(): Promise<void> {
    const dataDir = path.join(__dirname, 'data');
    const imagesDir = path.join(dataDir, 'images');
    
    // Based on the layout file analysis, flags are likely on certain pages
    // Let's check pages that seemed to have flag content
    const targetPages = [
        'page-02.png', // Likely has first flag
        'page-03.png', // Around flag area
        'page-15.png', // Second flag area 
        'page-16.png', // After second flag
    ];
    
    console.log('Extracting flags from specific pages...');
    
    let flagResults = '';
    
    for (const pageName of targetPages) {
        const imagePath = path.join(imagesDir, pageName);
        
        if (!fs.existsSync(imagePath)) {
            console.log(`Skipping ${pageName} - file not found`);
            continue;
        }
        
        console.log(`\nAnalyzing ${pageName} for flags...`);
        
        try {
            const prompt = createFlagExtractionPrompt();
            const response = await openaiService.processImage(imagePath, prompt, 'gpt-4o');
            
            flagResults += `\n${'='.repeat(60)}\n`;
            flagResults += `FLAG ANALYSIS - ${pageName}\n`;
            flagResults += `${'='.repeat(60)}\n`;
            flagResults += response;
            flagResults += '\n\n';
            
            // Check if this response contains flag-like content
            if (response.toLowerCase().includes('flg') || response.includes('{{') || response.includes('}}')) {
                console.log(`🎯 POTENTIAL FLAG CONTENT FOUND in ${pageName}!`);
            }
            
        } catch (error) {
            console.error(`Error processing ${pageName}:`, error);
            flagResults += `ERROR processing ${pageName}: ${error}\n\n`;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Save flag extraction results
    const flagOutputPath = path.join(dataDir, 'flag-extraction-results.txt');
    fs.writeFileSync(flagOutputPath, flagResults, 'utf8');
    
    console.log(`\n✅ Flag extraction completed!`);
    console.log(`📄 Results saved to: ${flagOutputPath}`);
    
    // Also extract the flags we know about from the layout file
    console.log('\n🔍 Known flags from layout analysis:');
    console.log('Flag 1: {{FLG:PLAINTEXT}}');
    console.log('Flag 2: Needs reconstruction from scattered text');
    
    const knownFlags = `
KNOWN FLAGS FROM LAYOUT ANALYSIS:
================================

Flag 1 (from layout file around line 41-44):
{{FLG:PLAINTEXT}}

Flag 2 (from layout file around line 245, scattered):
{{FLG:...}} - content needs to be reconstructed

Layout shows scattered letters that might form the second flag content.
Check around the "spacer" section with "Ochra ziemia pod stopami" text.
`;
    
    const flagSummaryPath = path.join(dataDir, 'flags-summary.txt');
    fs.writeFileSync(flagSummaryPath, flagResults + knownFlags, 'utf8');
    console.log(`📋 Complete flag summary saved to: ${flagSummaryPath}`);
}

// Execute the flag extraction
extractFlagsFromSpecificPages().catch(console.error);
