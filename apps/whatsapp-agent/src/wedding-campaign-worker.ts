import type { AgentConfig } from './config.js';
import { execFileSync } from 'node:child_process';

function workerSecret(configured: string): string {
  if (configured) return configured;
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-w', '-s', 'wedding-fallback-shared-secret'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function startWeddingCampaignWorker(config: AgentConfig): () => void {
  const worker = config.weddingCampaignWorker;
  const secret = workerSecret(worker.secret);
  if (!worker.enabled || !worker.url || !secret) return () => {};
  let inFlight = false;
  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const response = await fetch(worker.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) process.stderr.write(`Wedding campaign worker returned HTTP ${response.status}.\n`);
    } catch (error) {
      process.stderr.write(`Wedding campaign worker check failed: ${error instanceof Error ? error.message : String(error)}\n`);
    } finally {
      inFlight = false;
    }
  };
  const timer = setInterval(() => void tick(), worker.pollSeconds * 1000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
