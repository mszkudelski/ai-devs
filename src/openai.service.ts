import OpenAI from 'openai';
import { LangfuseService } from './langfuse.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

type TraceMetadata = {
  id: string;
  name: string;
  sessionId: string;
};

type TraceInput = Record<string, any>;
type TraceOutput = Record<string, any>;

export class OpenAIService {
  private openai: OpenAI;
  private langfuseService: LangfuseService;
  private defaultChatModel = "gpt-4.1-nano";
  private defaultTranscriptionModel = "whisper-1";

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in .env file');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.langfuseService = new LangfuseService();
  }

  /**
   * Generic method to handle Langfuse tracing for any OpenAI operation
   */
  private async withTracing<T>(
    metadata: TraceMetadata,
    input: TraceInput,
    operation: () => Promise<T>
  ): Promise<T> {
    const trace = this.langfuseService.createTrace(metadata);

    try {
      const result = await operation();
      await this.langfuseService.finalizeTrace(trace, input, { result });
      return result;
    } catch (error) {
      await this.langfuseService.finalizeTrace(trace, input, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Generates a chat completion response
   */
  async getChatResponse(prompt: string, model: string = this.defaultChatModel): Promise<string> {
    return this.withTracing(
      {
        id: `chat-${Date.now()}`,
        name: 'Chat Completion',
        sessionId: 'default'
      },
      { prompt, model },
      async () => {
        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        });

        const responseText = response.choices[0]?.message?.content || '';
        
        return {
          response: responseText,
          usage: response.usage ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens
          } : undefined
        };
      }
    ).then(result => result.response);
  }

  /**
   * Generates an image using DALL-E 3
   */
  async generateImage(description: string): Promise<string> {
    return this.withTracing(
      {
        id: `dalle-${Date.now()}`,
        name: 'DALL-E Image Generation',
        sessionId: 'default'
      },
      { prompt: description },
      async () => {
        const response = await this.openai.images.generate({
          model: "dall-e-3",
          prompt: description,
          n: 1,
          size: "1024x1024",
        });

        if (!response.data?.[0]?.url) {
          throw new Error('No image URL returned from DALL-E');
        }

        return { imageUrl: response.data[0].url };
      }
    ).then(result => result.imageUrl);
  }

  /**
   * Transcribes audio from a file
   */
  async getTranscription(filePath: string, model: string = this.defaultTranscriptionModel): Promise<string> {
    return this.withTracing(
      {
        id: `transcription-${Date.now()}`,
        name: 'Audio Transcription',
        sessionId: 'default'
      },
      { filePath, model },
      async () => {
        const response = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model,
          response_format: "text"
        });

        return { transcription: response };
      }
    ).then(result => result.transcription);
  }

  /**
   * Processes an image with GPT-4 Vision
   */
  async processImage(imagePath: string, prompt: string, model: string = this.defaultChatModel): Promise<string> {
    return this.withTracing(
      {
        id: `vision-${Date.now()}`,
        name: 'Image Processing',
        sessionId: 'default'
      },
      { imagePath, prompt, model },
      async () => {
        const base64Image = fs.readFileSync(imagePath, "base64");

        const response = await this.openai.responses.create({
          model,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt },
                {
                  type: "input_image",
                  image_url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "high"
                },
              ],
            },
          ],
        });

        return { response: response.output_text };
      }
    ).then(result => result.response);
  }

  /**
   * Shuts down the Langfuse service
   */
  async shutdown(): Promise<void> {
    await this.langfuseService.shutdownAsync();
  }
} 