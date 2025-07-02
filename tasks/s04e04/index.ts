import { getCentralUrl } from "../../src/url.js";
import { postRequest } from "../../src/api.js";
import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const openaiService = new OpenAIService();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the map from the JSON file
const mapFilePath = path.join(__dirname, 'map.json');
let mapData: string[][] = [];

// Load map data if file exists
if (fs.existsSync(mapFilePath)) {
  try {
    const mapJson = fs.readFileSync(mapFilePath, 'utf-8');
    mapData = JSON.parse(mapJson);
    console.log('Map loaded successfully');
  } catch (error) {
    console.error('Error loading map:', error);
  }
} else {
  console.error('Map file not found:', mapFilePath);
}

// Certificate paths - will be generated if they don't exist
const certPath = path.join(__dirname, 'cert');
const keyPath = path.join(certPath, 'key.pem');
const certFilePath = path.join(certPath, 'cert.pem');

/**
 * Webhook handler function for processing drone instructions
 */
async function webhookHandler(req: any, res: any): Promise<void> {
  console.log('Received webhook request:', req.body);
  
  const { instruction } = req.body;
  
  if (!instruction) {
    res.status(400).json({
      error: "Missing 'instruction' field"
    });
    return;
  }
  
  try {
    // Get the place name from the map based on the instruction
    const place = await generatePlaceDescription(instruction);
    
    // Return the exact format requested: {"description": "łąka"}
    res.json({
      description: place
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      description: 'An undetermined location'
    });
  }
}

/**
 * Generates self-signed SSL certificates if they don't exist
 */
async function ensureCertificates(): Promise<void> {
  if (!fs.existsSync(certPath)) {
    fs.mkdirSync(certPath, { recursive: true });
  }
  
  if (!fs.existsSync(keyPath) || !fs.existsSync(certFilePath)) {
    console.log('Generating self-signed certificates...');
    
    await new Promise<void>((resolve, reject) => {
      const { exec } = require('child_process');
      exec(`openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certFilePath} -days 365 -nodes -subj "/CN=localhost"`, 
        (error: Error | null) => {
          if (error) {
            console.error('Failed to generate certificates:', error);
            reject(error);
            return;
          }
          console.log('Certificates generated successfully');
          resolve();
        });
    });
  } else {
    console.log('Using existing certificates');
  }
}

/**
 * Generate a place description based on drone instruction
 */
async function generatePlaceDescription(instruction: string): Promise<string> {
  try {
    // First, determine the location on the map based on the instruction
    const locationData = await getLocationFromInstruction(instruction);
    
    if (!locationData) {
      return 'An undetermined location';
    }
    
    // Return just the place name from the map
    return locationData.place;
  } catch (error) {
    console.error('Error generating description:', error);
    return 'An undetermined location';
  }
}

/**
 * Interpret drone instruction to determine the location on the map
 * Handles various formats of instructions like coordinates, directions, etc.
 */
async function getLocationFromInstruction(instruction: string): Promise<{ place: string; coordinates: [number, number] } | null> {
  try {
    // Use LLM to interpret the instruction and extract coordinates
    const prompt = `
You are an AI assistant controlling a drone flying over a 4x4 map grid. The grid coordinates are [row, column] starting from [0,0] at the top left.

Map grid:
${JSON.stringify(mapData, null, 2)}

Based on the following instruction:
"${instruction}"

Extract the exact row and column coordinates where the drone should be positioned on the grid. 
The instruction might contain:
- Explicit coordinates like "row 2, column 3"
- Directions like "north, south, east, west" 
- Relative movements like "2 steps down, 1 step right"
- References to specific locations like "go to the house"
- References to grid positions like "top right corner" or "bottom left"

Use thinking field to reason about the instruction and determine the exact coordinates.

IMPORTANT: Return ONLY a JSON object in this exact format without any explanation:
{
  "thinking": "Your reasoning about the instruction",
  "row": number, // 0-3, where 0 is the top row
  "column": number // 0-3, where 0 is the leftmost column
}
`;

    const response = await openaiService.getChatResponse(prompt);
    
    // Extract the JSON coordinates from the response
    let coordinates;
    try {
      // Find JSON object in the response
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        coordinates = JSON.parse(jsonMatch[0]);
      } else {
        coordinates = JSON.parse(response);
      }
    } catch (parseError) {
      console.error('Error parsing coordinates from LLM response:', parseError);
      console.log('Raw LLM response:', response);
      return null;
    }
    
    const row = coordinates.row;
    const column = coordinates.column;
    
    // Validate the coordinates
    if (row === undefined || column === undefined || 
        row < 0 || row >= mapData.length || 
        column < 0 || column >= mapData[0].length) {
      console.error('Invalid coordinates:', row, column);
      return null;
    }
    
    // Get the place at those coordinates
    const place = mapData[row][column];
    
    console.log(`Drone location: [${row}, ${column}] - ${place}`);
    return { 
      place, 
      coordinates: [row, column]
    };
  } catch (error) {
    console.error('Error getting location from instruction:', error);
    return null;
  }
}

