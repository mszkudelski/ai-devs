import { getCentralUrl } from "../../src/url.js";
import { postRequest } from "../../src/api.js";
import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import { extractFromTags } from "../../src/utils.js";

const dbUrl = getCentralUrl('apidb');
const openaiService = new OpenAIService();

interface DatabaseRequest {
    task: string;
    apikey: string;
    query: string;
}

interface DatabaseResponse {
    reply: any[];
    error?: string;
}

async function queryDatabase(query: string): Promise<DatabaseResponse> {
    const requestBody: DatabaseRequest = {
        task: "database",
        apikey: process.env.AI_DEVS_API_KEY!,
        query
    };

    return await postRequest<DatabaseRequest, DatabaseResponse>(dbUrl, requestBody);
}

async function exploreDatabase() {
    console.log('Exploring database schema...');
    const tablesResponse = await queryDatabase("SHOW TABLES");
    const tables = tablesResponse.reply.map((row: any) => row.Tables_in_banan);
    console.log('Found tables:', tables);
    
    let schemaInfo = '';
    for (const tableName of tables) {
        const schemaResponse = await queryDatabase(`SHOW CREATE TABLE ${tableName}`);
        schemaInfo += `Table: ${tableName}\n${JSON.stringify(schemaResponse.reply, null, 2)}\n\n`;
    }
    
    return { tables, schemaInfo };
}

function createSQLGenerationPrompt(schemaInfo: string): string {
    return `Based on the following database schema information, create a SQL query to get IDs of active datacenters with managers who are on leave.

Database Schema:
${schemaInfo}

Requirements:
- Find datacenters that are active
- These datacenters should have managers who are currently on leave
- Return only the datacenter IDs

Please use <thinking> tags to analyze the schema and plan your approach, then provide the SQL query in <result> tags.

<thinking>
[Your analysis of the schema and approach]
</thinking>

<result>
[The SQL query only]
</result>`;
}

function createExtractionPrompt(dbResponse: DatabaseResponse): string {
    return `Based on the following database response, extract the datacenter IDs and return them as a JSON array.

Database Response:
${JSON.stringify(dbResponse, null, 2)}

Please analyze the response data and extract only the datacenter IDs. Return them as a simple JSON array of numbers.

Use <thinking> tags to analyze the response structure, then provide the JSON array in <result> tags.

<thinking>
[Your analysis of the response structure and extraction approach]
</thinking>

<result>
[JSON array of datacenter IDs only, e.g., [1, 2, 3]]
</result>`;
}

async function generateSQLWithLLM(schemaInfo: string): Promise<string> {
    console.log('Generating SQL query...');
    const prompt = createSQLGenerationPrompt(schemaInfo);
    const response = await openaiService.getChatResponse(prompt);
    const sqlQuery = extractFromTags(response, 'result');
    console.log('Generated SQL:', sqlQuery);
    return sqlQuery;
}

async function extractDatacenterIds(dbResponse: DatabaseResponse): Promise<number[]> {
    console.log('Extracting datacenter IDs...');
    const prompt = createExtractionPrompt(dbResponse);
    const response = await openaiService.getChatResponse(prompt);
    const extractedIds = extractFromTags(response, 'result');
    
    try {
        const idsArray = JSON.parse(extractedIds);
        console.log('Extracted IDs:', idsArray);
        return idsArray;
    } catch (parseError) {
        console.error('Error parsing extracted IDs:', parseError);
        console.log('Raw extracted content:', extractedIds);
        return [];
    }
}

async function executeGeneratedQuery() {
    const { schemaInfo } = await exploreDatabase();
    const sqlQuery = await generateSQLWithLLM(schemaInfo);
    
    console.log('Executing SQL query...');
    const result = await queryDatabase(sqlQuery);
    const datacenterIds = await extractDatacenterIds(result);
    
    console.log('Final datacenter IDs:', datacenterIds);
    console.log('Submitting report...');
    await sendReport('database', datacenterIds);
    
    return { queryResult: result, datacenterIds };
}

executeGeneratedQuery();
