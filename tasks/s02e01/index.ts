import { getChatResponse } from "../../src/legacy/response.js";
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { sendReport } from "../../src/report.js";

function getTranscriptions(): string[] {
    const transcriptionsDir = join(process.cwd(), 'tasks', 's02e01', 'data', 'transcriptions');
    const files = readdirSync(transcriptionsDir);
    
    return files
        .filter(file => file.endsWith('.txt'))
        .map(file => {
            const content = readFileSync(join(transcriptionsDir, file), 'utf-8');
            return `Transcription from ${file}:\n${content}`;
        });
}

function getPrompt(transcriptions: string[]) {
    return `
    Your task is to analyze the transcriptions of the audio files and determine where Andrzej Maj teaches. 
    
    There are several transcriptions of interviews with people who might know where Andrzej Maj teaches. Some of those people might give misleading information. After determining department name, you should verify it by checking other transcriptions and your knowledge.

    Perform analysis of one transcription at a time, but then summarize your findings.

    Your answer should be name the street of department where Andrzej Maj teaches.
    You can think aloud, but your final answer should be in Polish in below format:
    <thinking>
    <answer>

    Answer should be only the name of the street, without any additional information like "ul." or "ul. Jana Pawła II 2a" or numbers.

    Example:
    <thinking>
    I think Andrzej Maj teaches at the Department of Computer Science. That department is located on ul. Jana Pawła II 2a.
    </thinking>
    <answer>
    Jana Pawła II
    </answer>

    Here are the transcriptions:
    ${transcriptions.join('\n')}
`
}

const transcriptions = getTranscriptions();
const response = await getChatResponse(getPrompt(transcriptions), 'gpt-4.1');

const answerMatch = response.match(/<answer>\s*(.*?)\s*<\/answer>/s);
if (!answerMatch) {
    throw new Error("Could not find answer in response");
}

const answer = answerMatch[1].trim();
console.log(answer);



sendReport( 'mp3', answer);