import fs from 'fs';
import path from 'path';
import { getTranscription } from '../../src/legacy/transcription.js';

const AUDIO_DIR = 'tasks/s02e01/data/przesluchania';
const TRANSCRIPTIONS_DIR = 'tasks/s02e01/data/transcriptions';

async function createTranscription(audioPath: string, outputPath: string) {
    try {
        console.log(`Processing ${audioPath}...`);
        const transcription = await getTranscription(audioPath);
        
        // Save transcription to file
        fs.writeFileSync(outputPath, transcription);
        console.log(`Transcription saved to ${outputPath}`);
    } catch (error) {
        console.error(`Error processing ${audioPath}:`, error);
    }
}

async function processAudioFiles() {
    // Create transcriptions directory if it doesn't exist
    if (!fs.existsSync(TRANSCRIPTIONS_DIR)) {
        fs.mkdirSync(TRANSCRIPTIONS_DIR, { recursive: true });
    }

    console.log('Processing audio files...', path.join(process.cwd(), AUDIO_DIR));
    // Get all files from the audio directory
    const files = fs.readdirSync(AUDIO_DIR);

    const transcriptionPromises = files
        .filter(file => !file.startsWith('.'))
        .map(file => {
            const audioPath = path.join(AUDIO_DIR, file);
            const outputFileName = `${path.parse(file).name}.txt`;
            const outputPath = path.join(TRANSCRIPTIONS_DIR, outputFileName);
            
            return createTranscription(audioPath, outputPath);
        });

    await Promise.all(transcriptionPromises);

    console.log('All transcriptions completed');
}

// Run the script
processAudioFiles().catch(console.error);

// createTranscription('./data/przesluchania/adam.m4a', './data/transcriptions/adam.txt');