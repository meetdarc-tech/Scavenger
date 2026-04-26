# Logging Infrastructure

## Overview
Centralized logging using ELK Stack (Elasticsearch, Logstash, Kibana) for all services.

## Components

### Elasticsearch
- Stores and indexes logs
- Single-node configuration for development
- Production: Use cluster setup with multiple nodes
- Data retention: 30 days (configurable via ILM policy)

### Logstash
- Aggregates logs from multiple sources
- Parses and enriches log data
- Supports structured logging with correlation IDs
- Inputs: UDP, file-based logs

### Kibana
- Web UI for log visualization and search
- Dashboard creation for monitoring
- Alert configuration
- Access: http://localhost:5601

## Setup

### Local Development
```bash
docker-compose -f docker-compose.logging.yml up -d
```

### Structured Logging Format
```json
{
  "timestamp": "2026-04-26T11:32:05.138Z",
  "level": "INFO",
  "service": "contract",
  "correlation_id": "req-12345",
  "message": "Participant registered",
  "data": {
    "participant_id": "addr123",
    "role": "Recycler"
  }
}
```

## Log Retention Policy
- Development: 7 days
- Staging: 14 days
- Production: 30 days

Configure via Elasticsearch Index Lifecycle Management (ILM).

## Searching Logs
### By Correlation ID
```
correlation_id: "req-12345"
```

### By Service
```
service: "contract" AND level: "ERROR"
```

### By Time Range
Use Kibana's time picker for custom ranges.

## Dashboards
Create dashboards in Kibana for:
- Error rates by service
- Request latency
- Participant activity
- Transaction volume
