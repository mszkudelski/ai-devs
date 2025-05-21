import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { getChatResponse } from '../../src/legacy/response.js';
import { reportUrl } from '../../src/url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const answerUrl = reportUrl;

interface TestCase {
    question: string;
    answer: number;
    test?: {
        q: string;
        a: string;
    };
}

interface TestResult {
    question: string;
    expected: number;
    calculated: number;
    isCorrect: boolean;
}

// Function to evaluate mathematical expressions
function evaluateExpression(expression: string): number {
    // Remove any whitespace and ensure safe evaluation
    const sanitizedExp = expression.replace(/\s+/g, '');
    // Using Function constructor to safely evaluate the expression
    return Function(`'use strict'; return (${sanitizedExp})`)();
}

// Read and parse the JSON file
const jsonPath = path.join(__dirname, 'data.json');
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Process all test cases
const results = jsonData['test-data'].map(async (test: TestCase, index: number) => {
    const calculatedAnswer = evaluateExpression(test.question);
    const isCorrect = calculatedAnswer === test.answer;
    
    if(!isCorrect) {    
        console.log(`Test ${index + 1}:`);
        console.log(`Question: ${test.question}`);
        console.log(`Expected: ${test.answer}`);
        console.log(`Calculated: ${calculatedAnswer}`);
        console.log(`Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}\n`);
    }

    if(test.test) {
        console.log('Sending question to AI:', test.test.q);
        const aiResponse = await getChatResponse(test.test.q + ' . your response should be only the answer. ');
        test.test.a = aiResponse;
    }

    return {
       ...test,
       answer: calculatedAnswer
    };
});

// Check if all answers are correct after resolving promises
Promise.all(results).then((resolvedResults) => {
    const allCorrect = resolvedResults.every((result: TestResult) => result.isCorrect);
    console.log(`All answers correct: ${allCorrect}`);

    // Save results to data_result.json
    const resultData = {
        ...jsonData,
        'test-data': resolvedResults
    };
    fs.writeFileSync(
        path.join(__dirname, 'data_result.json'),
        JSON.stringify(resultData, null, 2)
    );
    console.log('Results saved to data_result.json');
});

