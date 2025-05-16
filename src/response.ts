import OpenAI from "openai";
import dotenv from 'dotenv';
import { Langfuse } from "langfuse";

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

const defaultModel = "gpt-4.1-nano";

export async function getChatResponse(prompt: string, model: string = defaultModel) {
    // Create a trace for this chat interaction
    const trace = langfuse.trace({
        name: "chat-completion",
        metadata: { prompt }
    });

    // Create a generation to track the OpenAI call
    const generation = trace.generation({
        name: "openai-chat",
        model,
        input: prompt,
    });

    try {
        const response = await client.chat.completions.create({
            model,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        });

        const responseText = response.choices[0]?.message?.content || '';
        console.log('chat response:' + responseText);

        // End the generation with the response
        generation.end({
            output: responseText,
            usageDetails: response.usage ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens
            } : undefined
        });

        return responseText;
    } catch (error: any) {
        // Log error in the generation
        generation.end({
            level: "ERROR",
            statusMessage: error?.message || 'Unknown error occurred'
        });
        throw error;
    } finally {
        // Make sure to flush events before the process exits
        await langfuse.shutdownAsync();
    }
}