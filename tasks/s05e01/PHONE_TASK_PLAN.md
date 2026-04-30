# Phone Task Implementation Plan (S05E01)

## Task Overview
**Task Name**: `phone`
**Complexity**: Multi-step agent task with conversation reconstruction, lie detection, and fact verification

### Requirements Summary
1. Reconstruct 5 fragmented phone conversations from transcripts
2. Identify speakers and their names through inference
3. Detect lies/inconsistencies between speakers using fact verification
4. Cross-reference claims with facts database from previous tasks
5. Answer questions from centrala (including API interaction)
6. Submit structured JSON response

## Architecture Strategy

### Agent-Based Approach (S05E01 Patterns)
Following **ReAct Pattern**: Reasoning + Action + Observation in autonomous loop

**Core Components**:
- **Planning**: Analyze conversation fragments and create reconstruction strategy
- **Tools**: Specialized tools for data processing, verification, and reasoning
- **Reflection**: Evaluate consistency and detect lies through multi-step reasoning
- **Memory**: Maintain conversation state and verified facts throughout process

### Implementation Structure

**Reusable Agent Framework (in `/src`)**:
```
/src/
  agent/
    agent.ts                            # Core reusable Agent class
    tool.ts                             # Base Tool interface and abstract class
    types.ts                            # Shared agent types and interfaces
    planning.ts                         # Planning prompt templates
    reflection.ts                       # Reflection logic
```

**Task-Specific Implementation**:
```
/tasks/s05e01/
  index.ts                              # Main execution entry point
  phone-agent.ts                        # Phone task agent setup
  tools/
    conversation-reconstructor.ts        # Tool for rebuilding conversations
    fact-verifier.ts                    # Tool for cross-referencing facts
    lie-detector.ts                     # Tool for identifying dishonest speakers
    question-answerer.ts                # Tool for processing centrala questions
    api-interactor.ts                   # Tool for external API calls
  prompts/
    conversation-analysis.ts            # Prompts for conversation reconstruction
    fact-verification.ts                # Prompts for fact checking
    lie-detection.ts                    # Prompts for detecting inconsistencies
    question-processing.ts              # Prompts for answering questions
  data/
    reconstructed-conversations.json    # Processed conversation data
    verified-facts.json                 # Cross-referenced facts
    analysis-results.json               # Lie detection results
  types.ts                             # Task-specific TypeScript interfaces
```

## Detailed Tool Specifications

### Tool 1: ConversationReconstructor
**Purpose**: Rebuild fragmented conversations from transcripts
**Inputs**: 
- Raw phone.json data
- Start/end sentence patterns from logs
**Outputs**: 
- 5 complete conversations with speaker identification
- Confidence scores for speaker assignments

**Key Prompts**:
- Conversation boundary identification using start/end patterns
- Speaker pattern analysis and voice distinction
- Name inference from context clues
- Logical sequence reconstruction

### Tool 2: FactVerifier
**Purpose**: Cross-reference statements with known facts database
**Inputs**:
- Reconstructed conversations
- Facts database from previous tasks
**Outputs**:
- Verified claims with confidence scores
- Contradictions and inconsistencies

**Integration**:
- Load facts from `/data/pliki_z_fabryki/` or facts folder
- Use semantic similarity for fact matching
- Identify logical contradictions

### Tool 3: LieDetector
**Purpose**: Identify dishonest speakers through reasoning
**Inputs**:
- Verified facts
- Speaker claims from conversations
**Outputs**:
- Reliability assessment per speaker
- Flagged false statements
- Recommended exclusions

**Reasoning Strategy**:
- Compare claims with established facts
- Look for logical inconsistencies between speakers
- Evaluate credibility based on multiple data points
- Determine which speaker provides false information

### Tool 4: QuestionAnswerer
**Purpose**: Process centrala questions using verified information
**Inputs**:
- phone_questions.json from centrala
- Verified conversation data
- Reliable facts (excluding lies)
**Outputs**:
- Structured JSON responses
- API interaction results for specific questions

### Tool 5: APIInteractor
**Purpose**: Handle external API calls required by questions
**Inputs**:
- API endpoints from questions
- Required parameters
**Outputs**:
- API response data
- Formatted results for answer compilation

### Tool 6: CentralaIntegrator
**Purpose**: Manage communication with AI_devs centrala
**Inputs**:
- Task name ('phone')
- API key from environment
- Answer payload
**Outputs**:
- Submission success/failure status
- Feedback from centrala
- Validation results

### Tool 7: AnswerPersistence
**Purpose**: Save and validate answers with feedback loop
**Inputs**:
- Question-answer pairs
- Centrala feedback
- Validation results
**Outputs**:
- Persisted correct answers
- Error tracking and retry logic
- Learning from feedback

## Reusable Agent Framework Architecture

### Core Agent Framework (`/src/agent/`)

**Components**:
- **BaseAgent**: Abstract base class with ReAct loop implementation
- **Tool**: Abstract base class for all agent tools
- **AgentState**: Interface for maintaining agent state and history
- **Planning & Reflection**: Prompt templates and logic for autonomous reasoning

**Key Features**:
- Tool management and execution
- State management with history tracking
- Chat interface for interactive use
- Error handling and retry logic
- Extensible for different task types

### Phone Task Implementation

**Agent Setup**:
- Extends BaseAgent with phone-specific state
- Configures specialized tools for conversation analysis
- Implements custom planning and reflection prompts
- Handles task-specific business logic

