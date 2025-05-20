import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { processImage } from '../../src/vision.js';
import { getChatResponse } from '../../src/response.js';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'maps/map.jpeg');
const outputDir = path.join(__dirname, 'maps');

async function detectBoundaries() {
  const metadata = await sharp(inputPath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read image dimensions');
  }

  // Calculate section dimensions based on image size
  const totalWidth = metadata.width;
  const totalHeight = metadata.height;

  // Define sections with dynamic boundaries
  const sections = [
    { 
      name: 'section1', 
      top: 0, 
      left: 0, 
      width: Math.floor(totalWidth / 2), 
      height: Math.floor(totalHeight / 3) 
    },
    { 
      name: 'section2', 
      top: 0, 
      left: Math.floor(totalWidth / 2), 
      width: Math.floor(totalWidth / 2), 
      height: Math.floor(totalHeight / 3) 
    },
    { 
      name: 'section3', 
      top: Math.floor(totalHeight / 3), 
      left: 0, 
      width: totalWidth, 
      height: Math.floor(totalHeight / 3) 
    },
    { 
      name: 'section4', 
      top: Math.floor((totalHeight / 3) * 2), 
      left: 0, 
      width: totalWidth, 
      height: Math.floor(totalHeight / 3) 
    }
  ];

  return sections;
}

async function splitAndProcess() {
  try {
    const sections = await detectBoundaries();

    const results = [];
    
    for (const section of sections) {
      const outputPath = path.join(outputDir, `${section.name}.jpeg`);
      
      // Extract and enhance the section
      await sharp(inputPath)
        .extract({ 
          left: section.left, 
          top: section.top, 
          width: section.width, 
          height: section.height 
        })
        .normalize() // Auto contrast stretch
        .linear(1.2, -30) // Increase contrast
        .toFile(outputPath);
      
      console.log(`Saved: ${outputPath}`);
      
      results.push(outputPath);
    }

    return results;
  } catch (error) {
    console.error('Error processing image:', error);
  }
}

const results = (await splitAndProcess() ) || []

const chatResults = []

for (const result of results) {
    
console.log('============== ANALYSIS: ', result);
    
      const prompt = `Analyze this section of the map.
      
      First list every objects and streets you can recognize. Get the names of the streets, objects, how they are related to each other. Get types of the objects.`;
      const chatOutput = await processImage(result, prompt, 'gpt-4.1-mini');
      chatResults.push(chatOutput);
}

// console.log(chatResults);

const wrongCities = ['Kraków', 'Gdansk', 'Łódź', 'Bydgoszcz', 'Torun']

const chatResponse = await getChatResponse(`You have give below ${chatResults.length} analysis of 4 sections of the map. Determinie what is the name of the city in the following text. One of the analysis is for another city, but the rest of them are for the same city. For sure it's not: ${wrongCities.join(', ')}. Think before you answer. Give result in format:
    <thinking>your analysis</thinking>
    <result>city name</result>
    
    Here are analysis: ` +  chatResults.join('\n'), 'gpt-4.1');

const cityName = chatResponse.match(/<result>(.*?)<\/result>/)?.[1];

console.log(`{{FLG:${cityName}}}`);
