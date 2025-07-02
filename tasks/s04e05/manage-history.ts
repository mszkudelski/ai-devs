#!/usr/bin/env tsx

import { 
    showAttemptHistory, 
    clearAttemptHistory, 
    addManualAttemptToHistory,
    loadAttemptHistory
} from './question-answering.js';

/**
 * Utility script to manage attempt history for the question-answering system
 * 
 * Usage examples:
 * 
 * Show current history:
 * npm run start --dir=s04e05 -- --action=show
 * 
 * Clear all history:
 * npm run start --dir=s04e05 -- --action=clear
 * 
 * Add manual attempt:
 * npm run start --dir=s04e05 -- --action=add --attempt=1 --feedback="Your feedback here"
 */

function parseArgs() {
    const args = process.argv.slice(2);
    const parsedArgs: Record<string, string> = {};
    
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
            parsedArgs[key] = value;
            if (value !== 'true') i++; // Skip next arg if it was used as value
        }
    }
    
    return parsedArgs;
}

function showHelp() {
    console.log(`
🔧 Attempt History Management Tool

Available actions:

📋 show     - Display current attempt history
🗑️  clear    - Clear all attempt history (use with caution)
➕ add      - Add a manual attempt to history
📊 stats    - Show statistics about attempts

Examples:

# Show current history
tsx manage-history.ts --action=show

# Clear all history
tsx manage-history.ts --action=clear

# Add a manual attempt
tsx manage-history.ts --action=add --attempt=1 --feedback="Q01 should be a year, Q02 should be a person name" --success=false

# Show statistics
tsx manage-history.ts --action=stats

Arguments for 'add' action:
  --attempt     Attempt number (required)
  --feedback    Feedback text (required)
  --success     Whether attempt was successful (optional, default: false)
  --answers     JSON string of answers (optional)

`);
}

async function executeManageHistory() {
    const args = parseArgs();
    const action = args.action;
    
    if (!action || action === 'help') {
        showHelp();
        return;
    }
    
    console.log(`🔧 Managing attempt history - Action: ${action}`);
    
    switch (action) {
        case 'show':
            showAttemptHistory();
            break;
            
        case 'clear':
            console.log('⚠️  Are you sure you want to clear all attempt history?');
            console.log('This action cannot be undone. Type "yes" to confirm:');
            
            // Simple confirmation - in real scenario you might want to use readline
            const confirm = process.env.CONFIRM_CLEAR;
            if (confirm === 'yes') {
                clearAttemptHistory();
                console.log('✅ History cleared');
            } else {
                console.log('❌ Clear cancelled. Use CONFIRM_CLEAR=yes to confirm');
            }
            break;
            
        case 'add':
            const attemptNum = parseInt(args.attempt);
            const feedback = args.feedback;
            const success = args.success === 'true';
            
            if (!attemptNum || !feedback) {
                console.error('❌ Missing required arguments for add action');
                console.log('Required: --attempt=<number> --feedback="<text>"');
                return;
            }
            
            let answers = {};
            if (args.answers) {
                try {
                    answers = JSON.parse(args.answers);
                } catch (error) {
                    console.error('❌ Invalid JSON for answers:', error);
                    return;
                }
            }
            
            addManualAttemptToHistory(attemptNum, answers, feedback, success);
            console.log(`✅ Added attempt ${attemptNum} to history`);
            break;
            
        case 'stats':
            const history = loadAttemptHistory();
            console.log(`📊 Attempt Statistics:`);
            console.log(`Total attempts: ${history.totalAttempts}`);
            console.log(`Recorded attempts: ${history.attempts.length}`);
            console.log(`Successful attempts: ${history.attempts.filter(a => a.success).length}`);
            console.log(`Failed attempts: ${history.attempts.filter(a => !a.success).length}`);
            
            if (history.attempts.length > 0) {
                const latestAttempt = history.attempts[history.attempts.length - 1];
                console.log(`Latest attempt: ${latestAttempt.attempt} (${latestAttempt.success ? 'SUCCESS' : 'FAILED'})`);
                console.log(`Latest timestamp: ${latestAttempt.timestamp}`);
            }
            break;
            
        default:
            console.error(`❌ Unknown action: ${action}`);
            showHelp();
            break;
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    executeManageHistory().then(() => {
        console.log('\n✅ Management task completed');
    }).catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
}

export { executeManageHistory };
