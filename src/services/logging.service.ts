import fs from 'fs/promises';
import path from 'path';

export interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    category: string;
    message: string;
    data?: any;
}

export class LoggingService {
    private logsDir: string;
    private enableConsole: boolean;

    constructor(logsDir: string = 'logs', enableConsole: boolean = true) {
        this.logsDir = logsDir;
        this.enableConsole = enableConsole;
        this.ensureLogsDirectory();
    }

    private async ensureLogsDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.logsDir, { recursive: true });
        } catch (error) {
            // Directory might already exist, ignore error
        }
    }

    private formatLogEntry(entry: LogEntry): string {
        const dataStr = entry.data ? `\nData: ${JSON.stringify(entry.data, null, 2)}` : '';
        return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${dataStr}\n`;
    }

    private async writeToFile(filename: string, content: string): Promise<void> {
        const filepath = path.join(this.logsDir, filename);
        try {
            await fs.appendFile(filepath, content);
        } catch (error) {
            console.error(`Failed to write to log file ${filepath}:`, error);
        }
    }

    async log(level: LogEntry['level'], category: string, message: string, data?: any): Promise<void> {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            data
        };

        const formattedEntry = this.formatLogEntry(entry);

        // Write to category-specific file
        await this.writeToFile(`${category}.log`, formattedEntry);

        // Write to general log file
        await this.writeToFile('general.log', formattedEntry);

        // Optional console output for important messages
        if (this.enableConsole && (level === 'error' || level === 'warn')) {
            console[level](`[${category}] ${message}`);
        }
    }

    // Convenience methods
    async debug(category: string, message: string, data?: any): Promise<void> {
        await this.log('debug', category, message, data);
    }

    async info(category: string, message: string, data?: any): Promise<void> {
        await this.log('info', category, message, data);
    }

    async warn(category: string, message: string, data?: any): Promise<void> {
        await this.log('warn', category, message, data);
    }

    async error(category: string, message: string, data?: any): Promise<void> {
        await this.log('error', category, message, data);
    }

    // Specialized logging methods for agent operations
    async logPrompt(category: string, model: string, prompt: string): Promise<void> {
        await this.log('debug', `${category}-prompts`, `Model: ${model}`, { prompt });
    }

    async logResponse(category: string, response: string, tokens?: { prompt: number, completion: number, total: number }): Promise<void> {
        await this.log('debug', `${category}-responses`, 'AI Response', { response, tokens });
    }

    async logAgentStep(agentId: string, step: number, action: string, details?: any): Promise<void> {
        await this.log('info', `agent-${agentId}`, `Step ${step}: ${action}`, details);
    }

    async logToolExecution(toolName: string, input: any, result: any): Promise<void> {
        await this.log('debug', 'tool-execution', `Tool: ${toolName}`, { input, result });
    }

    // Clean up old log files (optional utility)
    async cleanupOldLogs(daysToKeep: number = 7): Promise<void> {
        try {
            const files = await fs.readdir(this.logsDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            for (const file of files) {
                if (!file.endsWith('.log')) continue;
                
                const filepath = path.join(this.logsDir, file);
                const stats = await fs.stat(filepath);
                
                if (stats.mtime < cutoffDate) {
                    await fs.unlink(filepath);
                    console.log(`Cleaned up old log file: ${file}`);
                }
            }
        } catch (error) {
            console.error('Error cleaning up log files:', error);
        }
    }
}

// Global instance for easy access
export const logger = new LoggingService();
