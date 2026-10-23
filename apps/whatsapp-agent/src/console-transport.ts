import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { AgentRuntime } from './runtime.js';

export async function startConsoleTransport(runtime: AgentRuntime): Promise<void> {
  const terminal = createInterface({ input: stdin, output: stdout });
  stdout.write('Local agent ready. Type "help" or press Ctrl+C to exit.\n');

  try {
    while (true) {
      const text = await terminal.question('you> ');
      await runtime.handle(text, {
        reply: async (reply) => {
          stdout.write(`agent> ${reply}\n`);
        },
      });
    }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'AbortError') {
      throw error;
    }
  } finally {
    terminal.close();
  }
}
