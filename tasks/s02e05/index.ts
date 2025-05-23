import { getCentralDataUrl, getCentralUrl } from "../../src/url.js";
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { OpenAIService } from "../../src/openai.service.js";
import fs from 'fs/promises';
import { sendReport } from "../../src/report.js";
import path from 'path';

const url = getCentralUrl('dane/arxiv-draft.html');
const openaiService = new OpenAIService();
const CACHE_FILE = 'processed_text_cache.txt';

async function fetchAndParseHtml() {
  try {
    // Fetch HTML content
    const response = await axios.get(url);
    const html = response.data;

    // Parse HTML using JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract text content
    let text = '';

    // Function to recursively process nodes
    function processNode(node: Node) {
      if (node.nodeType === 3) { // Text node
        const content = node.textContent?.trim();
        if (content) {
          text += content + ' ';
        }
      } else if (node instanceof dom.window.HTMLImageElement) {
        const src = node.getAttribute('src');
        if (src) {
          text += ` <image>${src}</image> `;
        }
      } else if (node instanceof dom.window.HTMLAnchorElement) {
        const href = node.getAttribute('href');
        if (href?.toLowerCase().endsWith('.mp3')) {
          text += ` <audio>${href}</audio> `;
        }
      }

      // Process child nodes
      node.childNodes.forEach(processNode);
    }

    // Process all nodes starting from body
    processNode(document.body);

    // Clean up multiple spaces
    text = text.replace(/\s+/g, ' ').trim();

    // Also collect URLs separately for reference
    const imageUrls = Array.from(document.getElementsByTagName('img'))
      .map((img: HTMLImageElement) => img.getAttribute('src'))
      .filter((src): src is string => src !== null);

    const audioUrls = Array.from(document.getElementsByTagName('a'))
      .map((a: HTMLAnchorElement) => a.getAttribute('href'))
      .filter((href): href is string => href !== null && href.toLowerCase().endsWith('.mp3'));

    return {
      text,
      imageUrls, 
      audioUrls
    };
  } catch (error) {
    console.error('Error fetching or parsing HTML:', error);
    throw error;
  }
}

// Execute the function and log results
try {
  // Check if cache file exists
  let processedText;
  try {
    processedText = await fs.readFile(CACHE_FILE, 'utf-8');
    console.log('Using cached processed text');
  } catch (error) {
    console.log('No cache found, processing text...');
    const result = await fetchAndParseHtml();
    console.log('Extracted text:', result.text);
    console.log('Image URLs:', result.imageUrls);
    console.log('Audio URLs:', result.audioUrls);

    const urlFiles = getCentralUrl('dane/');
    // Download images
    const imagePromises = result.imageUrls.map(async (imageUrl) => {
      const response = await axios.get(urlFiles + imageUrl);
      return response.data;
    });

    // Download audio files 
    const audioPromises = result.audioUrls.map(async (audioUrl) => {
      const response = await axios.get(urlFiles + audioUrl);
      return response.data;
    });

    // Wait for all downloads to complete
    const [images, audio] = await Promise.all([
      Promise.all(imagePromises),
      Promise.all(audioPromises)
    ]);

    // Create a map of image URLs to their content
    const imageMap = new Map(result.imageUrls.map((url, index) => [url, images[index]]));

    // Replace image markers with their content
    processedText = result.text;
    
    // Process images sequentially to avoid async issues
    for (const [url, content] of imageMap.entries()) {
      const description = await openaiService.processImage(urlFiles + url, 'Describe the image in detail. Return only description, no other text. Return in Polish language.');
      console.log('Description for image:', url, description);
      processedText = processedText.replace(`<image>${url}</image>`, `<image>${description}</image>`);
    }

    // Wait for transcriptions to complete
    const transcriptionPromises = result.audioUrls.map(async (audioUrl, index) => {
      const tempFilePath = `temp-${index}.mp3`;
      await fs.writeFile(tempFilePath, audio[index]);
      const transcription = await openaiService.getTranscription(urlFiles+audioUrl);
      await fs.unlink(tempFilePath); // Clean up temp file
      return transcription;
    });

    // Create a map of audio URLs to their transcriptions
    const transcriptions = await Promise.all(transcriptionPromises);
    const transcriptionMap = new Map(result.audioUrls.map((url, index) => [url, transcriptions[index]]));

    // Replace audio markers with their transcriptions
    for (const [url, transcription] of transcriptionMap.entries()) {
      console.log('Transcription for audio:', url, transcription);
      processedText = processedText.replace(`<audio>${url}</audio>`, transcription ? `<audio>${transcription}</audio>` : `<audio>${url}</audio>`);
    }

    // Save processed text to cache file
    await fs.writeFile(CACHE_FILE, processedText);
    console.log('Saved processed text to cache');
  }

  console.log('Processed text with content:', processedText);

  const dataUrl = getCentralDataUrl('arxiv.txt');
  console.log('Data URL:', dataUrl);

  const arxivResponse = await axios.get(dataUrl);
  const arxivData = arxivResponse.data;
  console.log('Arxiv data:', arxivData);

  const chatResponse = await openaiService.getChatResponse(`You are analysis expert.
  You are given a text and you need to analyze it and determine answers for given questions.

  The text is in Polish language. It contains images (in tags <image>), audio transcriptions (in tags <audio>) and text.

  Answering the question take into account the text, images and audio transcriptions. Take context of images into account. Text could describe the image. Alwayes check if text does refers to an image.

  Questions are in format:
  <question_id>=<question>

  ## Result
  
    Return your answer format:

    <thinking>
    <your_thinking>
    </thinking>
    <answer>
    {
        "<question_id>": <answer>
        "<another_question_id>": <answer>
        },
    </answer>

    Answer for each question should be in Polish language. It should be one short sentence.
    If you're not sure about answer, return "NIE WIEM".
    
    Think before answering. Your can think in English. Put your thinking for all questions in "thinking" section of your answer.

    Think for every question separately.

  
  ## Questions
  
  ${arxivData}
  
  ## Text 
  
  ${processedText}
  `, 'gpt-4.1');

  console.log('Chat response:', chatResponse);
  const answerMatch = chatResponse.match(/<answer>\s*({[\s\S]*?})\s*<\/answer>/);
  if (!answerMatch) {
    throw new Error('Could not extract answer from response');
  }
  const answer = JSON.parse(answerMatch[1]);
  sendReport('arxiv', answer);
} catch (error) {
  console.error('Failed to process HTML:', error);
}