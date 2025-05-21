import { OpenAIService } from "../../src/openai.service.js";

const openaiService = new OpenAIService();

const response = await openaiService.getChatResponse('Opisz kontekst bitwy pod Grunwaldem');
console.log(response);

await openaiService.shutdown();