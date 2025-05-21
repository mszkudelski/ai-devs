import OpenAI from 'openai';
import { LangfuseService } from '../langfuse.js';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const langfuseService = new LangfuseService();

/**
 * Generates an image using DALL-E 3 model
 * @param description The description of the image to generate
 * @returns Promise with the image URL
 */
export const generateImage = async (description: string): Promise<string> => {
  const trace = langfuseService.createTrace({
    id: `dalle-${Date.now()}`,
    name: 'DALL-E Image Generation',
    sessionId: 'default'
  });

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: description,
      n: 1,
      size: "1024x1024",
    });

    if (!response.data?.[0]?.url) {
      throw new Error('No image URL returned from DALL-E');
    }

    const imageUrl = response.data[0].url;
    await langfuseService.finalizeTrace(trace, { prompt: description }, { imageUrl });
    return imageUrl;
  } catch (error) {
    await langfuseService.finalizeTrace(trace, { prompt: description }, { error: error.message });
    console.error('Error generating image:', error);
    throw error;
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await langfuseService.shutdownAsync();
  process.exit(0);
});