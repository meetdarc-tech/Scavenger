import { PoolClient } from 'pg';

/**
 * Query performance monitoring and optimization utilities
 */

interface QueryMetrics {
  query: string;
  duration: number;
  rows: number;
  timestamp: Date;
}

const queryMetrics: QueryMetrics[] = [];
const SLOW_QUERY_THRESHOLD = 100; // ms

export function recordQueryMetric(query: string, duration: number, rows: number): void {
  queryMetrics.push({
    query: query.substring(0, 100),
    duration,
    rows,
    timestamp: new Date(),
  });

  if (duration > SLOW_QUERY_THRESHOLD) {
    console.warn(`[SLOW QUERY] ${duration}ms: ${query.substring(0, 80)}...`);
  }
}

export function getSlowQueries(threshold = SLOW_QUERY_THRESHOLD): QueryMetrics[] {
  return queryMetrics.filter((m) => m.duration > threshold);
}

export function clearMetrics(): void {
  queryMetrics.length = 0;
}

/**
 * Create optimized indexes for common queries
 */
export async function ensureIndexes(client: PoolClient): Promise<void> {
  const indexes = [
    // Search vector indexes
    `CREATE INDEX IF NOT EXISTS idx_participants_search_vector ON participants USING GIN (search_vector)`,
    `CREATE INDEX IF NOT EXISTS idx_wastes_search_vector ON wastes USING GIN (search_vector)`,

    // Foreign key lookups
    `CREATE INDEX IF NOT EXISTS idx_wastes_recycler ON wastes (recycler_address)`,
    `CREATE INDEX IF NOT EXISTS idx_waste_transfers_waste_id ON waste_transfers (waste_id)`,
    `CREATE INDEX IF NOT EXISTS idx_waste_transfers_from ON waste_transfers (from_address)`,
    `CREATE INDEX IF NOT EXISTS idx_waste_transfers_to ON waste_transfers (to_address)`,
    `CREATE INDEX IF NOT EXISTS idx_token_rewards_recipient ON token_rewards (recipient_address)`,
    `CREATE INDEX IF NOT EXISTS idx_carbon_credits_participant ON carbon_credits (participant_address)`,

    // Status and type filters
    `CREATE INDEX IF NOT EXISTS idx_wastes_is_active ON wastes (is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_wastes_is_confirmed ON wastes (is_confirmed)`,
    `CREATE INDEX IF NOT EXISTS idx_wastes_waste_type ON wastes (waste_type)`,
    `CREATE INDEX IF NOT EXISTS idx_participants_role ON participants (role)`,

    // Time-based queries
    `CREATE INDEX IF NOT EXISTS idx_wastes_registered_at ON wastes (registered_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_waste_transfers_transferred_at ON waste_transfers (transferred_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_participants_registered_at ON participants (registered_at DESC)`,

    // Composite indexes for common queries
    `CREATE INDEX IF NOT EXISTS idx_wastes_recycler_active ON wastes (recycler_address, is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_wastes_type_active ON wastes (waste_type, is_active)`,
  ];

  for (const index of indexes) {
    try {
      await client.query(index);
    } catch (err) {
      // Index may already exist, continue
    }
  }
}

/**
 * Batch query execution with connection pooling
 */
export async function executeBatchQueries(
  client: PoolClient,
  queries: Array<{ sql: string; params: unknown[] }>
): Promise<unknown[][]> {
  const results: unknown[][] = [];

  for (const { sql, params } of queries) {
    const start = Date.now();
    const result = await client.query(sql, params);
    recordQueryMetric(sql, Date.now() - start, result.rows.length);
    results.push(result.rows);
  }

  return results;
}
