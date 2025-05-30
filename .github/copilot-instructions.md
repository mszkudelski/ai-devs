# AI_devs Tasks Project - GitHub Copilot Instructions

## Project Overview
This is the AI_devs tasks project containing solutions for AI development challenges. The project follows specific patterns and best practices for modularity, reusability, and maintainability.

## Running Tasks

### How to Execute Tasks
The project uses npm scripts with directory parameters to run individual tasks:

```bash
# Run a specific task (replace s03e04 with your task directory)
npm run start --dir=s03e04

# Run in development mode with file watching
npm run dev --dir=s03e04

# Run from the project root directory
cd /Users/marek.szkudelski/cursor/ai-devs-tasks
npm run start --dir=s03e04
```

### Task Structure
- Each task is in its own directory under `/tasks/` (e.g., `/tasks/s03e04/`)
- Each task directory contains an `index.ts` file as the main entry point
- Tasks can have additional files like `data/` subdirectories for task-specific data
- The npm script uses tsx (TypeScript executor) to run tasks directly without compilation

### Development Workflow
1. Create/edit task in `/tasks/[season]e[episode]/index.ts`
2. Test with `npm run dev --dir=[season]e[episode]` for auto-reload
3. Run final version with `npm run start --dir=[season]e[episode]`
4. Use TypeScript for type safety - the project supports ES modules with NodeNext resolution

## Core Architecture & Best Practices

### 1. Use Shared Services and Utilities from `/src`

**ALWAYS check `/src` folder first for existing services and utilities before creating new ones:**

- **`OpenAIService`** (`/src/openai.service.ts`) - Use for all OpenAI API interactions
- **`sendReport`** (`/src/report.ts`) - Use for submitting task answers to AI_devs API
- **URL utilities** (`/src/url.ts`) - Use `getCentralUrl()`, `getReportUrl()` for API endpoints
- **API utilities** (`/src/api.ts`) - Use `postRequest()` for HTTP requests
- **Common utilities** (`/src/utils.ts`) - Use `extractFromTags()` for parsing LLM responses
- **Langfuse integration** (`/src/langfuse.ts`) - For observability and tracking

### 2. Task Structure Patterns

Each task should follow this structure:
```typescript
import { getCentralUrl } from "../../src/url.js";
import { postRequest } from "../../src/api.js"; 
import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
import { extractFromTags } from "../../src/utils.js";

const openaiService = new OpenAIService();

// Main execution function
async function executeTask() {
    // Task logic here
    const result = await processData();
    
    // Submit answer using sendReport
    await sendReport('task-name', result);
    
    return result;
}

executeTask();
```

### 3. Prompt Engineering Patterns

**Extract prompts to dedicated functions:**
```typescript
function createAnalysisPrompt(data: string): string {
    return `Analyze the following data and provide insights.

Data:
${data}

Please use <thinking> tags for analysis, then provide results in <result> tags.

<thinking>
[Your analysis process]
</thinking>

<result>
[Your final answer]
</result>`;
}
```

**Use consistent tag-based response parsing:**
```typescript
const response = await openaiService.getChatResponse(prompt);
const result = extractFromTags(response, 'result');
```

### 4. Logging Guidelines

**Keep crucial logs for debugging:**
- Task start/completion
- API calls and responses (when debugging)
- Data extraction results
- Error states
- Final results before submission

**Remove verbose/decorative logs:**
- Excessive console formatting
- Step-by-step progress indicators
- Redundant status messages

### 5. Error Handling

**Use proper error handling patterns:**
```typescript
try {
    const result = JSON.parse(extractedData);
    return result;
} catch (parseError) {
    console.error('Error parsing data:', parseError);
    console.log('Raw content:', extractedData);
    return fallbackValue;
}
```

### 6. Code Organization

**Keep functions focused and reusable:**
- Extract utility functions to `/src/utils.ts` when reusable across tasks
- Keep task-specific logic in the task file
- Use TypeScript interfaces for data structures
- Prefer async/await over promises

**Function naming conventions:**
- `execute[TaskName]()` for main execution
- `create[Purpose]Prompt()` for prompt generation
- `extract[DataType]()` for data extraction
- `query[Source]()` for external API calls

### 7. Dependencies and Imports

**Import order:**
1. External libraries
2. Shared services from `/src`
3. Local utilities
4. Type definitions

**Always use relative imports with `.js` extension for internal modules:**
```typescript
import { OpenAIService } from "../../src/openai.service.js";
import { sendReport } from "../../src/report.js";
```

### 8. Data Processing Patterns

**For database queries:**
```typescript
async function queryDatabase(query: string): Promise<DatabaseResponse> {
    const requestBody = {
        task: "database",
        apikey: process.env.AI_DEVS_API_KEY!,
        query
    };
    return await postRequest<DatabaseRequest, DatabaseResponse>(dbUrl, requestBody);
}
```

**For LLM-assisted data extraction:**
```typescript
async function extractWithLLM(data: any): Promise<ExtractedType> {
    const prompt = createExtractionPrompt(data);
    const response = await openaiService.getChatResponse(prompt);
    const extracted = extractFromTags(response, 'result');
    
    try {
        return JSON.parse(extracted);
    } catch (error) {
        console.error('Extraction failed:', error);
        return fallbackValue;
    }
}
```

### 9. Service Integration

**When working with external services:**
- Check if a service wrapper exists in `/src/services/`
- Use dependency injection for services
- Initialize services in constructor or module scope
- Handle authentication and configuration properly

### 10. Testing and Validation

**Include validation steps:**
- Validate API responses
- Check required environment variables
- Test data parsing before submission
- Log intermediate results for debugging

## Common Patterns to Follow

1. **Single Responsibility**: Each function should have one clear purpose
2. **Reusability**: Extract common functionality to `/src` utilities
3. **Consistency**: Follow established naming and structure patterns
4. **Error Resilience**: Handle errors gracefully with meaningful messages
5. **Observability**: Include necessary logging for debugging
6. **Type Safety**: Use TypeScript interfaces and proper typing

## Anti-Patterns to Avoid

1. **Code Duplication**: Don't recreate existing utilities
2. **Verbose Logging**: Avoid excessive console decoration
3. **Hardcoded Values**: Use environment variables and constants
4. **Monolithic Functions**: Break down complex logic into smaller functions
5. **Manual API Calls**: Use existing API utilities instead of raw fetch/axios
6. **Missing Error Handling**: Always handle potential failure cases

## Environment Setup

Ensure these environment variables are configured:
- `OPENAI_API_KEY` - For OpenAI service
- `AI_DEVS_API_KEY` - For task submission
- Task-specific API keys as needed

## File Organization

```
/src/              # Shared utilities and services
  api.ts           # HTTP request utilities
  openai.service.ts # OpenAI integration
  report.ts        # Task submission
  url.ts           # URL generation
  utils.ts         # Common utilities
  langfuse.ts      # Observability
/tasks/            # Individual task solutions
  s[season]e[episode]/
    index.ts       # Main task file
    data/          # Task-specific data files
```

Follow these guidelines to maintain consistency and leverage the project's established patterns effectively.
