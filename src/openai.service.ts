import OpenAI, { toFile } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import fs from 'fs/promises';
import path from 'path';
import { LangfuseService } from './langfuse.js';
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

  async completion(config: {
    messages: ChatCompletionMessageParam[],
    model?: string,
    stream?: boolean,
    jsonMode?: boolean,
    maxTokens?: number
  }): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const { messages, model = "gpt-4", stream = false, jsonMode = false, maxTokens = 8096 } = config;
    try {
      const chatCompletion = await this.openai.chat.completions.create({
        messages,
        model,
        stream,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : { type: "text" }
      });
      
      return chatCompletion;
    } catch (error) {
      console.error("Error in OpenAI completion:", error);
      throw error;
    }
  }

  async transcribe(audioFiles: string[], config: { language: string, prompt?: string } = { language: 'pl', prompt: '' }): Promise<{ content: string }[]> {
    console.log("Transcribing audio files...");
    const results = await Promise.all(audioFiles.map(async (filePath) => {
      const buffer = await fs.readFile(filePath);
      const transcription = await this.openai.audio.transcriptions.create({
        file: await toFile(buffer, 'speech.mp3'),
        language: config.language,
        model: 'whisper-1',
        prompt: config.prompt,
      });

      return { content: transcription.text };
    }));

    return results;
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
        const buffer = await fs.readFile(filePath);
        const response = await this.openai.audio.transcriptions.create({
          file: await toFile(buffer, 'speech.mp3'),
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
  async processImage(imagePath: string, prompt?: string, model: string = this.defaultChatModel): Promise<string> {
    return this.withTracing(
      {
        id: `vision-${Date.now()}`,
        name: 'Image Processing',
        sessionId: 'default'
      },
      { imagePath, prompt, model },
      async () => {
        const buffer = await fs.readFile(imagePath);
        const base64Image = buffer.toString('base64');

        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt || "Describe the image in detail." },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
              ],
            },
          ],
        });

        return { response: response.choices[0].message.content || "No description available." };
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