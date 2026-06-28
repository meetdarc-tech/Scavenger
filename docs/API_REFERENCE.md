# Scavngr API Reference

> **Issue:** #752  
> **Version:** v1.0  
> **Last Updated:** 2026-06-26

---

## Table of Contents

1. [Overview](#overview)
2. [OpenAPI Specification](#openapi-specification)
3. [Authentication](#authentication)
4. [Rate Limiting](#rate-limiting)
5. [Indexer REST API](#indexer-rest-api)
6. [Soroban Contract API](#soroban-contract-api)
7. [TypeScript SDK](#typescript-sdk)
8. [Error Handling](#error-handling)
9. [API Versioning](#api-versioning)
10. [Changelog](#changelog)

---

## Overview

Scavngr exposes two API surfaces:

| Surface | Base URL | Purpose |
|---------|----------|---------|
| **Indexer REST API** | `http://localhost:3001` | Query indexed chain events, replay, metrics |
| **Soroban Contract** | Stellar RPC | On-chain state mutations and reads |
| **TypeScript SDK** | `@scavngr/sdk` | Typed wrapper for both surfaces |

All REST responses are JSON. All times are ISO 8601 strings unless stated otherwise.

---

## OpenAPI Specification

The Indexer REST API follows the OpenAPI 3.1 schema below.

```yaml
openapi: "3.1.0"
info:
  title: Scavngr Indexer API
  version: "1.0.0"
  description: REST API for querying indexed Scavngr blockchain events
  contact:
    name: Scavngr Developers
    url: https://github.com/Xoulomon/Scavenger

servers:
  - url: http://localhost:3001
    description: Local development
  - url: https://indexer.scavngr.io
    description: Production

tags:
  - name: health
    description: Service health and readiness
  - name: events
    description: Blockchain event queries
  - name: metrics
    description: Indexer operational metrics
  - name: replay
    description: Historical event replay

paths:
  /health:
    get:
      tags: [health]
      summary: Health check
      responses:
        "200":
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/HealthResponse"

  /metrics:
    get:
      tags: [metrics]
      summary: Indexer operational metrics
      responses:
        "200":
          description: Current metrics snapshot
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MetricsResponse"

  /events:
    get:
      tags: [events]
      summary: Query indexed events
      parameters:
        - name: type
          in: query
          schema:
            type: string
            example: recycled
        - name: from
          in: query
          schema:
            type: integer
            description: Start ledger sequence
        - name: to
          in: query
          schema:
            type: integer
            description: End ledger sequence
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
            maximum: 500
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        "200":
          description: Event list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/EventListResponse"
        "400":
          $ref: "#/components/responses/BadRequest"

  /events/stream:
    get:
      tags: [events]
      summary: Server-Sent Events stream of new contract events
      responses:
        "200":
          description: SSE stream
          content:
            text/event-stream:
              schema:
                type: string

  /replay:
    post:
      tags: [replay]
      summary: Trigger historical event replay
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ReplayRequest"
      responses:
        "202":
          description: Replay accepted
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ReplayStatusResponse"

  /replay/status/{id}:
    get:
      tags: [replay]
      summary: Get replay job status
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Replay status
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ReplayStatusResponse"
        "404":
          $ref: "#/components/responses/NotFound"

  /alerts:
    get:
      tags: [metrics]
      summary: List active alerts
      responses:
        "200":
          description: Alert list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AlertListResponse"

components:
  schemas:
    HealthResponse:
      type: object
      required: [status, timestamp]
      properties:
        status:
          type: string
          enum: [ok, degraded]
        timestamp:
          type: string
          format: date-time

    MetricsResponse:
      type: object
      properties:
        eventsProcessed:
          type: integer
        eventsFailed:
          type: integer
        lastEventTimestamp:
          type: string
          format: date-time
          nullable: true
        syncLag:
          type: integer
          description: Ledger lag behind chain tip
        reorgsDetected:
          type: integer
        alertsFired:
          type: integer
        startTime:
          type: string
          format: date-time
        eventsByType:
          type: object
          additionalProperties:
            type: integer

    IndexerEvent:
      type: object
      properties:
        id:
          type: string
        ledger:
          type: integer
        timestamp:
          type: string
          format: date-time
        type:
          type: string
        contractId:
          type: string
        topics:
          type: array
          items: {}
        data: {}

    EventListResponse:
      type: object
      properties:
        events:
          type: array
          items:
            $ref: "#/components/schemas/IndexerEvent"
        total:
          type: integer
        offset:
          type: integer
        limit:
          type: integer

    ReplayRequest:
      type: object
      required: [fromLedger, toLedger]
      properties:
        fromLedger:
          type: integer
        toLedger:
          type: integer

    ReplayStatusResponse:
      type: object
      properties:
        id:
          type: string
        status:
          type: string
          enum: [pending, running, complete, failed]
        progress:
          type: integer
          description: Percentage complete

    AlertListResponse:
      type: object
      properties:
        alerts:
          type: array
          items:
            type: object

    ErrorResponse:
      type: object
      required: [error]
      properties:
        error:
          type: string

  responses:
    BadRequest:
      description: Invalid request parameters
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
```

---

## Authentication

### Stellar Wallet (Contract Calls)

All state-changing contract calls require a signed Stellar transaction from the caller's account.

**Freighter (browser):**
```typescript
import { signWithFreighter } from '@scavngr/sdk'

const client = new ScavengerClient({ ...options })
client.setSigningStrategy(signWithFreighter())
await client.registerParticipant({ ... })
```

**Secret Key (server-side / testing):**
```typescript
import { signWithSecretKey } from '@scavngr/sdk'

client.setSigningStrategy(signWithSecretKey(process.env.SECRET_KEY!))
```

### Indexer REST API

The Indexer API is **unauthenticated** by default. For production deployments behind a reverse proxy, apply API-key middleware at the gateway level (e.g., nginx `auth_request`).

---

## Rate Limiting

### Indexer API

| Tier | Limit | Window | Header |
|------|-------|--------|--------|
| Default | 100 req | 1 minute | `X-RateLimit-Remaining` |
| Burst | 10 req | 1 second | — |

Rate limit responses return `429 Too Many Requests`:

```json
{ "error": "Rate limit exceeded. Retry after 42 seconds." }
```

Response headers on every request:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1750970400
```

### Soroban RPC

Stellar's public RPC endpoints enforce their own rate limits. For production, run a dedicated RPC node or use a paid provider.

| Network | Public RPC | Rate Limit |
|---------|------------|-----------|
| Testnet | `https://soroban-testnet.stellar.org` | 100 req/s |
| Mainnet | `https://mainnet.sorobanrpc.com` | Contact provider |

---

## Indexer REST API

### `GET /health`

Returns the current health status of the indexer service.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-26T17:23:41Z"
}
```

---

### `GET /metrics`

Operational metrics for the indexer process.

**Response:**
```json
{
  "eventsProcessed": 14823,
  "eventsFailed": 2,
  "lastEventTimestamp": "2026-06-26T17:23:00Z",
  "syncLag": 1,
  "reorgsDetected": 0,
  "alertsFired": 1,
  "startTime": "2026-06-25T08:00:00Z",
  "eventsByType": {
    "recycled": 3201,
    "transfer": 1840,
    "reg": 500
  }
}
```

---

### `GET /events`

Query indexed contract events with optional filters.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | — | Event type filter (`recycled`, `transfer`, `reg`, etc.) |
| `from` | integer | — | Start ledger (inclusive) |
| `to` | integer | — | End ledger (inclusive) |
| `limit` | integer | 50 | Max results (max 500) |
| `offset` | integer | 0 | Pagination offset |

**Request:**
```
GET /events?type=recycled&from=1000000&limit=10
```

**Response:**
```json
{
  "events": [
    {
      "id": "evt_0001",
      "ledger": 1000123,
      "timestamp": "2026-06-26T10:00:00Z",
      "type": "recycled",
      "contractId": "CCXXX...",
      "topics": ["recycled", "42"],
      "data": {
        "waste_type": 2,
        "weight": 1000,
        "recycler": "GABC...",
        "latitude": 40714000,
        "longitude": -74006000
      }
    }
  ],
  "total": 3201,
  "offset": 0,
  "limit": 10
}
```

---

### `GET /events/stream`

Server-Sent Events (SSE) stream for real-time event delivery.

**Request:**
```
GET /events/stream
Accept: text/event-stream
```

**Stream format:**
```
data: {"id":"evt_0042","type":"recycled","ledger":1000456,...}

data: {"id":"evt_0043","type":"transfer","ledger":1000457,...}
```

---

### `POST /replay`

Trigger a historical event replay between two ledger sequences.

**Request body:**
```json
{
  "fromLedger": 900000,
  "toLedger": 1000000
}
```

**Response (202):**
```json
{
  "id": "replay_abc123",
  "status": "pending",
  "progress": 0
}
```

---

### `GET /replay/status/:id`

Poll replay job status.

**Response:**
```json
{
  "id": "replay_abc123",
  "status": "running",
  "progress": 42
}
```

---

### `GET /alerts`

List currently active monitoring alerts.

**Response:**
```json
{
  "alerts": [
    {
      "name": "HighSyncLag",
      "severity": "warning",
      "message": "Indexer is 5 ledgers behind chain tip",
      "firedAt": "2026-06-26T17:20:00Z"
    }
  ]
}
```

---

## Soroban Contract API

For the full contract function reference see [`docs/CONTRACT_DOCUMENTATION.md`](CONTRACT_DOCUMENTATION.md) and [`docs/API_REFERENCE_GUIDE.md`](API_REFERENCE_GUIDE.md).

### Quick Examples (Soroban CLI)

**Register a participant:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SECRET_KEY \
  --network testnet \
  -- register_participant \
  --address $ADDR --role 0 --name recycler1 \
  --lat 40714000 --lon -74006000
```

**Submit waste material:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID --source $SECRET_KEY --network testnet \
  -- submit_material \
  --submitter $ADDR --waste_type 2 --weight 1000 \
  --lat 40714000 --lon -74006000
```

**Get global metrics:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID --network testnet \
  -- get_metrics
```

---

## TypeScript SDK

### Installation

```bash
npm install @scavngr/sdk
# or
yarn add @scavngr/sdk
```

### Setup

```typescript
import { ScavengerClient, Network, signWithFreighter } from '@scavngr/sdk'

const client = new ScavengerClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2025',
  contractId: process.env.VITE_CONTRACT_ID!,
})

// For browser (Freighter wallet)
client.setSigningStrategy(signWithFreighter())

// For server / CI (secret key)
// client.setSigningStrategy(signWithSecretKey(process.env.SECRET_KEY!))
```

### Core Methods

#### Participants

```typescript
// Register a new participant
await client.registerParticipant({
  address: 'GABC...',
  role: Role.Recycler,
  name: 'Alice',
  latitude: 40_714_000,
  longitude: -74_006_000,
})

// Get participant info
const participant: Participant | null = await client.getParticipant('GABC...')

// Check registration
const registered: boolean = await client.isParticipantRegistered('GABC...')
```

#### Waste Operations

```typescript
// Submit a material
const wasteId: bigint = await client.submitMaterial({
  submitter: 'GABC...',
  wasteType: WasteType.Plastic,
  weight: 1000n,
  latitude: 40_714_000n,
  longitude: -74_006_000n,
})

// Transfer waste
await client.transferWaste({
  wasteId,
  from: 'GABC...',
  to: 'GDEF...',
  latitude: 40_714_000n,
  longitude: -74_006_000n,
  note: 'Delivered to collector',
})

// Get waste details
const waste: Waste | null = await client.getWaste(wasteId)

// Get transfer history
const history: WasteTransfer[] = await client.getWasteTransferHistory(wasteId)
```

#### Incentives

```typescript
// Create incentive (Manufacturer only)
const incentiveId: bigint = await client.createIncentive({
  rewarder: 'GMFR...',
  wasteType: WasteType.Plastic,
  rewardPoints: 100n,
  budget: 50_000n,
})

// Get active incentives for a waste type
const incentives: Incentive[] = await client.getIncentives(WasteType.Plastic)

// Distribute rewards
await client.distributeRewards({
  wasteId,
  incentiveId,
  manufacturer: 'GMFR...',
})
```

#### Metrics

```typescript
const metrics: GlobalMetrics = await client.getMetrics()
console.log(metrics.total_wastes_count)  // number
console.log(metrics.total_tokens_earned) // bigint

const stats: ParticipantStats | null = await client.getStats('GABC...')
const supplyChain: SupplyChainStats = await client.getSupplyChainStats()
```

### Types Reference

```typescript
interface ClientOptions {
  rpcUrl: string
  networkPassphrase: string
  contractId: string
  pollTimeoutMs?: number   // default: 30000
  pollIntervalMs?: number  // default: 1500
}

enum Role        { Recycler, Collector, Manufacturer }
enum WasteType   { Paper=0, PetPlastic=1, Plastic=2, Metal=3, Glass=4, Organic=5, Electronic=6 }
enum Network     { Standalone, Testnet, Futurenet, Mainnet }

interface Participant {
  address: string; role: Role; name: string
  latitude: number; longitude: number; registered_at: number
}

interface Waste {
  waste_id: bigint; waste_type: WasteType; weight: bigint
  current_owner: string; latitude: bigint; longitude: bigint
  recycled_timestamp: number; is_active: boolean
  is_confirmed: boolean; confirmer: string
}

interface Incentive {
  id: number; rewarder: string; waste_type: WasteType
  reward_points: number; total_budget: number
  remaining_budget: number; active: boolean; created_at: number
}

interface GlobalMetrics {
  total_wastes_count: number
  total_tokens_earned: bigint
}
```

### Error Handling (SDK)

```typescript
import { ContractError, TransactionError, NetworkError } from '@scavngr/sdk'

try {
  await client.transferWaste({ ... })
} catch (err) {
  if (err instanceof ContractError) {
    // err.code maps to contract Error enum (see error codes table)
    console.error('Contract error:', err.code, err.message)
  } else if (err instanceof TransactionError) {
    console.error('Transaction failed:', err.resultCode)
  } else if (err instanceof NetworkError) {
    console.error('Network error:', err.message)
  }
}
```

---

## Error Handling

### HTTP Error Codes (Indexer API)

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 202 | Accepted (async job started) |
| 400 | Bad Request — invalid query parameters |
| 404 | Not Found — resource doesn't exist |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error |

### Soroban Contract Errors

All contract functions return `Result<T, Error>`. The numeric error code is embedded in the transaction result.

| Code | Variant | Likely Cause | Resolution |
|------|---------|-------------|------------|
| 1 | `AlreadyInitialized` | `initialize_admin` called twice | Deploy a fresh contract |
| 2 | `Unauthorized` | Non-admin called admin function | Use the correct admin key |
| 3 | `NotRegistered` | Participant not on chain | Call `register_participant` first |
| 4 | `AlreadyRegistered` | Address already exists | Address is already active |
| 5 | `NotManufacturer` | Role ≠ Manufacturer | Switch to a Manufacturer account |
| 6 | `NotWasteOwner` | Caller doesn't own waste | Use the waste's current owner address |
| 7 | `WasteNotFound` | Invalid waste ID | Check `get_participant_wastes` for valid IDs |
| 9 | `IncentiveNotFound` | Invalid incentive ID | Check `get_active_incentives` |
| 12 | `InvalidWeight` | Weight = 0 | Provide weight > 0 |
| 13 | `InvalidCoordinates` | lat/lon out of range | lat ∈ [-90M, +90M], lon ∈ [-180M, +180M] |
| 14 | `InvalidPercentage` | Sum > 100 | collector% + owner% ≤ 100 |
| 18 | `WasteDeactivated` | Waste was deactivated | Cannot be used after deactivation |
| 22 | `SelfConfirmation` | Owner confirmed own waste | Use a different confirmer address |
| 26 | `NoRewardAvailable` | Budget exhausted | Create a new incentive with fresh budget |
| 27 | `InvalidTransferRoute` | Invalid role combination | Only Recycler→Collector/Mfr, Collector→Mfr |
| 31 | `InsufficientBudget` | Budget < reward | Increase incentive budget |
| 44 | `WasteExpired` | Waste TTL elapsed | Waste can no longer be transferred |

---

## API Versioning

The Indexer REST API uses URL-free versioning; breaking changes are indicated by the `version` field in the API spec and changelog.

Current version: **v1.0**

The Soroban contract API is versioned via on-chain upgrade proposals (see `docs/CONTRACT_DOCUMENTATION.md` → Upgrade Procedures). Read-only functions are forwards-compatible; new parameters in write functions are additive.

### Deprecation Policy

- Deprecated endpoints/fields are marked in the OpenAPI spec with `deprecated: true`.
- Deprecated items are supported for a minimum of **3 months** before removal.
- Breaking changes are communicated via GitHub releases.

---

## Changelog

### v1.0.0 — 2026-06-26

**Initial release.**

- Indexer REST API: `/health`, `/metrics`, `/events`, `/events/stream`, `/replay`, `/alerts`
- Soroban contract API: full function coverage for admin, participants, waste, incentives, rewards
- TypeScript SDK (`@scavngr/sdk`): typed wrappers for all contract functions
- Support for Freighter wallet signing and secret-key signing
- Network presets: Standalone, Testnet, Futurenet, Mainnet
- Rate limiting: 100 req/min (indexer), burst 10 req/s
- Error mapping: contract error codes 1–54, SDK error class hierarchy

### Upcoming (v1.1)

- Webhook subscriptions for real-time event delivery
- GraphQL endpoint for complex queries
- Pagination cursors (replace offset with cursor-based pagination)
