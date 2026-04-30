/**
 * Planning prompt templates and logic for autonomous reasoning
 */

export interface PlanningPromptConfig {
    taskDescription: string;
    availableTools: string[];
    currentContext: Record<string, any>;
    previousSteps?: string[];
    objectives?: string[];
}

/**
 * Generate planning prompt for ReAct reasoning
 */
export function createPlanningPrompt(config: PlanningPromptConfig): string {
    const {
        taskDescription,
        availableTools,
        currentContext,
        previousSteps = [],
        objectives = []
    } = config;

    return `You are an autonomous AI agent working on a complex task. Use the ReAct pattern (Reasoning + Action + Observation) to plan your next action.

## Task Description
${taskDescription}

## Current Context
${Object.entries(currentContext)
    .map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
    .join('\n')}

## Available Tools
${availableTools.map(tool => `- ${tool}`).join('\n')}

## Tool Input Guidelines
- text_analyzer: Use {"text": "your text here"}
- calculator: Use {"operation": "add|subtract|multiply|divide", "a": number, "b": number}
  * For multi-step calculations, break them down into sequential single operations
  * Example: "15 + 23, then multiply by 2" → First: {"operation": "add", "a": 15, "b": 23}, then use result in next step
- For other tools: Follow the tool's schema requirements

${objectives.length > 0 ? `## Objectives
${objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}` : ''}

${previousSteps.length > 0 ? `## Previous Steps
${previousSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}` : ''}

## Instructions
Analyze the current situation and determine the next action. Follow this format:

<thinking>
Consider:
1. What has been accomplished so far?
2. What is the immediate next goal?
3. Which tool would be most appropriate?
4. What input should be provided to the tool?
5. How does this action advance toward the overall objective?
</thinking>

<action>
Tool to use: [tool_name]
Reasoning: [why this tool and action]
Input: [JSON object with proper structure for the tool - see Tool Input Guidelines above]
</action>

<reflection_needed>
[yes/no - should we reflect after this action?]
</reflection_needed>

Focus on making incremental progress toward the goal. Be specific about tool inputs and expected outcomes.`;
}

/**
 * Generate prompt for determining if task is complete
 */
export function createCompletionCheckPrompt(
    taskDescription: string,
    objectives: string[],
    currentResults: Record<string, any>
): string {
    return `Evaluate whether the task has been completed successfully.

## Task Description
${taskDescription}

## Objectives
${objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

## Current Results
${Object.entries(currentResults)
    .map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
    .join('\n')}

## Instructions
Analyze the current results against the objectives and determine completion status.

<evaluation>
For each objective, assess:
1. Is this objective fully completed?
2. What evidence supports completion?
3. Are there any gaps or missing elements?
</evaluation>

<completion_status>
Status: [COMPLETE/INCOMPLETE]
Completion percentage: [0-100]%
Missing elements: [list any incomplete objectives]
</completion_status>

<next_action>
If incomplete: [what should be done next]
If complete: [final validation steps, if any]
</next_action>`;
}

/**
 * Generate prompt for error recovery planning
 */
export function createErrorRecoveryPrompt(
    error: string,
    context: Record<string, any>,
    availableTools: string[],
    attemptCount: number
): string {
    return `An error occurred during task execution. Plan a recovery strategy.

## Error Details
${error}

## Current Context
${Object.entries(context)
    .map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
    .join('\n')}

## Available Tools
${availableTools.map(tool => `- ${tool}`).join('\n')}

## Attempt Count
This is attempt #${attemptCount}

## Instructions
Analyze the error and plan a recovery approach.

<error_analysis>
1. What caused this error?
2. Is this a temporary or permanent issue?
3. Can we work around this problem?
4. Should we try a different approach?
</error_analysis>

<recovery_plan>
Strategy: [describe the recovery approach]
Alternative_tool: [if applicable]
Modified_input: [if trying the same tool with different input]
Fallback_option: [if the preferred approach fails]
</recovery_plan>

<should_retry>
[yes/no - should we attempt recovery or abort?]
</should_retry>`;
}
