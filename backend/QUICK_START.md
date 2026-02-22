# Quick Start - Soroban Transaction Queue

## 5-Minute Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start Redis
```bash
# Docker
docker run -d -p 6379:6379 redis:latest

# Or macOS
brew services start redis

# Or Linux
sudo systemctl start redis-server
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Start Application
```bash
npm run start:dev
```

### 5. Test It
```bash
# Submit a transaction
curl -X POST http://localhost:3000/blockchain/submit-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "contractMethod": "register_blood",
    "args": ["bank-123", "O+", 100, 1708000000],
    "idempotencyKey": "test-key-'$(date +%s)'",
    "maxRetries": 5
  }'

# Check queue status (admin)
curl -X GET http://localhost:3000/blockchain/queue/status \
  -H "X-Admin-Key: your-admin-key"
```

## Key Concepts

### Idempotency Key
Unique identifier that prevents duplicate submissions. Use format:
```
{operation}-{resource}-{timestamp}
Example: blood-reg-bank123-1708000000
```

### Job Status
- `pending` - Waiting to be processed
- `completed` - Successfully submitted to blockchain
- `failed` - Retrying (has attempts remaining)
- `dlq` - Permanently failed (moved to dead letter queue)

### Retry Logic
- Automatic exponential backoff: 1s → 2s → 4s → 8s → 16s (max 60s)
- Default 5 retries
- Jitter prevents thundering herd

### Dead Letter Queue (DLQ)
Jobs that fail after max retries are moved here for manual review.

## Common Tasks

### Submit Transaction
```typescript
const jobId = await sorobanService.submitTransaction({
  contractMethod: 'register_blood',
  args: ['bank-123', 'O+', 100, 1708000000],
  idempotencyKey: 'blood-reg-001',
  maxRetries: 5,
  metadata: { userId: 'user-123' }
});
```

### Check Job Status
```typescript
const status = await sorobanService.getJobStatus(jobId);
console.log(status.status); // 'pending', 'completed', 'failed', 'dlq'
```

### Get Queue Metrics
```typescript
const metrics = await sorobanService.getQueueMetrics();
console.log(metrics);
// { queueDepth: 5, failedJobs: 2, dlqCount: 1 }
```

### Prevent Duplicates
```typescript
// Same idempotency key = rejected
const key = 'blood-reg-001';

// First call succeeds
const job1 = await sorobanService.submitTransaction({
  idempotencyKey: key,
  contractMethod: 'register_blood',
  args: ['bank-123', 'O+', 100, 1708000000],
});

// Second call with same key fails
const job2 = await sorobanService.submitTransaction({
  idempotencyKey: key, // Same key!
  contractMethod: 'register_blood',
  args: ['bank-123', 'O+', 100, 1708000000],
});
// Error: "Duplicate submission - idempotency key already exists"
```

## API Reference

### POST /blockchain/submit-transaction
Submit a transaction to the queue.

**Request**:
```json
{
  "contractMethod": "register_blood",
  "args": ["bank-123", "O+", 100, 1708000000],
  "idempotencyKey": "blood-reg-001",
  "maxRetries": 5,
  "metadata": { "userId": "user-123" }
}
```

**Response** (202 Accepted):
```json
{
  "jobId": "blood-reg-001"
}
```

### GET /blockchain/queue/status
Get queue metrics (admin only).

**Headers**:
```
X-Admin-Key: your-admin-key
```

**Response**:
```json
{
  "queueDepth": 5,
  "failedJobs": 2,
  "dlqCount": 1,
  "processingRate": 0.95
}
```

### GET /blockchain/job/:jobId
Get status of a specific job.

**Response**:
```json
{
  "jobId": "blood-reg-001",
  "transactionHash": "tx_abc123...",
  "status": "completed",
  "error": null,
  "retryCount": 0,
  "createdAt": "2024-02-21T10:30:00Z",
  "completedAt": "2024-02-21T10:30:05Z"
}
```

## Troubleshooting

### Redis Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Fix**: Start Redis
```bash
redis-cli ping  # Should return PONG
```

### Queue Not Processing
1. Check Redis: `redis-cli ping`
2. Check logs: `npm run start:dev`
3. Verify processor is registered
4. Restart application

### High DLQ Count
1. Check Stellar RPC endpoint
2. Verify contract arguments
3. Review error logs
4. Check network status

### Duplicate Rejection
Idempotency keys are stored for 7 days. To resubmit:
- Wait 7 days, OR
- Use a new idempotency key

## Testing

### Run Tests
```bash
npm run test -- blockchain
```

### Manual Testing
```bash
# Check queue depth
redis-cli LLEN bull:soroban-tx-queue:wait

# View pending jobs
redis-cli LRANGE bull:soroban-tx-queue:wait 0 -1

# Check DLQ
redis-cli LLEN bull:soroban-dlq:wait

# Clear all (dev only)
redis-cli FLUSHDB
```

## Documentation

- **BLOCKCHAIN_QUEUE.md** - Complete documentation
- **INTEGRATION_GUIDE.md** - Integration steps
- **IMPLEMENTATION_SUMMARY.md** - Architecture overview
- **usage.example.ts** - Code examples

## Next Steps

1. Implement actual Soroban contract calls
2. Set up admin authentication
3. Configure alerting (Slack, email)
4. Add database persistence
5. Set up monitoring dashboards

## Support

For issues:
1. Check logs: `npm run start:dev`
2. Review documentation
3. Run tests: `npm run test -- blockchain`
4. Check Redis: `redis-cli`
