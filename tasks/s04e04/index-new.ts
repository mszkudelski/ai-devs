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

// Certificate paths - will be generated if they don't exist
const certPath = path.join(__dirname, 'cert');
const keyPath = path.join(certPath, 'key.pem');
const certFilePath = path.join(certPath, 'cert.pem');

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
    const prompt = `
Based on the following drone flight instruction, generate a brief description of the location:

Instruction: "${instruction}"

Generate a short, concise description of what the drone would see at this location.
`;

    const response = await openaiService.getChatResponse(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error generating description:', error);
    return 'An undetermined location';
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
  app.post('/webhook', (req, res) => {
    console.log('Received webhook request:', req.body);
    
    const { instruction } = req.body;
    
    if (!instruction) {
      return res.status(400).json({
        error: "Missing 'instruction' field"
      });
    }
    
    // Generate a description based on the drone instruction
    generatePlaceDescription(instruction)
      .then(description => {
        // Return the required structure
        res.json({
          description
        });
      })
      .catch(error => {
        console.error('Error handling webhook:', error);
        res.status(500).json({
          error: 'Internal server error',
          description: 'An undetermined location'
        });
      });
  });

  // Health check endpoint
  app.get('/', (req, res) => {
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
  app.post('/webhook', (req, res) => {
    console.log('Received webhook request:', req.body);
    
    const { instruction } = req.body;
    
    if (!instruction) {
      return res.status(400).json({
        error: "Missing 'instruction' field"
      });
    }
    
    // Generate a description based on the drone instruction
    generatePlaceDescription(instruction)
      .then(description => {
        // Return the required structure
        res.json({
          description
        });
      })
      .catch(error => {
        console.error('Error handling webhook:', error);
        res.status(500).json({
          error: 'Internal server error',
          description: 'An undetermined location'
        });
      });
  });

  // Health check endpoint
  app.get('/', (req, res) => {
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
    console.log('  -d \'{"instruction": "Leć 200 metrów na północ, następnie skręć w prawo i leć jeszcze 300 metrów"}\'');
    
    // Keep the server running until manually terminated
    process.on('SIGINT', () => {
      console.log('Shutting down server...');
      server.close(() => {
        console.log('Server successfully closed');
        process.exit(0);
      });
    });
    
    // For the purposes of the AI_devs task, we might need to report a URL
    // This is a placeholder and would need to be updated with a public URL
    // when deployed to a server with a public IP or domain
    // await sendReport('s04e04', 'https://your-public-url/webhook');
    
  } catch (error) {
    console.error('Error executing task:', error);
    process.exit(1);
  }
}

// Start the task
executeTask();
