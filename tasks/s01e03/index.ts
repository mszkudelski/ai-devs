import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { reportUrl } from '../../src/url.js';   
// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const answerUrl = reportUrl;
const jsonData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data_result.json'), 'utf8'));
console.log({...jsonData, apikey: process.env.AI_DEVS_API_KEY});
fetch(answerUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        task: "JSON",
        apikey: process.env.AI_DEVS_API_KEY,
        answer: {...jsonData, apikey: process.env.AI_DEVS_API_KEY}
    })
})
.then(response => response.json())
.then(data => console.log('Response:', data))
.catch(error => console.error('Error:', error));