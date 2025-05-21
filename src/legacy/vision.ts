import fs from "fs";
import OpenAI from "openai";
import { Langfuse } from "langfuse";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com"
});

export async function processImage(imagePath: string, prompt: string, model: string = "gpt-4.1-nano") {
    const trace = langfuse.trace({
        name: "process-image",
        metadata: {
            model,
            imagePath,
            prompt
        }
    });

    const base64Image = fs.readFileSync(imagePath, "base64");

    const response = await client.responses.create({
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

    await trace.span({
        name: "openai-response",
        input: { prompt, model },
        output: response.output_text,
        metadata: {
            model
        }
    });

    console.log(response.output_text);

    await trace.update({ output: response.output_text });
    return response.output_text;  
}