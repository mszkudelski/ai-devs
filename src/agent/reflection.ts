/**
 * Reflection logic and prompt templates for evaluating agent performance
 */

export interface ReflectionConfig {
    lastAction: string;
    actionResult: any;
    currentObjectives: string[];
    completedSteps: string[];
    overallProgress: Record<string, any>;
}

/**
 * Generate reflection prompt for evaluating recent actions
 */
export function createReflectionPrompt(config: ReflectionConfig): string {
    const {
        lastAction,
        actionResult,
        currentObjectives,
        completedSteps,
        overallProgress
    } = config;

    return `Reflect on the recent action and evaluate progress toward objectives.

## Last Action Taken
${lastAction}

## Action Result
${typeof actionResult === 'object' ? JSON.stringify(actionResult, null, 2) : actionResult}

## Current Objectives
${currentObjectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

## Completed Steps
${completedSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Overall Progress
${Object.entries(overallProgress)
    .map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
    .join('\n')}

## Instructions
Analyze the effectiveness of the recent action and determine next steps.

<action_evaluation>
1. Was the action successful? [yes/no]
2. Did it advance toward the objectives? [yes/no]
3. What was learned from this action?
4. Were there any unexpected outcomes?
5. How does this fit into the overall strategy?
</action_evaluation>

<progress_assessment>
1. Which objectives have been completed?
2. Which objectives are in progress?
3. Which objectives haven't been started?
4. What is the estimated completion percentage?
</progress_assessment>

<insights>
Key learnings:
- [insight 1]
- [insight 2]
- [insight 3]
</insights>

<next_steps>
Recommended actions:
1. [next action 1]
2. [next action 2]
3. [next action 3]
</next_steps>

<should_continue>
[yes/no - should the agent continue with the current approach?]
</should_continue>

<adjustments>
Strategy adjustments needed: [any changes to approach]
Priority changes: [any reordering of objectives]
Resource requirements: [any additional tools or data needed]
</adjustments>`;
}

/**
 * Generate prompt for quality assessment of results
 */
export function createQualityAssessmentPrompt(
    results: Record<string, any>,
    qualityCriteria: string[],
    expectedFormat?: string
): string {
    return `Assess the quality of the generated results against established criteria.

## Results to Evaluate
${Object.entries(results)
    .map(([key, value]) => `### ${key}\n${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
    .join('\n\n')}

## Quality Criteria
${qualityCriteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

${expectedFormat ? `## Expected Format
${expectedFormat}` : ''}

## Instructions
Evaluate each result against the quality criteria.

<quality_evaluation>
${qualityCriteria.map(criteria => `
### ${criteria}
- Score: [1-10]
- Assessment: [detailed evaluation]
- Issues: [any problems identified]
- Suggestions: [improvements needed]
`).join('')}
</quality_evaluation>

<overall_quality>
Overall Score: [1-10]
Meets Requirements: [yes/no]
Ready for Submission: [yes/no]
</overall_quality>

<improvements_needed>
Critical Issues: [must-fix problems]
Minor Issues: [nice-to-have improvements]
Validation Required: [areas needing verification]
</improvements_needed>

<approval_status>
[APPROVED/NEEDS_REVISION/REJECTED]
</approval_status>`;
}

/**
 * Generate prompt for strategy adjustment based on feedback
 */
export function createStrategyAdjustmentPrompt(
    currentStrategy: string,
    feedback: string,
    constraints: string[],
    availableAlternatives: string[]
): string {
    return `Adjust the current strategy based on received feedback.

## Current Strategy
${currentStrategy}

## Feedback Received
${feedback}

## Constraints
${constraints.map((constraint, i) => `${i + 1}. ${constraint}`).join('\n')}

## Available Alternatives
${availableAlternatives.map((alt, i) => `${i + 1}. ${alt}`).join('\n')}

## Instructions
Analyze the feedback and adjust the strategy accordingly.

<feedback_analysis>
1. What aspects of the current strategy are working?
2. What aspects need improvement?
3. Are the issues fundamental or tactical?
4. Can the current approach be modified or should it be replaced?
</feedback_analysis>

<strategy_options>
Option 1: [modify current approach]
- Changes needed: [specific modifications]
- Advantages: [benefits of this approach]
- Risks: [potential downsides]

Option 2: [alternative approach]
- New strategy: [describe alternative]
- Advantages: [benefits of this approach]
- Risks: [potential downsides]

Option 3: [hybrid approach]
- Combined strategy: [mix of current and alternative]
- Advantages: [benefits of this approach]
- Risks: [potential downsides]
</strategy_options>

<recommendation>
Recommended Strategy: [which option to pursue]
Reasoning: [why this option is best]
Implementation: [how to implement the changes]
Success Metrics: [how to measure improvement]
</recommendation>`;
}
