# Multi-Tool Agent Example

This example demonstrates how to create an agent that coordinates multiple tools to complete complex tasks requiring different types of analysis.

## Overview

The `MultiToolAgent` showcases an autonomous agent that can:

- **Analyze text content** for sentiment, readability, and key insights
- **Perform mathematical calculations** and data processing
- **Extract and process numerical data** from mixed content
- **Coordinate multiple tools** intelligently based on task requirements
- **Generate comprehensive reports** combining all findings

## Available Tools

The agent has access to three specialized tools:

1. **TextAnalyzerTool** - Analyzes text for word count, sentiment, readability metrics
2. **CalculatorTool** - Performs basic mathematical operations (add, subtract, multiply, divide)
3. **DataProcessorTool** - Processes arrays of data to calculate statistics (average, max, count)

## Key Features

### 🔧 **Automatic Tool Selection**
The agent automatically determines which tools to use based on the content and requirements of the task.

### 🧠 **Intelligent Coordination** 
Tools are used in logical sequences - for example, extracting numbers from text, then calculating statistics, then analyzing sentiment.

### 📊 **Comprehensive Analysis**
Each task produces detailed results combining insights from all relevant tools.

### 🔄 **State Management**
The agent maintains context between tool calls and can build upon previous results.

## Example Use Cases

### 1. Business Report Analysis
```typescript
const result = await agent.analyzeDocument(`
    This excellent quarterly report shows outstanding performance.
    Sales increased by 25%, customer satisfaction rating of 4.8/5.0.
    Calculate total revenue if we processed 1,250 orders at $45 each.
`);
```

**Tools Used**: TextAnalyzer → Calculator → DataProcessor
**Output**: Sentiment analysis + revenue calculation + performance metrics

### 2. Survey Data Processing
```typescript
const surveyData = [
    { text: "Amazing product! Love it!", rating: 5 },
    { text: "Good quality, satisfied.", rating: 4 },
    { text: "Disappointed with service.", rating: 2 }
];
const result = await agent.processSurveyData(surveyData);
```

**Tools Used**: TextAnalyzer → DataProcessor
**Output**: Sentiment trends + rating statistics + insights

### 3. Financial Analysis
```typescript
const result = await agent.analyzeFinancialReport(
    "Excellent growth with outstanding performance...",
    [12000, 15000, 11000], // expenses
    [25000, 28000, 24000]  // revenue
);
```

**Tools Used**: TextAnalyzer → DataProcessor → Calculator
**Output**: Report sentiment + profit calculations + trend analysis

## Running the Example

### Option 1: Run the complete task
```bash
cd /Users/marek.szkudelski/cursor/ai-devs-tasks
npm run start --dir=multi-tool-example
```

### Option 2: Run individual demos
```bash
cd src/agent/examples
tsx multi-tool-demo.ts
```

### Option 3: Use in your own code
```typescript
import { createMultiToolAgent } from './src/agent/examples/multi-tool-example.js';

const agent = createMultiToolAgent({
    maxSteps: 10,
    enableReflection: true
});

const result = await agent.analyzeDocument("Your content here...");
```

## What Makes This Example Special

### 🎯 **Real-World Applicability**
This pattern is common in business applications where you need to process documents containing both text insights and numerical data.

### 🔧 **Tool Coordination**
Demonstrates how an agent can intelligently sequence tool usage - extracting data first, then analyzing it, then performing calculations.

### 📈 **Scalable Pattern**
The framework makes it easy to add new tools and the agent will automatically learn to use them appropriately.

### 🧠 **Autonomous Decision Making**
The agent decides which tools to use and in what order based on the task requirements, not pre-programmed sequences.

## Learning Outcomes

After studying this example, you'll understand:

- How to create agents that coordinate multiple specialized tools
- How tools can build upon each other's results
- How to design tools with clear, focused responsibilities
- How agents can make intelligent decisions about tool usage
- How to structure complex analysis tasks for autonomous execution

## Next Steps

Try modifying the example by:

1. **Adding new tools** (e.g., web scraper, database connector)
2. **Creating new analysis types** (e.g., social media analysis, scientific data processing)
3. **Experimenting with different prompts** to see how the agent adapts its tool usage
4. **Building domain-specific agents** using this pattern for your use cases

This multi-tool pattern is the foundation for building sophisticated autonomous agents that can handle complex, real-world tasks requiring diverse capabilities.
