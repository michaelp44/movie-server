import './env.js';
import { config } from './config.js';
import { startConsoleTransport } from './console-transport.js';
import { AgentRuntime } from './runtime.js';
import { WhatsAppTransport } from './whatsapp-transport.js';
import { startWeddingCampaignWorker } from './wedding-campaign-worker.js';

async function main(): Promise<void> {
  if (config.transport === 'console') {
    const runtime = new AgentRuntime(config);
    await startConsoleTransport(runtime);
    return;
  }

  const transport = new WhatsAppTransport(config);
  const runtime = new AgentRuntime(config, transport);
  await transport.start(runtime);
  startWeddingCampaignWorker(config);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
