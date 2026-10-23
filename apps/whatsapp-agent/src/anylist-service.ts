import { spawn } from 'node:child_process';
import type { AgentConfig } from './config.js';

function runShortcutWithTextInput(shortcutName: string, input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/shortcuts', ['run', shortcutName], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let settled = false;
    let stderr = '';
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      finish(new Error('Siri Shortcut timed out'));
    }, 30_000);

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < 4000) stderr += chunk;
    });
    child.once('error', (error) => finish(error));
    child.once('close', (code) => {
      if (code === 0) finish();
      else finish(new Error(stderr.trim() || `Siri Shortcut exited with code ${code ?? 'unknown'}`));
    });
    child.stdin.once('error', (error) => finish(error));
    child.stdin.end(input, 'utf8');
  });
}

export interface AnyListWriteResult {
  added: string[];
  failed: string[];
}

export interface AnyListWriter {
  addItems(items: string[]): Promise<AnyListWriteResult>;
}

export class SiriShortcutAnyListWriter implements AnyListWriter {
  constructor(private readonly agentConfig: AgentConfig) {}

  async addItems(items: string[]): Promise<AnyListWriteResult> {
    const added: string[] = [];
    const failed: string[] = [];

    for (const item of items) {
      try {
        await runShortcutWithTextInput(this.agentConfig.anyList.shortcutName, item);
        added.push(item);
      } catch {
        failed.push(item);
      }
    }

    return { added, failed };
  }
}
