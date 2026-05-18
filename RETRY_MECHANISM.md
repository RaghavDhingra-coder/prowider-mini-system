# Transaction Retry Mechanism - Quick Reference

## Overview
Automatic retry handling for MongoDB transaction conflicts during concurrent lead allocation.

## Retry Strategy

### Exponential Backoff with Jitter
```
Retry 1: 100ms ± 50ms = 50-150ms
Retry 2: 250ms ± 50ms = 200-300ms
Retry 3: 500ms ± 50ms = 450-550ms
```

## Why This Works

### Problem Without Exponential Backoff
```
Time 0ms:    10 requests start
Time 5ms:    All fail with write conflict
Time 55ms:   All retry together → fail again
Time 105ms:  All retry together → fail again
Time 155ms:  All retry together → fail again
Result: Repeated collisions, high failure rate
```

### Solution With Exponential Backoff + Jitter
```
Time 0ms:    10 requests start
Time 5ms:    All fail with write conflict

First retry wave (100ms ± 50ms):
Time 67ms:   Request 1 retries → succeeds
Time 89ms:   Request 2 retries → succeeds
Time 112ms:  Request 3 retries → conflict
Time 134ms:  Request 4 retries → succeeds
Time 148ms:  Request 5 retries → succeeds

Second retry wave (250ms ± 50ms):
Time 362ms:  Request 3 retries → succeeds

Result: Retries spread out, high success rate
```

## Key Benefits

### 1. Exponential Backoff
- **Early retries (100ms)**: Handle transient conflicts quickly
- **Later retries (250ms, 500ms)**: Give persistent conflicts time to resolve
- **Reduces database load**: Fewer repeated collisions

### 2. Randomized Jitter
- **Breaks synchronization**: Prevents all requests from retrying at same time
- **Spreads load**: Retries distributed across time window
- **Prevents thundering herd**: No cascading retry collisions

### 3. Staggered Initial Requests
- **Realistic simulation**: Users don't click at exact same millisecond
- **Reduces initial collisions**: Requests arrive over 0-50ms window
- **Better retry effectiveness**: Less contention from the start

## Configuration

### Current Settings
```typescript
// lib/assignLead.ts
const MAX_TRANSACTION_RETRIES = 3;
const RETRY_BASE_DELAYS_MS = [100, 250, 500];
const JITTER_RANGE_MS = 50;
```

### Test Tools Settings
```typescript
// app/test-tools/page.tsx
const staggerDelay = Math.random() * 50; // 0-50ms
```

## When to Adjust

### Higher Concurrency (30+ requests)
Increase retry attempts and delays:
```typescript
const MAX_TRANSACTION_RETRIES = 4;
const RETRY_BASE_DELAYS_MS = [100, 250, 500, 1000];
const JITTER_RANGE_MS = 75;
```

### Lower Latency Priority
Reduce delays (may increase failures):
```typescript
const MAX_TRANSACTION_RETRIES = 3;
const RETRY_BASE_DELAYS_MS = [50, 150, 300];
const JITTER_RANGE_MS = 30;
```

### Very High Load (50+ req/sec)
Increase all parameters:
```typescript
const MAX_TRANSACTION_RETRIES = 5;
const RETRY_BASE_DELAYS_MS = [150, 300, 600, 1200, 2400];
const JITTER_RANGE_MS = 100;
```

## Expected Performance

| Concurrency | Success Rate | Avg Retries | Latency |
|-------------|--------------|-------------|---------|
| 1-3 requests | 100% | 0 | 100-200ms |
| 5-10 requests | 99%+ | 0-2 | 150-350ms |
| 15-25 requests | 95-98% | 1-3 | 200-600ms |
| 30+ requests | 90-95% | 2-3 | 300-800ms |

## Monitoring

### Success Indicators
- `Allocation: transaction committed successfully`
- `Allocation: succeeded after retry`
- Response: `"retried": true, "retryCount": 1`

### Expected Warnings (Normal)
- `Allocation: retrying after transaction conflict`
- `delayMs: 87` (first retry ~100ms)
- `delayMs: 273` (second retry ~250ms)

### Failure Indicators (Investigate)
- `Allocation failed after 3 retries`
- High retry counts (>2 average)
- Success rate <90%

## Testing

### Quick Test (Test Tools Page)
1. Go to `/test-tools`
2. Click "Generate 10 Leads Concurrently"
3. Check summary: success count, retry count, average retries

### Load Test (CLI)
```bash
# 20 concurrent requests
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/leads \
    -H "Content-Type: application/json" \
    -d '{"name":"Test'$i'","phone":"555'$i'","city":"Mumbai","serviceId":"ID","description":"Test"}' &
done
wait
```

## Troubleshooting

### High Failure Rate (>10%)
**Possible causes:**
- Too many concurrent requests for current settings
- Provider quotas exhausted
- Database performance issues

**Solutions:**
- Increase retry attempts and delays
- Check provider quotas
- Monitor database performance
- Consider horizontal scaling

### High Retry Counts (>2 average)
**Possible causes:**
- Sustained high concurrency
- Delays too short for load level

**Solutions:**
- Increase base delays: `[150, 300, 600]`
- Increase jitter: `JITTER_RANGE_MS = 75`
- Add more retry attempts

### Slow Response Times (>1 second)
**Possible causes:**
- Multiple retries happening
- High database load

**Solutions:**
- This is expected under very high load
- Consider rate limiting at API level
- Scale database if sustained

## Implementation Details

### Retry Logic Flow
```typescript
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    // Attempt transaction
    return await assignLeadOnce(data);
  } catch (error) {
    if (isTransientError && !isLastAttempt) {
      // Calculate delay with jitter
      const delay = getRetryDelay(retryCount);
      // Wait before retry
      await sleep(delay);
      // Loop continues to next attempt
    } else {
      // Non-retriable error or last attempt
      throw error;
    }
  }
}
```

### Jitter Calculation
```typescript
function getRetryDelay(retryCount: number): number {
  const baseDelay = RETRY_BASE_DELAYS_MS[retryCount - 1];
  const jitter = (Math.random() - 0.5) * 2 * JITTER_RANGE_MS;
  return Math.max(baseDelay + jitter, 10);
}
```

**Example:**
- `retryCount = 1`
- `baseDelay = 100ms`
- `jitter = (0.7 - 0.5) * 2 * 50 = 20ms`
- `totalDelay = 100 + 20 = 120ms`

## Best Practices

1. ✅ **Monitor retry metrics** - Track success rate and retry counts
2. ✅ **Adjust based on load** - Tune settings for your traffic patterns
3. ✅ **Test under load** - Use test tools to verify behavior
4. ✅ **Log retry attempts** - Keep detailed logs for debugging
5. ✅ **Set reasonable limits** - Don't retry forever (3-5 attempts max)
6. ✅ **Use exponential backoff** - Linear backoff doesn't work well
7. ✅ **Add jitter** - Prevents synchronized retries
8. ✅ **Keep transactions minimal** - Reduce conflict probability
9. ✅ **Use atomic operations** - Reduce transaction scope
10. ✅ **Document behavior** - Help future developers understand

## Related Files

- `lib/assignLead.ts` - Retry implementation
- `app/api/leads/route.ts` - API endpoint with retry handling
- `app/test-tools/page.tsx` - Concurrent testing tool
- `CONCURRENCY_IMPROVEMENTS.md` - Detailed documentation
