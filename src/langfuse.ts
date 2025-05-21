import { Langfuse, LangfuseTraceClient } from 'langfuse';
import dotenv from 'dotenv';

dotenv.config();

export class LangfuseService {
  private langfuse: Langfuse;

  constructor() {
    this.langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_HOST
    });

    this.langfuse.on("error", (error: Error) => {
      console.error("Langfuse error:", error);
    });

    if (process.env.NODE_ENV === 'development') {
      this.langfuse.debug();
    }
  }

  createTrace(options: { id: string, name: string, sessionId: string }): LangfuseTraceClient {
    return this.langfuse.trace(options);
  }

  async finalizeTrace(trace: LangfuseTraceClient, input: any, output: any): Promise<void> {
    await trace.update({ 
      input,
      output,
    });
    await this.langfuse.flushAsync();
  }

  async shutdownAsync(): Promise<void> {
    await this.langfuse.shutdownAsync();
  }
}