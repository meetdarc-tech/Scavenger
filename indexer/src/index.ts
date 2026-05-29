import 'dotenv/config';
import { runMigrations } from './db/migrate';
import { runIndexer } from './indexer';
import { logger } from './utils/logger';

async function main() {
  const rpcUrl = process.env.STELLAR_RPC_URL;
  const contractId = process.env.CONTRACT_ID;

  if (!rpcUrl || !contractId) {
    throw new Error('STELLAR_RPC_URL and CONTRACT_ID must be set');
  }

  logger.info('Starting Scavngr indexer', { rpcUrl, contractId });

  await runMigrations();

  await runIndexer(
    {
      rpcUrl,
      contractId,
      startLedger: Number(process.env.START_LEDGER ?? 0),
    },
    Number(process.env.POLL_INTERVAL_MS ?? 5000)
  );
}

main().catch(err => {
  logger.error('Fatal error', { error: String(err) });
  process.exit(1);
});
