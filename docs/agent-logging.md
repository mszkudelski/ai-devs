# Agent Framework Logging System

## Overview

The agent framework now features a clean, two-tier logging system that separates user-facing console output from detailed debug information.

## Console Output (User-Facing)

The console now shows only essential, clean information:

- **Task Start**: `🤖 Starting task: [prompt]`
- **Planning**: `💭 Planning: [reasoning]`
- **Tool Execution**: `🔧 [tool_name]`
- **Tool Success**: `✅ [tool_name] completed successfully`
- **Tool Failure**: `❌ [tool_name] failed: [error]`
- **Reflection**: `🤔 Reflecting on progress...`
- **Task Completion**: `✅ Task completed successfully`
- **Final Summary**: `📊 Task finished: [status] after [steps] steps ([successful_actions] successful actions)`
- **Chat Interactions**: 
  - `👤 User: [message]`
  - `🤖 Agent: [response]`

## File Logging (Detailed Debug Information)

All detailed information is logged to separate files in the `logs/` directory:

### Log Files Created

- **`openai-prompts.log`** - All prompts sent to OpenAI with model information
- **`openai-responses.log`** - All AI responses with token usage statistics
- **`agent-[agent_id].log`** - Agent execution steps and decisions
- **`tool-execution.log`** - Detailed tool input/output logs
- **`general.log`** - All logs combined for comprehensive debugging

### Log Entry Format

Each log entry includes:
- ISO timestamp
- Log level (DEBUG, INFO, WARN, ERROR)
- Category for easy filtering
- Message and structured data

Example:
```
[2024-12-09T10:30:45.123Z] [DEBUG] [openai-prompts] Model: gpt-4.1-nano
Data: {
  "prompt": "You are an AI agent..."
}
```

## Benefits

1. **Clean Console Experience**: Users see only relevant progress information
2. **Comprehensive Debugging**: All details preserved in structured log files
3. **Git-Safe**: Log files are git-ignored, preventing accidental commits
4. **Categorized Logging**: Easy to find specific types of information
5. **Token Tracking**: Monitor API usage and costs
6. **Performance Analysis**: Understand agent decision-making process

## Environment Configuration

The logging system respects the existing `enableLogging` configuration but now focuses on file-based detailed logging rather than console verbosity.

## Log Cleanup

The logging service includes a utility method to clean up old log files:

```typescript
import { logger } from './src/services/logging.service.js';

// Clean up logs older than 7 days
await logger.cleanupOldLogs(7);
```

## Usage in Tasks

The new logging system is automatically integrated. When running tasks:

1. **Development**: Use `npm run dev --dir=[task]` for automatic reload
2. **Production**: Use `npm run start --dir=[task]` for normal execution
3. **Debugging**: Check the `logs/` directory for detailed information

## Migration Notes

- Existing tasks automatically benefit from the new system
- No code changes required in individual tasks
- Console output is now cleaner and more informative
- All previous debugging information is preserved in log files

## Best Practices

1. **Console**: Keep console.log statements for user-facing information only
2. **File Logging**: Use the logger service for debugging information
3. **Log Levels**: 
   - DEBUG: Detailed execution flow
   - INFO: Important milestones and results
   - WARN: Non-critical issues
   - ERROR: Failures requiring attention
4. **Categories**: Use meaningful category names for easier filtering
