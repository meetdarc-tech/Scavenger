# Database Schema Documentation

Comprehensive documentation of Scavenger's on-chain storage schema, relationships, and optimization strategies.

## Table of Contents

- [Overview](#overview)
- [Entity-Relationship Diagram](#entity-relationship-diagram)
- [Storage Entities](#storage-entities)
- [Data Dictionary](#data-dictionary)
- [Indexing Strategy](#indexing-strategy)
- [Query Optimization](#query-optimization)
- [Migration Guide](#migration-guide)
- [Backup and Restore](#backup-and-restore)

## Overview

Scavenger uses Soroban's persistent storage to maintain on-chain state. The schema is designed for:

- **Efficiency:** Minimal storage footprint
- **Scalability:** Support for thousands of participants
- **Queryability:** Fast lookups and aggregations
- **Auditability:** Complete transaction history

### Storage Architecture

```
┌─────────────────────────────────────────┐
│     Soroban Persistent Storage          │
├─────────────────────────────────────────┤
│  Admin & Configuration                  │
│  ├─ Admin Address                       │
│  ├─ Charity Contract Address            │
│  ├─ Token Address                       │
│  └─ Reward Percentages                  │
├─────────────────────────────────────────┤
│  Participants                           │
│  ├─ Participant Data (by address)       │
│  ├─ Participant Wastes (by address)     │
│  └─ Participant Stats (by address)      │
├─────────────────────────────────────────┤
│  Waste/Materials                        │
│  ├─ Waste Data (by ID)                  │
│  ├─ Waste Transfer History (by ID)      │
│  └─ Waste Confirmation Status           │
├─────────────────────────────────────────┤
│  Incentives                             │
│  ├─ Incentive Data (by ID)              │
│  ├─ Active Incentives (by waste type)   │
│  └─ Manufacturer Incentives             │
├─────────────────────────────────────────┤
│  Metrics & Statistics                   │
│  ├─ Global Metrics                      │
│  ├─ Supply Chain Stats                  │
│  └─ Counters                            │
└─────────────────────────────────────────┘
```

---

## Entity-Relationship Diagram

```
┌──────────────────┐
│   Participant    │
├──────────────────┤
│ address (PK)     │
│ role             │
│ name             │
│ latitude         │
│ longitude        │
│ registered_at    │
│ is_active        │
└────────┬─────────┘
         │
         │ owns/submits
         │
         ▼
┌──────────────────┐         ┌──────────────────┐
│      Waste       │◄────────┤  Transfer Record │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │ waste_id (FK)    │
│ waste_type       │         │ from_address     │
│ weight           │         │ to_address       │
│ owner            │         │ timestamp        │
│ submitted_at     │         │ latitude         │
│ is_confirmed     │         │ longitude        │
│ confirmer        │         │ note             │
│ is_active        │         └──────────────────┘
└──────────────────┘
         │
         │ eligible for
         │
         ▼
┌──────────────────┐
│   Incentive      │
├──────────────────┤
│ id (PK)          │
│ manufacturer     │
│ waste_type       │
│ reward_points    │
│ budget           │
│ created_at       │
│ is_active        │
└──────────────────┘
```

---

## Storage Entities

### 1. Admin Configuration

**Purpose:** Store contract administration settings

**Storage Key:** `DataKey::Admin`

**Data Structure:**
```rust
pub struct AdminConfig {
    pub admin: Address,
    pub charity_contract: Option<Address>,
    pub token_address: Option<Address>,
    pub collector_percentage: u32,
    pub owner_percentage: u32,
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `admin` | Address | Current contract administrator |
| `charity_contract` | Option<Address> | Charity donation recipient |
| `token_address` | Option<Address> | Reward token contract |
| `collector_percentage` | u32 | Percentage for collectors (0-100) |
| `owner_percentage` | u32 | Percentage for waste owner (0-100) |

**Access Pattern:** Single read/write per transaction

---

### 2. Participant

**Purpose:** Store participant information and registration

**Storage Key:** `DataKey::Participant(address)`

**Data Structure:**
```rust
pub struct Participant {
    pub address: Address,
    pub role: ParticipantRole,
    pub name: String,
    pub latitude: i32,
    pub longitude: i32,
    pub registered_at: u64,
    pub is_active: bool,
}
```

**Fields:**
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `address` | Address | Stellar address | Unique, immutable |
| `role` | ParticipantRole | Recycler/Collector/Manufacturer | Enum |
| `name` | String | Human-readable name | Max 256 chars |
| `latitude` | i32 | GPS latitude | -90,000,000 to 90,000,000 |
| `longitude` | i32 | GPS longitude | -180,000,000 to 180,000,000 |
| `registered_at` | u64 | Registration timestamp | Unix seconds |
| `is_active` | bool | Active status | Default: true |

**Access Patterns:**
- Get by address: `O(1)`
- List all: `O(n)` — requires iteration
- Filter by role: `O(n)` — requires iteration

---

### 3. Participant Wastes

**Purpose:** Track waste IDs owned by each participant

**Storage Key:** `DataKey::ParticipantWastes(address)`

**Data Structure:**
```rust
pub struct ParticipantWastes {
    pub waste_ids: Vec<u64>,
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `waste_ids` | Vec<u64> | List of waste IDs owned by participant |

**Access Patterns:**
- Get all wastes for participant: `O(1)` storage read, `O(n)` iteration
- Add waste: `O(1)` append
- Remove waste: `O(n)` search and remove

---

### 4. Participant Stats

**Purpose:** Store aggregated statistics for participants

**Storage Key:** `DataKey::ParticipantStats(address)`

**Data Structure:**
```rust
pub struct ParticipantStats {
    pub total_waste_submitted: u128,
    pub total_waste_verified: u128,
    pub total_waste_transferred: u128,
    pub total_tokens_earned: u128,
    pub waste_by_type: Map<WasteType, u128>,
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `total_waste_submitted` | u128 | Total weight submitted |
| `total_waste_verified` | u128 | Total weight verified |
| `total_waste_transferred` | u128 | Total weight transferred |
| `total_tokens_earned` | u128 | Total tokens earned |
| `waste_by_type` | Map | Breakdown by waste type |

**Access Patterns:**
- Get stats: `O(1)`
- Update stats: `O(1)` per field

---

### 5. Waste

**Purpose:** Store waste/material information

**Storage Key:** `DataKey::Waste(waste_id)`

**Data Structure:**
```rust
pub struct Waste {
    pub id: u64,
    pub waste_type: WasteType,
    pub weight: u128,
    pub owner: Address,
    pub submitted_at: u64,
    pub submitted_by: Address,
    pub is_confirmed: bool,
    pub confirmer: Option<Address>,
    pub is_active: bool,
}
```

**Fields:**
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | u64 | Unique waste ID | Auto-increment |
| `waste_type` | WasteType | Type of waste | Enum |
| `weight` | u128 | Weight in grams | > 0 |
| `owner` | Address | Current owner | Mutable |
| `submitted_at` | u64 | Submission timestamp | Unix seconds |
| `submitted_by` | Address | Original submitter | Immutable |
| `is_confirmed` | bool | Confirmation status | Default: false |
| `confirmer` | Option<Address> | Who confirmed | Optional |
| `is_active` | bool | Active status | Default: true |

**Access Patterns:**
- Get by ID: `O(1)`
- Get all: `O(n)` — requires iteration
- Filter by type: `O(n)` — requires iteration

---

### 6. Waste Transfer History

**Purpose:** Maintain immutable transfer audit trail

**Storage Key:** `DataKey::WasteTransferHistory(waste_id)`

**Data Structure:**
```rust
pub struct TransferRecord {
    pub waste_id: u64,
    pub from: Address,
    pub to: Address,
    pub timestamp: u64,
    pub latitude: i32,
    pub longitude: i32,
    pub note: String,
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `waste_id` | u64 | Reference to waste |
| `from` | Address | Sender address |
| `to` | Address | Recipient address |
| `timestamp` | u64 | Transfer time |
| `latitude` | i32 | Transfer location latitude |
| `longitude` | i32 | Transfer location longitude |
| `note` | String | Transfer notes |

**Access Patterns:**
- Get history for waste: `O(1)` read, `O(n)` iteration
- Append transfer: `O(1)` append
- Immutable: No updates

---

### 7. Incentive

**Purpose:** Store incentive programs

**Storage Key:** `DataKey::Incentive(incentive_id)`

**Data Structure:**
```rust
pub struct Incentive {
    pub id: u64,
    pub manufacturer: Address,
    pub waste_type: WasteType,
    pub reward_points: u128,
    pub budget: u128,
    pub created_at: u64,
    pub is_active: bool,
}
```

**Fields:**
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | u64 | Unique incentive ID | Auto-increment |
| `manufacturer` | Address | Creator address | Immutable |
| `waste_type` | WasteType | Target waste type | Enum |
| `reward_points` | u128 | Points per unit | > 0 |
| `budget` | u128 | Total budget | > 0 |
| `created_at` | u64 | Creation timestamp | Unix seconds |
| `is_active` | bool | Active status | Mutable |

**Access Patterns:**
- Get by ID: `O(1)`
- Get by waste type: `O(n)` — requires iteration
- Get by manufacturer: `O(n)` — requires iteration

---

### 8. Global Metrics

**Purpose:** Store aggregate contract statistics

**Storage Key:** `DataKey::GlobalMetrics`

**Data Structure:**
```rust
pub struct GlobalMetrics {
    pub total_waste_submitted: u128,
    pub total_waste_verified: u128,
    pub total_tokens_distributed: u128,
    pub total_participants: u64,
    pub waste_counter: u64,
    pub incentive_counter: u64,
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `total_waste_submitted` | u128 | Total weight submitted |
| `total_waste_verified` | u128 | Total weight verified |
| `total_tokens_distributed` | u128 | Total tokens given |
| `total_participants` | u64 | Number of participants |
| `waste_counter` | u64 | Next waste ID |
| `incentive_counter` | u64 | Next incentive ID |

**Access Patterns:**
- Get metrics: `O(1)`
- Update metrics: `O(1)` per field

---

## Data Dictionary

### Enums

**ParticipantRole:**
```rust
pub enum ParticipantRole {
    Recycler = 0,      // Collects and processes recyclables
    Collector = 1,     // Collects materials
    Manufacturer = 2,  // Manufactures products
}
```

**WasteType:**
```rust
pub enum WasteType {
    Plastic = 0,
    Paper = 1,
    Metal = 2,
    Glass = 3,
    Organic = 4,
    Electronic = 5,
    Textile = 6,
    Mixed = 7,
}
```

### Data Types

| Type | Size | Range | Notes |
|------|------|-------|-------|
| `u32` | 4 bytes | 0 to 4,294,967,295 | Percentages, small counts |
| `u64` | 8 bytes | 0 to 18,446,744,073,709,551,615 | IDs, timestamps, counters |
| `u128` | 16 bytes | 0 to 340,282,366,920,938,463,463,374,607,431,768,211,455 | Weights, tokens, amounts |
| `i32` | 4 bytes | -2,147,483,648 to 2,147,483,647 | Coordinates |
| `Address` | 32 bytes | - | Stellar address |
| `String` | Variable | - | UTF-8 text |
| `Vec<T>` | Variable | - | Dynamic array |
| `Map<K,V>` | Variable | - | Key-value store |

---

## Indexing Strategy

### Primary Indexes

**Participant by Address:**
```
Key: DataKey::Participant(address)
Type: Direct lookup
Complexity: O(1)
Use case: Get participant info
```

**Waste by ID:**
```
Key: DataKey::Waste(waste_id)
Type: Direct lookup
Complexity: O(1)
Use case: Get waste details
```

**Incentive by ID:**
```
Key: DataKey::Incentive(incentive_id)
Type: Direct lookup
Complexity: O(1)
Use case: Get incentive details
```

### Secondary Indexes

**Participant Wastes:**
```
Key: DataKey::ParticipantWastes(address)
Type: Vector of IDs
Complexity: O(1) read, O(n) iteration
Use case: List all wastes for participant
```

**Active Incentives by Waste Type:**
```
Key: DataKey::ActiveIncentivesByType(waste_type)
Type: Vector of incentive IDs
Complexity: O(1) read, O(n) iteration
Use case: Find incentives for waste type
```

### Query Optimization Tips

1. **Use direct lookups when possible:**
   ```rust
   // Fast: O(1)
   let participant = get_participant(&env, address);
   
   // Slow: O(n)
   let all_participants = list_all_participants(&env);
   ```

2. **Batch operations:**
   ```rust
   // Efficient: Single transaction
   for waste_id in waste_ids {
       verify_material(&env, waste_id, verifier.clone())?;
   }
   ```

3. **Cache frequently accessed data:**
   ```rust
   // Store in local variable to avoid repeated reads
   let metrics = get_metrics(&env);
   let total = metrics.total_waste_submitted;
   ```

4. **Minimize storage reads:**
   ```rust
   // Read once, use multiple times
   let participant = get_participant(&env, address)?;
   let role = participant.role;
   let name = participant.name;
   ```

---

## Query Optimization

### Common Queries

**Get participant info:**
```rust
pub fn get_participant(env: &Env, address: Address) -> Result<Participant, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Participant(address.clone()))
        .ok_or(Error::ParticipantNotFound)
}
```

**Get all wastes for participant:**
```rust
pub fn get_participant_wastes(env: &Env, address: Address) -> Result<Vec<u64>, Error> {
    let wastes = env.storage()
        .persistent()
        .get(&DataKey::ParticipantWastes(address))
        .ok_or(Error::ParticipantNotFound)?;
    Ok(wastes.waste_ids)
}
```

**Get active incentives for waste type:**
```rust
pub fn get_incentives(env: &Env, waste_type: WasteType) -> Result<Vec<Incentive>, Error> {
    let incentive_ids = env.storage()
        .persistent()
        .get(&DataKey::ActiveIncentivesByType(waste_type))
        .unwrap_or_default();
    
    let mut incentives = Vec::new();
    for id in incentive_ids {
        if let Ok(incentive) = get_incentive(env, id) {
            if incentive.is_active {
                incentives.push(incentive);
            }
        }
    }
    Ok(incentives)
}
```

### Performance Considerations

| Operation | Complexity | Cost | Notes |
|-----------|-----------|------|-------|
| Get by ID | O(1) | Low | Direct storage read |
| List all | O(n) | High | Requires iteration |
| Filter | O(n) | High | Requires iteration |
| Update | O(1) | Low | Direct storage write |
| Delete | O(1) | Low | Mark inactive |
| Batch read | O(n) | Medium | Multiple reads |

---

## Migration Guide

### Adding New Fields

1. **Create new storage key:**
   ```rust
   pub enum DataKey {
       // Existing keys...
       NewField(Address),
   }
   ```

2. **Add migration function:**
   ```rust
   pub fn migrate_add_new_field(env: &Env) -> Result<(), Error> {
       // Initialize new field for existing data
       let participants = list_all_participants(env)?;
       for participant in participants {
           env.storage()
               .persistent()
               .set(&DataKey::NewField(participant.address), &default_value);
       }
       Ok(())
   }
   ```

3. **Update contract version:**
   ```rust
   const CONTRACT_VERSION: u32 = 2;
   ```

### Backward Compatibility

- Always add new fields as optional
- Provide default values for missing fields
- Maintain old storage keys during transition
- Test migration thoroughly

---

## Backup and Restore

### Backup Strategy

**On-chain backup:**
```bash
# Export contract state
soroban contract read \
  --id <contract-id> \
  --network <network> > backup.json
```

**Off-chain backup:**
```bash
# Archive important data
tar -czf scavenger-backup-$(date +%Y%m%d).tar.gz \
  docs/ \
  stellar-contract/src/ \
  frontend/src/
```

### Restore Procedures

**Restore from backup:**
```bash
# Redeploy contract
soroban contract deploy \
  --wasm stellar-contract/target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source <deployer> \
  --network <network>

# Restore state (if applicable)
# Note: Soroban doesn't support direct state restore
# Must replay transactions or use contract upgrade
```

### Data Recovery

**In case of data loss:**

1. **Identify last known good state:**
   ```bash
   # Check transaction history
   soroban contract info --id <contract-id> --network <network>
   ```

2. **Replay transactions:**
   ```bash
   # Re-execute transactions from logs
   for tx in $(cat transaction-log.txt); do
       soroban contract invoke --id <contract-id> --network <network> -- $tx
   done
   ```

3. **Verify data integrity:**
   ```bash
   # Compare checksums
   soroban contract read --id <contract-id> --network <network> | sha256sum
   ```

---

## Sample Queries

### Get Participant Dashboard

```rust
pub fn get_participant_dashboard(
    env: &Env,
    address: Address,
) -> Result<ParticipantDashboard, Error> {
    let participant = get_participant(env, address.clone())?;
    let stats = get_stats(env, address.clone())?;
    let wastes = get_participant_wastes(env, address)?;
    
    Ok(ParticipantDashboard {
        participant,
        stats,
        waste_count: wastes.len() as u64,
    })
}
```

### Get Supply Chain for Waste

```rust
pub fn get_waste_supply_chain(
    env: &Env,
    waste_id: u64,
) -> Result<Vec<TransferRecord>, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::WasteTransferHistory(waste_id))
        .ok_or(Error::WasteNotFound)
}
```

### Get Manufacturer Incentives

```rust
pub fn get_manufacturer_incentives(
    env: &Env,
    manufacturer: Address,
) -> Result<Vec<Incentive>, Error> {
    let all_incentives = get_active_incentives(env)?;
    Ok(all_incentives
        .into_iter()
        .filter(|i| i.manufacturer == manufacturer)
        .collect())
}
```

---

## Best Practices

1. **Use appropriate data types** — Choose smallest type that fits
2. **Minimize storage reads** — Cache frequently accessed data
3. **Batch operations** — Group related operations
4. **Validate input** — Check constraints before storage
5. **Maintain indexes** — Keep secondary indexes updated
6. **Monitor storage** — Track storage usage over time
7. **Archive old data** — Move inactive data to archive
8. **Document changes** — Keep schema documentation current
