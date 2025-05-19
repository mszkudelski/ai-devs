import OpenAI from "openai";
import dotenv from 'dotenv';
import { Langfuse } from "langfuse";
import fs from 'fs';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in .env file');
}

if (!process.env.LANGFUSE_SECRET_KEY || !process.env.LANGFUSE_PUBLIC_KEY) {
    throw new Error('LANGFUSE_SECRET_KEY or LANGFUSE_PUBLIC_KEY is not set in .env file');
}

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com"
});

const defaultModel = "whisper-1";

export async function getTranscription(filePath: string, model: string = defaultModel) {
    const trace = langfuse.trace({
        name: "audio-transcription",
        metadata: {
            filePath,
            model
        }
    });

    try {
        const response = await client.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model,
            response_format: "text"
        });

        console.log("Transcription from file: ", filePath, "\n", response);

        await trace.update({
            output: response
        });

        return response;
    } catch (error) {
        await trace.update({
            metadata: {
                error: error instanceof Error ? error.message : String(error)
            }
        });
        throw error;
    }
}
