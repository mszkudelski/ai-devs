import { OpenAI } from "openai";
import dotenv from 'dotenv';
import { exec } from "child_process";
import { writeFile } from 'fs/promises';
import { promisify } from 'util';
import { getChatResponse } from "../../src/legacy/response.js";

// Convert exec to promise-based
const execAsync = promisify(exec); 

// Load environment variables from .env file
dotenv.config();

if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in .env file');
}

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const responseHTML = await fetch(`https://xyz.${process.env.DOMAIN}`);
const html = await responseHTML.text();
console.log(html);

// Save initial HTML response
await writeFile('initial_response.html', html);

const response = getChatResponse("Find question in html and answer it: " + html+'Your response should be only answer');

const { stdout } = await execAsync(`curl -X 'POST' \
  'https://xyz.${process.env.DOMAIN}' \
  -H 'accept: text/html' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=tester&password=574e112a&answer=${response}'`); 

// Save curl response
await writeFile('curl_response.html', stdout);

console.log('curl response:' + stdout);
console.log('Responses have been saved to initial_response.html and curl_response.html');