**Tool Integration**:
- All tools follow common interface pattern
- Standardized input/output formats
- Built-in validation and error handling
- Consistent result structures


### Execution Flow
1. **Initialize**: Load phone.json, questions.json, and facts database
2. **Plan**: Determine conversation reconstruction strategy
3. **Execute**: Use ConversationReconstructor tool
4. **Reflect**: Evaluate reconstruction quality and completeness
5. **Plan**: Verify facts and cross-reference claims
6. **Execute**: Use FactVerifier tool
7. **Reflect**: Assess fact verification results
8. **Plan**: Detect lies and unreliable speakers
9. **Execute**: Use LieDetector tool
10. **Reflect**: Validate lie detection reasoning
11. **Plan**: Answer centrala questions
12. **Execute**: Use QuestionAnswerer and APIInteractor tools
13. **Submit**: Use CentralaIntegrator to send answers
14. **Feedback**: Process centrala response and validate
15. **Persist**: Save correct answers with AnswerPersistence tool
16. **Retry**: If errors, analyze feedback and retry failed questions
17. **Complete**: Confirm all answers accepted by centrala

## Key Prompt Strategies

### Conversation Reconstruction
- **Multi-step analysis**: Fragment identification → Speaker separation → Name inference
- **Context preservation**: Maintain conversation flow and logical progression
- **Confidence scoring**: Rate reconstruction accuracy

### Fact Verification
- **Semantic matching**: Use embeddings for fact comparison
- **Contradiction detection**: Identify logical inconsistencies
- **Source reliability**: Weight facts by credibility

### Lie Detection
- **Cross-validation**: Compare claims across multiple speakers
- **Consistency analysis**: Look for internal contradictions
- **Evidence weighing**: Prioritize verified facts over claims

## Integration with Project Architecture

### Shared Services Usage

**Framework Integration**:
- Import reusable agent framework from `/src/agent/`
- Leverage existing services (OpenAIService, sendReport, etc.)
- Follow established patterns and conventions
- Maintain consistency across tasks

### Usage Examples

**Setting up agents with different tool combinations**:
- Research agent: WebSearch + DocumentAnalyzer + Summarizer tools
- Email agent: Gmail + EmailComposer + ContactManager tools  
- Task agent: Todoist + Calendar + Notification tools
- Phone agent: ConversationReconstructor + FactVerifier + LieDetector tools

**Interactive capabilities**:
- `agent.executeTask(prompt)` for autonomous execution
- `agent.chat(message)` for conversational interaction
- State persistence and resumability
- Tool result chaining and context building

### Error Handling & Recovery
- **Retry logic**: Up to 3 attempts for failed operations
- **Validation checks**: Verify data integrity at each step
- **Fallback strategies**: Handle incomplete reconstruction
- **State persistence**: Resume from failure points
- **Centrala feedback**: Process error responses and adjust answers
- **Answer validation**: Cross-check against known patterns

### Data Management
- **Structured storage**: Save intermediate results as JSON
- **Context preservation**: Maintain conversation history
- **Fact database**: Load and cross-reference previous task data
- **Answer persistence**: Store validated answers for future reference
- **Feedback tracking**: Maintain history of centrala responses

## Success Criteria

**Autonomous Agent Should**:
1. ✅ Reconstruct all 5 conversations with correct speaker identification
2. ✅ Cross-reference all claims with facts database
3. ✅ Identify the dishonest speaker with reasoning
4. ✅ Answer all centrala questions using verified information only
5. ✅ Handle API interaction question correctly
6. ✅ Submit properly formatted JSON response to centrala
7. ✅ Process centrala feedback and validate answers
8. ✅ Retry failed questions with improved reasoning
9. ✅ Persist correct answers for future reference
10. ✅ Provide audit trail of reasoning and decisions

## Centrala Integration & Feedback Loop

### Data Sources
- **Phone data**: `https://centrala.ag3nts.org/data/{API_KEY}/phone.json`
- **Questions**: `https://centrala.ag3nts.org/data/{API_KEY}/phone_questions.json`
- **Submission endpoint**: Use `sendReport('phone', answers)` function

### Feedback Processing
- **Success validation**: Confirm centrala accepts all answers
- **Error handling**: Parse error messages and identify problematic answers
- **Retry mechanism**: Re-process failed questions with additional reasoning
- **Answer persistence**: Save validated answers to local storage

### Learning Loop (similar to S04E05)
- **Track successful patterns**: Identify reasoning approaches that work
- **Error analysis**: Learn from centrala feedback to improve future answers
- **Context building**: Use successful answers to inform similar questions
- **Validation history**: Maintain record of what centrala accepts/rejects

## Expected Output Format
```json
{
  "01": "zwięzła odpowiedź",
  "02": "zwięzła odpowiedź", 
  "03": "zwięzła odpowiedź",
  "04": "zwięzła odpowiedź",
  "05": "zwięzła odpowiedź",
  "06": "zwięzła odpowiedź"
}
```

## Execution
```bash
cd /Users/marek.szkudelski/cursor/ai-devs-tasks
npm run start --dir=s05e01
```

---

**Note**: This plan follows the agent architecture from S05E01, tool patterns from S04E01-S04E04, and task management concepts from S04E05. The implementation emphasizes autonomous reasoning with programmatic safeguards and comprehensive error handling.
