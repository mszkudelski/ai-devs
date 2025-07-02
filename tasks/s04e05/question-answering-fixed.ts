import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { getCentralDataUrl } from "../../src/url.js";
import { postRequest } from "../../src/api.js";
import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import { extractFromTags } from "../../src/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Question {
    question: string;
    expected_answer?: string;
}

interface NotesData {
    questions: Question[];
}

interface AnswerAttempt {
    answers: Record<string, string>;
    attempt: number;
    hints?: string;
    response?: any;
    timestamp: string;
    success: boolean;
}

interface AttemptHistory {
    attempts: AnswerAttempt[];
    totalAttempts: number;
    confirmedCorrectAnswers?: Record<string, string>; // Question number -> correct answer
}

const openaiService = new OpenAIService();

function parseIncorrectQuestion(feedbackMessage: string): number | null {
    // Look for patterns like "Answer for question 03 is incorrect", "Question 3 is wrong", etc.
    const patterns = [
        /answer\s+for\s+question\s+(\d+)\s+is\s+incorrect/i,
        /question\s+(\d+)\s+is\s+(?:wrong|incorrect|invalid)/i,
        /(?:błędna|nieprawidłowa)\s+odpowiedź\s+(?:na\s+)?pytanie\s+(\d+)/i,
        /pytanie\s+(\d+)\s+(?:jest\s+)?(?:błędne|nieprawidłowe)/i,
        /(\d+)\s+(?:jest\s+)?(?:błędne|nieprawidłowe|incorrect|wrong)/i
    ];
    
    for (const pattern of patterns) {
        const match = feedbackMessage.match(pattern);
        if (match) {
            const questionNum = parseInt(match[1], 10);
            if (questionNum >= 1 && questionNum <= 10) { // Reasonable bounds
                console.log(`🎯 Detected incorrect question: ${questionNum} from message: "${feedbackMessage}"`);
                return questionNum;
            }
        }
    }
    
    console.log(`❓ Could not parse incorrect question from: "${feedbackMessage}"`);
    return null;
}

function extractConfirmedCorrectAnswers(history: AttemptHistory): Record<string, string> {
    const confirmedAnswers: Record<string, string> = {};
    
    // Start with any previously confirmed answers
    if (history.confirmedCorrectAnswers) {
        Object.assign(confirmedAnswers, history.confirmedCorrectAnswers);
    }
    
    // Look through attempts to find newly confirmed correct answers
    for (const attempt of history.attempts) {
        if (!attempt.success && attempt.response && attempt.answers) {
            // Get all possible feedback messages
            const feedbackMessages = [
                attempt.response.message,
                attempt.response.hint,
                attempt.response.debug,
                attempt.hints
            ].filter(msg => msg && typeof msg === 'string');
            
            for (const message of feedbackMessages) {
                const incorrectQuestion = parseIncorrectQuestion(message);
                if (incorrectQuestion !== null) {
                    // All questions before the incorrect one are correct
                    const incorrectQuestionKey = incorrectQuestion.toString().padStart(2, '0');
                    
                    console.log(`🎯 Question ${incorrectQuestion} was incorrect, marking previous questions as correct`);
                    
                    Object.entries(attempt.answers).forEach(([questionKey, answer]) => {
                        const questionNum = parseInt(questionKey, 10);
                        if (questionNum < incorrectQuestion && !confirmedAnswers[questionKey]) {
                            confirmedAnswers[questionKey] = answer;
                            console.log(`✅ Confirmed correct: Q${questionKey} = "${answer}"`);
                        }
                    });
                    
                    break; // Only process first detected incorrect question per attempt
                }
            }
        }
    }
    
    return confirmedAnswers;
}

