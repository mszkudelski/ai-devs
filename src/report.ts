import { reportUrl } from './url.js';
import dotenv from 'dotenv';
import { postRequest } from './api.js';

dotenv.config();

/**
 * Sends a report to the AI Devs server
 * @param taskName The name of the task
 * @param answer The answer data to submit
 * @returns Promise with the response
 */
export const sendReport = async <T, R = any>(taskName: string, answer: T): Promise<R> => {
  try {
    const payload = {
      task: taskName,
      apikey: process.env.AI_DEVS_API_KEY,
      answer
    };
    
    const response = await postRequest<typeof payload, R>(reportUrl, payload);
    console.log('Response:', response);
    return response;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};