import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApprovalStore } from './approval-store.js';
import type { AgentConfig } from './config.js';
import { ToolRegistry } from './tool-registry.js';

function testConfig(directory: string): AgentConfig {
  return {
    transport: 'console',
    openaiApiKey: 'test',
    model: 'test-model',
    commandPrefix: '!agent',
    timezone: 'UTC',
    dataDir: join(directory, 'agent-data'),
    workspaceRoot: directory,
    tasksFile: join(directory, 'tasks.json'),
    namedTasks: {},
    whatsapp: {
      riskAcknowledgement: '',
      sessionDir: join(directory, 'session'),
      headless: true,
      readAllowlist: [],
      recentMessageLimit: 20,
      monitorGroupName: '',
      monitorGroupId: '',
      monitorContextMessages: 30,
      monitorDebounceSeconds: 8,
      monitorImageLimit: 3,
      monitorImageMaxBytes: 5 * 1024 * 1024,
      monitorClarificationCooldownHours: 12,
    },
    anyList: {
      monitorEnabled: false,
      shortcutName: 'Add to Test List',
    },
    sheets: {
      enabled: false,
      monitorGroupName: '',
      monitorGroupId: '',
      spreadsheetId: '',
      sheetName: 'קניות',
      credentialsPath: join(directory, 'client.json'),
      tokenPath: join(directory, 'sheets-token.json'),
      oauthPort: 42814,
      maxChanges: 20,
    },
    calendar: {
      autoCreate: false,
      calendarId: 'primary',
      credentialsPath: join(directory, 'client.json'),
      tokenPath: join(directory, 'token.json'),
      attendeeEmail: 'guest@example.com',
      defaultDurationMinutes: 60,
      approvalTtlHours: 24,
      oauthPort: 42813,
    },
  };
}

describe('ToolRegistry', () => {
  it('does not write a note until its one-time approval is executed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-tools-'));
    const agentConfig = testConfig(directory);
    const approvals = new ApprovalStore(agentConfig.dataDir);
    const tools = new ToolRegistry(agentConfig, approvals);

    const requested = await tools.call(
      'write_note',
      JSON.stringify({ title: 'Test', content: 'hello' })
    );
    expect(requested.approvalRequested).toBe(true);
    await expect(readdir(join(agentConfig.dataDir, 'notes'))).rejects.toThrow();

    const id = /approve ([A-F0-9]{8})/.exec(requested.output)?.[1];
    expect(id).toBeDefined();
    const pending = await approvals.take(id!);
    expect(pending).toBeDefined();
    await tools.executeApproved(pending!.action);

    await expect(readdir(join(agentConfig.dataDir, 'notes'))).resolves.toHaveLength(1);
  });

  it('blocks the model from reading an environment file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'whatsapp-agent-tools-'));
    const agentConfig = testConfig(directory);
    await writeFile(join(directory, '.env'), 'OPENAI_API_KEY=secret');
    const tools = new ToolRegistry(agentConfig, new ApprovalStore(agentConfig.dataDir));

    const result = await tools.call('read_text_file', JSON.stringify({ path: '.env' }));
    expect(result.output).toContain('Reading sensitive files is blocked');
    expect(result.output).not.toContain('secret');
  });
});