/**
 * Set up the Express server with HTTPS
 */
async function setupServer(): Promise<https.Server> {
  await ensureCertificates();
  
  const app = express();
  app.use(express.json());
  
  // Configure the webhook endpoint
  app.post('/webhook', webhookHandler as any);

  // Health check endpoint
  app.get('/', (req: any, res: any) => {
    res.send('HTTPS Server is running');
  });
  
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certFilePath),
    minVersion: 'TLSv1.2' as const // Ensure we're using a modern TLS version
  };
  
  const port = process.env.PORT || 3000;
  const server = https.createServer(httpsOptions, app);
  
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`HTTPS server running on port ${port}`);
      console.log(`Webhook available at https://localhost:${port}/webhook`);
      resolve(server);
    });
  });
}

/**
 * Set up an HTTP server (for fallback or testing)
 */
function setupHttpServer(): http.Server {
  const app = express();
  app.use(express.json());
  
  // Configure the webhook endpoint
  app.post('/webhook', webhookHandler as any);

  // Health check endpoint
  app.get('/', (req: any, res: any) => {
    res.send('HTTP Server is running');
  });
  
  const port = process.env.HTTP_PORT || 8080;
  const server = http.createServer(app);
  
  return server;
}

/**
 * Main execution function for the task
 */
async function executeTask() {
  try {
    console.log('Starting s04e04 - REST API with webhook endpoint');
    
    // Check if we should use HTTP mode (for testing/development)
    const useHttp = process.env.USE_HTTP === 'true';
    let server;
    
    if (useHttp) {
      // Start HTTP server
      server = setupHttpServer();
      const port = process.env.HTTP_PORT || 8080;
      server.listen(port, () => {
        console.log(`HTTP server running on port ${port}`);
        console.log(`Webhook available at http://localhost:${port}/webhook`);
      });
    } else {
      // Start HTTPS server (default)
      server = await setupServer();
    }
    
    console.log('Server is ready to receive webhook requests');
    console.log('');
    console.log('To test with curl:');
    
    if (useHttp) {
      console.log('curl -X POST http://localhost:8080/webhook \\');
    } else {
      console.log('curl -k -X POST https://localhost:3000/webhook \\');
    }
    
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"test": "data"}\'');
    
    // Keep the server running until manually terminated
    process.on('SIGINT', () => {
      console.log('Shutting down server...');
      server.close(() => {
        console.log('Server successfully closed');
        process.exit(0);
      });
    });
    
    // For the purposes of the AI_devs task, uncomment the following line
    // when you have a public URL for your webhook
    // To get a public URL, you can use a service like ngrok, localtunnel, or a cloud deployment
    console.log('To submit your solution, update the URL in the sendReport function:');
    console.log('await sendReport(\'s04e04\', \'https://fc19-2a02-dcf-5-2200-00-45.ngrok-free.app/webhook\');');
    // await sendReport('s04e04', 'https://fc19-2a02-dcf-5-2200-00-45.ngrok-free.app/webhook');
    
    // Example with ngrok URL (replace with your actual URL):
    await sendReport('webhook', 'https://fc19-2a02-dcf-5-2200-00-45.ngrok-free.app/webhook');
    
  } catch (error) {
    console.error('Error executing task:', error);
    process.exit(1);
  }
}

// Start the task
executeTask();