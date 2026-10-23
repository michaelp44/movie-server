import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { PendingAction, PendingApproval } from './types.js';

const pendingActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('write_note'),
    title: z.string().min(1).max(120),
    content: z.string().max(100_000),
  }),
  z.object({
    type: z.literal('run_named_task'),
    name: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal('create_calendar_event'),
    event: z.object({
      title: z.string().min(1).max(200),
      startTime: z.string().datetime({ offset: true }),
      endTime: z.string().datetime({ offset: true }),
      timezone: z.string().min(1).max(100),
      attendeeEmail: z.string().email(),
      location: z.string().max(500),
      description: z.string().max(5000),
      sourceChatId: z.string().min(1).max(200),
      sourceMessageId: z.string().min(1).max(500),
      idempotencyKey: z.string().regex(/^[a-f0-9]{32}$/),
    }),
  }),
]);

const pendingApprovalSchema = z.object({
  id: z.string().regex(/^[A-F0-9]{8}$/),
  action: pendingActionSchema,
  summary: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

const storeSchema = z.array(pendingApprovalSchema);

export type TakeOnlyApprovalResult =
  | { kind: 'none' }
  | { kind: 'multiple'; approvals: PendingApproval[] }
  | { kind: 'taken'; approval: PendingApproval };

export class ApprovalStore {
  private readonly filePath: string;

  constructor(
    private readonly dataDir: string,
    private readonly ttlMs = 15 * 60 * 1000
  ) {
    this.filePath = join(dataDir, 'pending-approvals.json');
  }

  async create(
    action: PendingAction,
    summary: string,
    ttlMs = this.ttlMs
  ): Promise<PendingApproval> {
    const now = new Date();
    const pending: PendingApproval = {
      id: randomBytes(4).toString('hex').toUpperCase(),
      action,
      summary,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    const approvals = await this.readActive();
    approvals.push(pending);
    await this.write(approvals);
    return pending;
  }

  async take(id: string): Promise<PendingApproval | undefined> {
    const normalizedId = id.trim().toUpperCase();
    const approvals = await this.readActive();
    const match = approvals.find((approval) => approval.id === normalizedId);
    if (!match) return undefined;
    await this.write(approvals.filter((approval) => approval.id !== normalizedId));
    return match;
  }

  async takeOnly(): Promise<TakeOnlyApprovalResult> {
    const approvals = await this.readActive();
    if (approvals.length === 0) return { kind: 'none' };
    if (approvals.length > 1) return { kind: 'multiple', approvals };
    const approval = approvals[0];
    if (!approval) return { kind: 'none' };
    await this.write([]);
    return { kind: 'taken', approval };
  }

  async deny(id: string): Promise<boolean> {
    const normalizedId = id.trim().toUpperCase();
    const approvals = await this.readActive();
    const remaining = approvals.filter((approval) => approval.id !== normalizedId);
    if (remaining.length === approvals.length) return false;
    await this.write(remaining);
    return true;
  }

  private async readActive(): Promise<PendingApproval[]> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, 'utf8'));
      const now = Date.now();
      return storeSchema.parse(parsed).filter((approval) => Date.parse(approval.expiresAt) > now);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return [];
      throw error;
    }
  }

  private async write(approvals: PendingApproval[]): Promise<void> {
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    if (approvals.length === 0) {
      await unlink(this.filePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
      return;
    }

    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(approvals, null, 2), { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }
}
