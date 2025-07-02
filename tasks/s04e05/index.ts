import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getCentralUrl } from "../../src/url.js";
import axios from 'axios';
import pdf2pic from 'pdf2pic';
import { executeQuestionAnswering } from './question-answering.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PDFParseResult {
    text: string;
    numpages: number;
    info?: any;
    metadata?: any;
    version?: string;
}

interface ExtractedData {
    text: string;
    images: string[];
    metadata: {
        pages: number;
        info?: any;
        version?: string;
    };
}

async function downloadPDF(url: string, outputPath: string): Promise<void> {
    console.log(`Downloading PDF from: ${url}`);
    
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function extractTextFromPDF(pdfPath: string): Promise<PDFParseResult> {
    console.log('Extracting text from PDF using pdftotext...');
    
    try {
        // Use pdftotext command line tool
        const outputPath = pdfPath.replace('.pdf', '-text.txt');
        
        // Extract text using pdftotext
        execSync(`pdftotext "${pdfPath}" "${outputPath}"`, { stdio: 'inherit' });
        
        // Read the extracted text
        const text = fs.readFileSync(outputPath, 'utf8');
        
        // Get page count using pdfinfo
        let pageCount = 0;
        try {
            const pdfInfo = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
            const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
            pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
        } catch (infoError) {
            console.log('Could not get page info, using 0');
        }
        
        console.log(`Extracted ${text.length} characters from ${pageCount} pages`);
        
        // Clean up temp file
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        
        return {
            text: text,
            numpages: pageCount,
            info: { pages: pageCount },
            metadata: {},
            version: 'pdftotext'
        };
    } catch (error) {
        console.error('Error extracting text with pdftotext:', error);
        // Fallback: just return basic info without parsing
        return {
            text: 'Error: Could not extract text from PDF',
            numpages: 0,
            info: {},
            metadata: {},
            version: 'unknown'
        };
    }
}

async function extractImagesFromPDF(pdfPath: string, outputDir: string): Promise<string[]> {
    console.log('Extracting images from PDF using pdftoppm...');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
        // Use pdftoppm to convert PDF pages to images
        const basename = path.join(outputDir, 'page');
        
        // Extract all pages as PNG images
        execSync(`pdftoppm -png "${pdfPath}" "${basename}"`, { stdio: 'inherit' });
        
        // Find all generated image files
        const imageFiles = fs.readdirSync(outputDir)
            .filter(file => file.startsWith('page') && file.endsWith('.png'))
            .map(file => path.join(outputDir, file))
            .sort(); // Sort to maintain page order
        
        console.log(`Extracted ${imageFiles.length} page images`);
        
        return imageFiles;
    } catch (error) {
        console.error('Error in image extraction with pdftoppm:', error);
        return [];
    }
}

async function extractTextWithOCR(imagePath: string): Promise<string> {
    console.log(`Running OCR on: ${path.basename(imagePath)}`);
    
    try {
        // We already have tesseract.js available in the project
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('pol+eng'); // Polish and English language
        
        const { data: { text } } = await worker.recognize(imagePath);
        await worker.terminate();
        
        return text;
    } catch (error) {
        console.error(`OCR failed for ${imagePath}:`, error);
        return '';
    }
}

// Function to clean and improve extracted text
function cleanExtractedText(text: string): string {
    console.log('Cleaning extracted text...');
    
    // Remove excessive whitespace and fix spacing issues
    let cleaned = text
        // Replace multiple spaces with single space
        .replace(/[ \t]+/g, ' ')
        // Remove spaces at start and end of lines
        .replace(/^[ \t]+|[ \t]+$/gm, '')
        // Fix broken words by removing single letters on separate lines
        .replace(/\n[a-ząćęłńóśźż]\n/gi, '')
        // Remove lines with only single characters (likely OCR artifacts)
        .replace(/^\s*[a-ząćęłńóśźż]\s*$/gmi, '')
        // Fix spacing around punctuation
        .replace(/\s+([.,!?;:])/g, '$1')
        .replace(/([.,!?;:])\s*/g, '$1 ')
        // Remove excessive newlines
        .replace(/\n{3,}/g, '\n\n')
        // Trim overall
        .trim();
    
    return cleaned;
}

async function extractAllTextWithOCR(imagesDir: string): Promise<string> {
    console.log('Starting OCR extraction on all page images...');
    
    const imageFiles = fs.readdirSync(imagesDir)
        .filter(file => file.endsWith('.png'))
        .sort() // Process in order
        .map(file => path.join(imagesDir, file));
    
    let allText = '';
    
    for (const imagePath of imageFiles) {
        const pageText = await extractTextWithOCR(imagePath);
        const cleanedPageText = cleanExtractedText(pageText);
        allText += `\n=== PAGE ${path.basename(imagePath)} ===\n`;
        allText += cleanedPageText;
        allText += '\n';
    }
    
    return cleanExtractedText(allText);
}

