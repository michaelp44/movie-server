import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertSafeAgentReadablePath, resolveExistingFileInside } from './path-security.js';

describe('workspace path security', () => {
  it('allows files inside the configured root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'whatsapp-agent-root-'));
    const nested = join(root, 'nested');
    await mkdir(nested);
    await writeFile(join(nested, 'note.txt'), 'safe');

    await expect(resolveExistingFileInside(root, 'nested/note.txt')).resolves.toBe(
      await realpath(join(nested, 'note.txt'))
    );
  });

  it('rejects traversal and symlink escapes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'whatsapp-agent-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'whatsapp-agent-outside-'));
    await writeFile(join(outside, 'secret.txt'), 'secret');
    await symlink(outside, join(root, 'escape'));

    await expect(resolveExistingFileInside(root, '../outside.txt')).rejects.toThrow();
    await expect(resolveExistingFileInside(root, 'escape/secret.txt')).rejects.toThrow(
      'outside the configured workspace root'
    );
  });

  it('blocks secrets even when they are inside the workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'whatsapp-agent-root-'));
    const envPath = join(root, '.env');
    const keyPath = join(root, 'service.key');
    await writeFile(envPath, 'TOKEN=secret');
    await writeFile(keyPath, 'secret');

    expect(() => assertSafeAgentReadablePath(root, envPath)).toThrow(
      'Reading sensitive files is blocked'
    );
    expect(() => assertSafeAgentReadablePath(root, keyPath)).toThrow(
      'Reading sensitive files is blocked'
    );
  });
});
