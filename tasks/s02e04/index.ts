import { OpenAIService } from "../../src/openai.service.js";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendReport } from '../../src/report.js';
import { createWorker } from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openaiService = new OpenAIService();

async function processImageWithOCR(imagePath: string): Promise<string> {
    const worker = await createWorker();
    
    try {
        const { data: { text } } = await worker.recognize(imagePath);
        return text;
    } finally {
        await worker.terminate();
    }
}

async function processFiles() {
    const directory = path.join(__dirname, 'pliki_z_fabryki');
    const files = await fs.readdir(directory);
    
    const people: string[] = [];
    const hardware: string[] = [];
    
    for (const file of files) {
        // Skip directories and non-relevant files
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) continue;
        if (!['.txt', '.mp3', '.png'].includes(path.extname(file))) continue;
        
        let content: string;
        
        try {
            if (file.endsWith('.mp3')) {
                content = await openaiService.getTranscription(filePath);
            } else if (file.endsWith('.png')) {
                content = await processImageWithOCR(filePath);
            } else if (file.endsWith('.txt')) {
                content = await fs.readFile(filePath, 'utf-8');
            } else {
                continue;
            }
            
            // Classify the content
            const classification = await openaiService.getChatResponse(
                `Analyze this content and classify it into one of these categories:
                1. "human" - ONLY if the content contains information about:
                   - Captured people (someone being detained, caught, or held)
                   - Direct evidence of human presence (like footprints, personal items left behind, or clear signs of human activity)
                   - Reports of human sightings or encounters
                2. "hardware" - ONLY if the content describes any physical equipment issues, malfunctions, or problems with machinery, devices, or infrastructure (not software) that have been repaired or need repair
                
                Content to analyze: ${content}
                
                IMPORTANT: Classify as "unknown" in these cases:
                - If the content only mentions humans in general
                - If the content talks about human needs or activities
                - If the content is about human workers or employees
                - If the content is about human-robot interactions
                - If the content is about human food or supplies
                - If the content is about human emotions or feelings
                - If the content is about human requests or demands
                - If the content is about human presence without evidence of capture or traces
                - If the content is about software issues or updates

                For example:
                - If content mention someone being captured/detained, respond with "human"
                - If content mention finding footprints or personal items, respond with "human"
                - If content just mention humans in general (like "we humans need food"), respond with "unknown"
                - If content mention hardware's issues that were repaired or need repair, respond with "hardware"
                - If content mention software, respond with "unknown"
                - If content says that there are no presence of people, respond with "unknown"
                - If content just mention hardware without issues, respond with "unknown"
                - If content is a general technical report without specific hardware issues, respond with "unknown"
                - If content is about human needs or general human activities, respond with "unknown"
                - If content is about human workers or employees, respond with "unknown"
                - If content is about human-robot interactions, respond with "unknown"
                - If content is about human food or supplies, respond with "unknown"

                Respond with exactly one word: "human", "hardware", "unknown".
            `);

            console.log({classification, file, content});
            
            if (classification.toLowerCase().includes('human')) {
                people.push(file);
            } else if (classification.toLowerCase().includes('hardware')) {
                hardware.push(file);
            }
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }
    }
    
    const answer = {
        people,
        hardware
    };

    console.log({answer});
    
    // Send the report
    const result = await sendReport('kategorie', answer);
    console.log('Report result:', result);
    
    await openaiService.shutdown();
}

processFiles().catch(console.error); 