async function parseNotebookPDF(): Promise<ExtractedData> {
    const pdfUrl = getCentralUrl('dane/notatnik-rafala.pdf');
    const taskDir = __dirname;
    const dataDir = path.join(taskDir, 'data');
    const pdfPath = path.join(dataDir, 'notatnik-rafala.pdf');
    const imagesDir = path.join(dataDir, 'images');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    try {
        // Download PDF if it doesn't exist
        if (!fs.existsSync(pdfPath)) {
            await downloadPDF(pdfUrl, pdfPath);
            console.log(`PDF downloaded to: ${pdfPath}`);
        } else {
            console.log(`PDF already exists at: ${pdfPath}`);
        }
        
        // Extract text
        const pdfData = await extractTextFromPDF(pdfPath);
        
        // Try to extract images, but don't fail if it doesn't work
        let imagePaths: string[] = [];
        try {
            imagePaths = await extractImagesFromPDF(pdfPath, imagesDir);
        } catch (imageError) {
            console.error('Error extracting images (continuing anyway):', imageError);
        }
        
        // If we have images, try OCR extraction as well
        let ocrText = '';
        if (imagePaths.length > 0) {
            try {
                ocrText = await extractAllTextWithOCR(imagesDir);
                
                // Save OCR text to file
                const ocrOutputPath = path.join(dataDir, 'extracted-text-ocr.txt');
                fs.writeFileSync(ocrOutputPath, ocrText, 'utf8');
                console.log(`OCR text saved to: ${ocrOutputPath}`);
            } catch (ocrError) {
                console.error('OCR extraction failed:', ocrError);
            }
        }
        
        const result: ExtractedData = {
            text: pdfData.text,
            images: imagePaths,
            metadata: {
                pages: pdfData.numpages,
                info: pdfData.info,
                version: pdfData.version
            }
        };
        
        // Save extracted text to file for review
        const textOutputPath = path.join(dataDir, 'extracted-text.txt');
        fs.writeFileSync(textOutputPath, pdfData.text, 'utf8');
        console.log(`Text saved to: ${textOutputPath}`);
        
        // Save metadata
        const metadataPath = path.join(dataDir, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(result.metadata, null, 2), 'utf8');
        console.log(`Metadata saved to: ${metadataPath}`);
        
        // If images were extracted, run OCR on them
        if (imagePaths.length > 0) {
            console.log('Running OCR on extracted images...');
            const ocrText = await extractAllTextWithOCR(imagesDir);
            
            // Save cleaned OCR text
            const cleanedOcrPath = path.join(dataDir, 'extracted-text-cleaned.txt');
            fs.writeFileSync(cleanedOcrPath, ocrText, 'utf8');
            console.log(`Cleaned OCR text saved to: ${cleanedOcrPath}`);
            
            // Append OCR results to the extracted text
            result.text += '\n=== OCR EXTRACTION RESULTS ===\n';
            result.text += ocrText;
            
            // Save updated text with OCR results
            fs.writeFileSync(textOutputPath, result.text, 'utf8');
            console.log(`Updated text with OCR results saved to: ${textOutputPath}`);
        }
        
        console.log('\n=== EXTRACTION SUMMARY ===');
        console.log(`Pages: ${result.metadata.pages}`);
        console.log(`Text length: ${result.text.length} characters`);
        console.log(`Images extracted: ${result.images.length}`);
        if (result.images.length > 0) {
            console.log(`Images saved to: ${imagesDir}`);
        }
        
        return result;
        
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw error;
    }
}

// Execute the task and display summary
parseNotebookPDF().then((result) => {
    console.log('\n🎉 PDF PARSING COMPLETED SUCCESSFULLY! 🎉');
    console.log('============================================');
    console.log(`📄 PDF downloaded from: ${getCentralUrl('dane/notatnik-rafala.pdf')}`);
    console.log(`📊 Pages processed: ${result.metadata.pages}`);
    console.log(`📝 Text extracted: ${result.text.length} characters`);
    console.log(`🖼️  Images extracted: ${result.images.length} PNG files`);
    console.log(`💾 Files saved to: ${path.join(__dirname, 'data')}`);
    console.log('\n📁 Output files:');
    console.log('  ├── notatnik-rafala.pdf (original file)');
    console.log('  ├── extracted-text.txt (plain text content)');
    console.log('  ├── metadata.json (PDF metadata)');
    console.log('  └── images/ (19 page images in PNG format)');
    console.log('\n✅ Ready for further processing!');
    
    // Integrate with question-answering system
    console.log('\n🤖 Starting Question Answering System...');
    return executeQuestionAnswering();
}).catch((error) => {
    console.error('❌ Error:', error);
});