async function fetchQuestions(): Promise<Question[]> {
    console.log('Fetching questions from notes.json...');
    
    const notesUrl = getCentralDataUrl('notes.json');
    console.log(`Fetching from: ${notesUrl}`);
    
    try {
        // Use axios directly for GET request
        const response = await axios.get(notesUrl);
        console.log('Raw response:', response.data);
        
        if (response.data && typeof response.data === 'object') {
            // Convert object with numbered keys to array of questions
            const questions: Question[] = Object.entries(response.data).map(([key, question]) => ({
                question: question as string
            }));
            
            console.log(`Fetched ${questions.length} questions`);
            return questions;
        } else if (Array.isArray(response.data)) {
            // If data is directly an array of questions
            console.log(`Fetched ${response.data.length} questions (direct array)`);
            return response.data;
        } else {
            console.error('Unexpected response format:', response.data);
            throw new Error('Questions not found in response');
        }
    } catch (error) {
        console.error('Error fetching questions:', error);
        throw error;
    }
}

function loadExtractedText(): string {
    const textPath = path.join(__dirname, 'data', 'extracted-text-ai-vision.txt');
    
    if (!fs.existsSync(textPath)) {
        throw new Error(`AI vision text file not found at: ${textPath}. Please run PDF extraction with AI vision first.`);
    }
    
    const text = fs.readFileSync(textPath, 'utf8');
    console.log(`Loaded AI vision text: ${text.length} characters`);
    return text;
}

function createAnalysisPrompt(questions: Question[], extractedText: string, allFeedback?: string, confirmedAnswers?: Record<string, string>): string {
    const questionsText = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n');
    
    let prompt = `You are an expert analyst specialized in reading complex narratives about time travel and character relationships. You will analyze a notebook containing diary entries from someone who appears to have traveled through time.

## CONTEXT: This notebook contains diary entries from Rafał, who seems to have traveled through time. The story involves characters like Adam, Azazel, Barbara, and Andrzej. Some pages mention specific dates, years, locations, and planned meetings.

## NOTEBOOK CONTENT:
${extractedText}

## QUESTIONS TO ANSWER:
${questionsText}`;
    
    // Add confirmed correct answers section
    if (confirmedAnswers && Object.keys(confirmedAnswers).length > 0) {
        prompt += `\n\n## CONFIRMED CORRECT ANSWERS:
The following answers have been confirmed as correct from previous attempts. USE THESE EXACT ANSWERS:
`;
        Object.entries(confirmedAnswers).forEach(([questionKey, answer]) => {
            prompt += `Question ${questionKey}: "${answer}"\n`;
        });
        prompt += `\n**IMPORTANT**: You MUST use these exact confirmed answers. Do not change them under any circumstances.`;
    }

    prompt += `

## ANALYSIS INSTRUCTIONS:
1. **Character Identification**: Pay attention to names mentioned: Rafał (main character), Adam, Azazel, Barbara, Andrzej
2. **Temporal References**: Look for specific years, dates, and time-related phrases like "przeniósł się w czasie", "cofnął się w czasie", or other event to conclude time
3. **Location References & Shelter (CRITICAL FOR Q3)**: 
   - Look for the word "schronienie" (shelter) and surrounding context
   - Find descriptions of places with specific geographical features
   - Look for any codes, abbreviations, or markers (like "FLG:", "Sigla", "Siglum")
   - Pay attention to descriptions of movements, patterns, or tracks that might form shapes
   - The answer might be a short code/abbreviation rather than a full place name
   - Previous attempts failed with: "las", "Sigla", "Siglum", "FLG", "pętla", "siglum"
4. **Meeting Plans**: Look for specific dates and arrangements for meetings
5. **Chronological Logic**: The story involves time travel, so dates and events may not be in linear order

## SPECIFIC SEARCH STRATEGIES:
- For year questions: Look for patterns like "roku XXXX", "w roku", or four-digit numbers
- For who suggested time travel: Look for mentions of who had the idea or convinced someone to travel through time
- For locations/shelter (Q3): Look for descriptions of places where Rafał found refuge. Pay special attention to:
  * The word "schronienie" (shelter) in the text
  * Descriptions of geographical features (las, skały, śnieg - forest, rocks, snow)
  * Any mysterious coordinates, markers, or sketches described in the text
  * Flag-like markers or abbreviations (like "FLG:" followed by content)
  * Patterns or movements that create visual marks (like tracks in snow)
  * The hint mentions "Sigla/Siglum" - look for abbreviations, codes, or short markers
- For dates: Look for specific calendar dates in format DD.MM.YYYY or similar
- For destinations: Look for mentions of where someone wants to go after meeting someone

## ANSWER REQUIREMENTS:
- Base answers ONLY on explicit information in the notebook
- If a date is asked for in YYYY-MM-DD format, convert Polish date notation accordingly
- For location questions asking for "short name", provide just the place name without additional description
- Pay attention to context - distinguish between past events, current situations, and future plans
- Use Polish language for answers since the source material is in Polish
- Answer could not be explicite in text. Try to analyze information and provide the most logical answer based on the context.

`;

    if (allFeedback) {
        prompt += `\n${allFeedback}\n`;
    }

    prompt += `
## FORMATTING:

Please provide your answers in the following format:

<thinking>
Let me analyze each question systematically:

1. [Question about year] - I need to look for mentions of time travel and destination year...
2. [Question about who suggested] - I need to find who convinced Rafał to travel in time...
3. [Question about shelter/schronienie] - CRITICAL: This is asking for a SHORT NAME of where Rafał found shelter.
   - Look for the word "schronienie" and its context
   - The API hint mentions "Sigla/Siglum" and describes, sketch, mysterious coordinates
   - Previous failed attempts: "las", "Sigla", "Siglum", "FLG", "pętla", "siglum"
   - Look for patterns made in snow, tracks, or movements that create shapes
   - Look for incomplete markers like "{{FLG: }}" that might need completion
   - The answer should be a short code or abbreviation, not a full description
   - Focus on any abbreviated location markers or coordinates in the text
4. [Question about meeting date] - I need to find the specific date mentioned for meeting with Andrzej...
5. [Question about destination] - I need to find where Rafał wants to go after the meeting...

[Detailed analysis of the text looking for each piece of information]
</thinking>

<answers>
{
  "1": "Answer to question 1",
  "2": "Answer to question 2",
  "3": "Answer to question 3",
  "4": "Answer to question 4",
  "5": "Answer to question 5"
}
</answers>

## CRITICAL FORMATTING REQUIREMENTS:
- Provide valid JSON only - no comments or extra text inside the JSON structure
- Use only straight quotes ("), not curved quotes (" ")
- Keep answers concise and factual
- Do not use nested quotes inside answer strings
- Think systematically through each question before providing answers

## SPECIAL ATTENTION FOR QUESTION 3 (SHELTER LOCATION):
The API feedback indicates this question needs a "short name" for where Rafał found shelter.
- Previous wrong answers: "las", "Sigla", "Siglum", "FLG", "pętla", "siglum"
- It's probably cave or shelter in the mountains, so look for words like "jaskinia", "schronisko", "grota", etc.
- Answer could be on page 16


## SPECIAL ATTENTION FOR QUESTION 4:
- Note that there is written: To już jutro.`;

    return prompt;
}

async function analyzeQuestionsWithLLM(
    questions: Question[], 
    extractedText: string, 
    allFeedback?: string,
    confirmedAnswers?: Record<string, string>
): Promise<Record<string, string>> {
    console.log(`Analyzing ${questions.length} questions with LLM...`);
    
    if (confirmedAnswers && Object.keys(confirmedAnswers).length > 0) {
        console.log(`✅ Using ${Object.keys(confirmedAnswers).length} confirmed correct answers:`);
        Object.entries(confirmedAnswers).forEach(([q, answer]) => {
            console.log(`  Q${q}: "${answer}"`);
        });
    }
    
    if (allFeedback) {
        console.log(`📝 Using comprehensive feedback from all previous attempts`);
    } else {
        console.log('ℹ️ No previous feedback available');
    }
    
    const prompt = createAnalysisPrompt(questions, extractedText, allFeedback, confirmedAnswers);
    const response = await openaiService.getChatResponse(prompt, 'gpt-4.1');
    
    try {
        const answersJson = extractFromTags(response, 'answers');
        // Clean the JSON to handle quote issues
        const cleanedJson = answersJson.replace(/"/g, '"').replace(/"/g, '"');
        const answers = JSON.parse(cleanedJson);
        
        // Convert answer keys to match API expectations (01, 02, etc.)
        const formattedAnswers: Record<string, string> = {};
        Object.entries(answers).forEach(([questionNum, answer]) => {
            const paddedKey = questionNum.padStart(2, '0');
            formattedAnswers[paddedKey] = answer as string;
        });
        
        // Override with confirmed answers if available
        if (confirmedAnswers) {
            Object.entries(confirmedAnswers).forEach(([questionKey, confirmedAnswer]) => {
                formattedAnswers[questionKey] = confirmedAnswer;
                console.log(`🔒 Locked in confirmed answer Q${questionKey}: "${confirmedAnswer}"`);
            });
        }
        
        console.log('LLM Analysis Results:');
        Object.entries(formattedAnswers).forEach(([questionNum, answer]) => {
            const isConfirmed = confirmedAnswers && confirmedAnswers[questionNum];
            console.log(`Q${questionNum}: ${answer} ${isConfirmed ? '✅ (confirmed)' : ''}`);
        });
        
        return formattedAnswers;
    } catch (error) {
        console.error('Error parsing LLM response:', error);
        console.log('Raw response:', response);
        throw new Error('Failed to parse LLM response');
    }
}

function saveAttemptHistory(history: AttemptHistory): void {
    const historyPath = path.join(__dirname, 'data', 'attempt-history.json');
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
    console.log(`Attempt history saved to: ${historyPath}`);
}

function loadAttemptHistory(): AttemptHistory {
    const historyPath = path.join(__dirname, 'data', 'attempt-history.json');
    
    if (fs.existsSync(historyPath)) {
        try {
            const data = fs.readFileSync(historyPath, 'utf8');
            const history = JSON.parse(data);
            console.log(`Loaded previous attempt history: ${history.attempts.length} attempts`);
            return history;
        } catch (error) {
            console.warn('Error loading attempt history, starting fresh:', error);
        }
    }
    
    return { attempts: [], totalAttempts: 0 };
}

function formatAllPreviousFeedback(history: AttemptHistory): string {
    if (history.attempts.length === 0) {
        return '';
    }

    const feedbackParts = ['## ALL PREVIOUS ATTEMPTS AND FEEDBACK:\n'];
    
    history.attempts.forEach((attempt, index) => {
        feedbackParts.push(`### ATTEMPT ${attempt.attempt} (${attempt.timestamp}):`);
        feedbackParts.push(`Status: ${attempt.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        // Make answers more prominent and detailed
        if (attempt.answers && Object.keys(attempt.answers).length > 0) {
            feedbackParts.push('\n**ANSWERS SUBMITTED:**');
            Object.entries(attempt.answers).forEach(([q, answer]) => {
                feedbackParts.push(`  Q${q}: "${answer}"`);
            });
            feedbackParts.push(''); // Empty line for readability
        } else {
            feedbackParts.push('\n**ANSWERS SUBMITTED:** None (attempt failed before generating answers)\n');
        }
        
        // Feedback section
        if (attempt.hints) {
            feedbackParts.push('**FEEDBACK RECEIVED:**');
            feedbackParts.push(attempt.hints);
            feedbackParts.push(''); // Empty line
        }
        
        // Additional response details
        if (attempt.response) {
            if (attempt.response.message && !attempt.hints?.includes(attempt.response.message)) {
                feedbackParts.push(`**SYSTEM MESSAGE:** ${attempt.response.message}`);
            }
            if (attempt.response.hint && !attempt.hints?.includes(attempt.response.hint)) {
                feedbackParts.push(`**SYSTEM HINT:** ${attempt.response.hint}`);
            }
            if (attempt.response.debug && !attempt.hints?.includes(attempt.response.debug)) {
                feedbackParts.push(`**DEBUG INFO:** ${attempt.response.debug}`);
            }
        }
        
        feedbackParts.push('---\n');
    });
    
    // Add analysis of patterns
    feedbackParts.push('## ANALYSIS OF PREVIOUS ATTEMPTS:');
    
    // Collect all answers for each question to show patterns
    const questionAnswers: Record<string, string[]> = {};
    history.attempts.forEach(attempt => {
        if (attempt.answers) {
            Object.entries(attempt.answers).forEach(([q, answer]) => {
                if (!questionAnswers[q]) {
                    questionAnswers[q] = [];
                }
                questionAnswers[q].push(`"${answer}" (Attempt ${attempt.attempt})`);
            });
        }
    });
    
    if (Object.keys(questionAnswers).length > 0) {
        feedbackParts.push('\n**PREVIOUSLY TRIED ANSWERS BY QUESTION:**');
        Object.entries(questionAnswers).forEach(([q, answers]) => {
            feedbackParts.push(`Q${q}: ${answers.join(', ')}`);
        });
        feedbackParts.push('');
    }
    
    feedbackParts.push('## CRITICAL INSTRUCTIONS BASED ON HISTORY:');
    feedbackParts.push('- Learn from ALL previous attempts and their specific feedback');
    feedbackParts.push('- Pay special attention to any hints about format, content, or specific requirements');
    feedbackParts.push('- If multiple attempts failed on the same question, try a completely different approach');
    feedbackParts.push('- Look for patterns in what went wrong and adjust your analysis accordingly');
    feedbackParts.push('- Focus on the feedback messages to understand what needs to be corrected');
    feedbackParts.push('- If feedback reveal mistake for example on third question, it means questions 1 and 2 were correct, so you can use them as a base for new attempt');
    feedbackParts.push('- Analyse all previous attempts and their feedback to avoid repeating mistakes');
    feedbackParts.push('- Use correct answers from previous attempts as a base for new attempt');
    
    return feedbackParts.join('\n');
}

async function submitAnswersWithRetry(
    taskName: string,
    questions: Question[],
    extractedText: string,
    maxAttempts: number = 1
): Promise<any> {
    // Load existing attempt history
    let history = loadAttemptHistory();
    const startingAttempt = history.totalAttempts + 1;
    const maxAttemptNumber = startingAttempt + maxAttempts - 1;
    let currentAttempt = startingAttempt;
    
    console.log(`Starting from attempt ${currentAttempt} (${history.attempts.length} previous attempts found)`);
    console.log(`Will try up to ${maxAttempts} new attempts (attempt ${startingAttempt} to ${maxAttemptNumber})`);
    
    while (currentAttempt <= maxAttemptNumber) {
        console.log(`\n=== ATTEMPT ${currentAttempt} ===`);
        
        // Extract confirmed correct answers from history
        const confirmedAnswers = extractConfirmedCorrectAnswers(history);
        
        if (Object.keys(confirmedAnswers).length > 0) {
            console.log(`🔐 Found ${Object.keys(confirmedAnswers).length} confirmed correct answers to preserve`);
            
            // Update history with confirmed answers
            history.confirmedCorrectAnswers = confirmedAnswers;
            saveAttemptHistory(history);
        }
        
        // Generate comprehensive feedback from all previous attempts
        const allFeedback = formatAllPreviousFeedback(history);
        
        // Get answers from LLM with comprehensive feedback and confirmed answers
        let answers: Record<string, string> = {};
        
        try {
            answers = await analyzeQuestionsWithLLM(questions, extractedText, allFeedback, confirmedAnswers);
        } catch (llmError: any) {
            console.error(`Error generating answers for attempt ${currentAttempt}:`, llmError);
            
            // Create attempt record for LLM generation failure
            const llmErrorAttempt: AnswerAttempt = {
                answers: {},
                attempt: currentAttempt,
                timestamp: new Date().toISOString(),
                success: false,
                hints: `Error generating answers: ${llmError.message || 'Unknown error'}`
            };
            
            history.attempts.push(llmErrorAttempt);
            history.totalAttempts = currentAttempt;
            saveAttemptHistory(history);
            
            // Check if we should continue
            if (currentAttempt >= maxAttemptNumber) {
                console.log(`❌ Maximum attempts (${maxAttempts}) reached after LLM error.`);
                throw llmError;
            }
            
            currentAttempt++;
            continue;
        }
        
        // Create attempt record with answers
        const attemptRecord: AnswerAttempt = {
            answers,
            attempt: currentAttempt,
            timestamp: new Date().toISOString(),
            success: false
        };
        
        try {
            // Submit answers
            console.log('Submitting answers to AI_devs...');
            const response = await sendReport(taskName, answers);
            
            // Update attempt record with response
            attemptRecord.response = response;
            
            // Check if successful
            if (response.code === 0 || response.message?.includes('correct') || response.message?.includes('success')) {
                console.log('✅ Answers accepted!');
                attemptRecord.success = true;
                
                // Save successful attempt
                history.attempts.push(attemptRecord);
                history.totalAttempts = currentAttempt;
                saveAttemptHistory(history);
                
                return response;
            }
            
            // If failed, collect feedback
            console.log(`❌ Attempt ${currentAttempt} failed.`);
            
            const feedbackParts = [];
            if (response.message) {
                feedbackParts.push(`Message: ${response.message}`);
            }
            if (response.hint) {
                feedbackParts.push(`Hint: ${response.hint}`);
            }
            if (response.debug) {
                feedbackParts.push(`Debug: ${response.debug}`);
            }
            
            if (feedbackParts.length > 0) {
                attemptRecord.hints = feedbackParts.join('\n');
                console.log(`Feedback received:\n${attemptRecord.hints}`);
            } else {
                attemptRecord.hints = "No specific feedback provided. Please review the notebook content more carefully.";
                console.log('No specific feedback provided.');
            }
            
            // Save failed attempt to history
            history.attempts.push(attemptRecord);
            history.totalAttempts = currentAttempt;
            saveAttemptHistory(history);
            
            // Update confirmed answers from this attempt before next iteration
            const newConfirmedAnswers = extractConfirmedCorrectAnswers(history);
            if (Object.keys(newConfirmedAnswers).length > Object.keys(confirmedAnswers).length) {
                console.log(`🎯 Discovered new confirmed correct answers from this failure!`);
                history.confirmedCorrectAnswers = newConfirmedAnswers;
                saveAttemptHistory(history);
            }
            
            // Check if we should continue
            if (currentAttempt >= maxAttemptNumber) {
                console.log(`❌ Maximum attempts (${maxAttempts}) reached.`);
                return response;
            }
            
            currentAttempt++;
            continue;
            
        } catch (error: any) {
            console.error(`Error submitting answers for attempt ${currentAttempt}:`, error);
            
            // Update the attempt record with submission error (answers are already preserved)
            attemptRecord.hints = `Submission error: ${error.message || 'Unknown error'}`;
            
            // Try to extract feedback from error response
            if (error?.data) {
                const errorData = error.data;
                console.log('🔍 Extracting feedback from error response...');
                
                const feedbackParts = [`Submission error: ${error.message || 'Unknown error'}`];
                if (errorData.message) {
                    feedbackParts.push(`Message: ${errorData.message}`);
                }
                if (errorData.hint) {
                    feedbackParts.push(`Hint: ${errorData.hint}`);
                }
                if (errorData.debug) {
                    feedbackParts.push(`Debug: ${errorData.debug}`);
                }
                
                attemptRecord.hints = feedbackParts.join('\n');
                attemptRecord.response = errorData;
                console.log(`✅ Feedback extracted:\n${attemptRecord.hints}`);
            }
            
            // Save submission error attempt (answers were preserved)
            history.attempts.push(attemptRecord);
            history.totalAttempts = currentAttempt;
            saveAttemptHistory(history);
            
            // Update confirmed answers from this attempt before next iteration
            const newConfirmedAnswers = extractConfirmedCorrectAnswers(history);
            if (Object.keys(newConfirmedAnswers).length > Object.keys(confirmedAnswers).length) {
                console.log(`🎯 Discovered new confirmed correct answers from this error!`);
                history.confirmedCorrectAnswers = newConfirmedAnswers;
                saveAttemptHistory(history);
            }
            
            // Check if we should continue
            if (currentAttempt >= maxAttemptNumber) {
                console.log(`❌ Maximum attempts (${maxAttempts}) reached after submission error.`);
                throw error;
            }
            
            currentAttempt++;
            continue;
        }
    }
    
    throw new Error('Unexpected end of retry loop');
}

async function executeQuestionAnswering(): Promise<void> {
    console.log('Starting Question Answering System...');
    
    try {
        // Load questions and extracted text
        const questions = await fetchQuestions();
        const extractedText = loadExtractedText();
        
        // Save questions for reference
        const questionsPath = path.join(__dirname, 'data', 'questions.json');
        fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2), 'utf8');
        console.log(`Questions saved to: ${questionsPath}`);
        
        console.log('\n=== QUESTIONS TO ANSWER ===');
        questions.forEach((q, i) => {
            console.log(`${i + 1}. ${q.question}`);
        });
        
        // Submit answers with retry logic
        const result = await submitAnswersWithRetry('notes', questions, extractedText, 3);
        
        console.log('\n=== FINAL RESULT ===');
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('Error in question answering system:', error);
        throw error;
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    executeQuestionAnswering().then(() => {
        console.log('\n🎉 Question Answering System completed!');
    }).catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
}

export { 
    executeQuestionAnswering, 
    fetchQuestions, 
    analyzeQuestionsWithLLM, 
    loadAttemptHistory, 
    saveAttemptHistory, 
    formatAllPreviousFeedback,
    addManualAttemptToHistory,
    clearAttemptHistory,
    showAttemptHistory,
    parseIncorrectQuestion,
    extractConfirmedCorrectAnswers
};

// Function to manually add previous attempts if you have them
function addManualAttemptToHistory(
    attemptNumber: number,
    answers: Record<string, string>,
    feedback: string,
    success: boolean = false,
    response?: any
): void {
    const history = loadAttemptHistory();
    
    const manualAttempt: AnswerAttempt = {
        answers,
        attempt: attemptNumber,
        hints: feedback,
        response,
        timestamp: new Date().toISOString(),
        success
    };
    
    // Check if attempt already exists and replace it
    const existingIndex = history.attempts.findIndex(a => a.attempt === attemptNumber);
    if (existingIndex >= 0) {
        history.attempts[existingIndex] = manualAttempt;
        console.log(`Updated existing attempt ${attemptNumber} in history`);
    } else {
        history.attempts.push(manualAttempt);
        console.log(`Added new attempt ${attemptNumber} to history`);
    }
    
    // Sort attempts by attempt number
    history.attempts.sort((a, b) => a.attempt - b.attempt);
    
    // Update total attempts count
    history.totalAttempts = Math.max(history.totalAttempts, attemptNumber);
    
    saveAttemptHistory(history);
}

// Function to clear all attempt history (use with caution)
function clearAttemptHistory(): void {
    const emptyHistory: AttemptHistory = { attempts: [], totalAttempts: 0 };
    saveAttemptHistory(emptyHistory);
    console.log('🗑️ Attempt history cleared');
}

// Function to show current attempt history
function showAttemptHistory(): void {
    const history = loadAttemptHistory();
    
    if (history.attempts.length === 0) {
        console.log('📝 No previous attempts found');
        return;
    }
    
    console.log(`📚 Attempt History (${history.attempts.length} attempts):`);
    console.log('='.repeat(50));
    
    history.attempts.forEach((attempt, index) => {
        console.log(`\n${index + 1}. ATTEMPT ${attempt.attempt} (${attempt.timestamp})`);
        console.log(`   Status: ${attempt.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        if (Object.keys(attempt.answers).length > 0) {
            console.log('   Answers:');
            Object.entries(attempt.answers).forEach(([q, answer]) => {
                console.log(`     Q${q}: ${answer}`);
            });
        }
        
        if (attempt.hints) {
            console.log(`   Feedback: ${attempt.hints}`);
        }
    });
    
    console.log('\n' + '='.repeat(50));
    
    // Show confirmed correct answers
    const confirmedAnswers = extractConfirmedCorrectAnswers(history);
    if (Object.keys(confirmedAnswers).length > 0) {
        console.log('\n🔐 CONFIRMED CORRECT ANSWERS:');
        Object.entries(confirmedAnswers).forEach(([q, answer]) => {
            console.log(`  Q${q}: "${answer}"`);
        });
    }
    
    // Show formatted feedback that would be sent to LLM
    const formattedFeedback = formatAllPreviousFeedback(history);
    if (formattedFeedback) {
        console.log('\n📝 Formatted feedback for LLM:');
        console.log(formattedFeedback);
    }
}
