# Retry Configuration - Quick Reference Card

## Current Configuration

```typescript
MAX_TRANSACTION_RETRIES = 10
RETRY_BASE_DELAYS_MS = [100, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800]
JITTER_RANGE_MS = 50
```

## Retry Timeline

| Attempt | Base Delay | With Jitter | Cumulative Min | Cumulative Max |
|---------|-----------|-------------|----------------|----------------|
| 1 | 100ms | 50-150ms | 50ms | 150ms |
| 2 | 200ms | 150-250ms | 200ms | 400ms |
| 3 | 400ms | 350-450ms | 550ms | 850ms |
| 4 | 600ms | 550-650ms | 1100ms | 1500ms |
| 5 | 800ms | 750-850ms | 1850ms | 2350ms |
| 6 | 1000ms | 950-1050ms | 2800ms | 3400ms |
| 7 | 1200ms | 1150-1250ms | 3950ms | 4650ms |
| 8 | 1400ms | 1350-1450ms | 5300ms | 6100ms |
| 9 | 1600ms | 1550-1650ms | 6850ms | 7750ms |
| 10 | 1800ms | 1750-1850ms | 8600ms | 9600ms |

**Total Retry Window:** 8.6 - 9.6 seconds

## Expected Metrics by Load

### Light Load (1-5 concurrent)
```
Success Rate: 100%
Avg Retries: 0-1
Avg Wait: 0-100ms
Max Retries: 1-2
Max Wait: 100-250ms
Latency: 100-300ms
```

### Moderate Load (5-15 concurrent)
```
Success Rate: 99%+
Avg Retries: 1-2
Avg Wait: 100-300ms
Max Retries: 2-4
Max Wait: 300-800ms
Latency: 200-500ms
```

### High Load (15-30 concurrent)
```
Success Rate: 98%+
Avg Retries: 2-4
Avg Wait: 300-800ms
Max Retries: 4-6
Max Wait: 800-2000ms
Latency: 400-1200ms
```

### Very High Load (30-50 concurrent)
```
Success Rate: 95%+
Avg Retries: 3-6
Avg Wait: 800-2000ms
Max Retries: 6-8
Max Wait: 2000-4000ms
Latency: 1000-3000ms
```

### Extreme Load (50+ concurrent)
```
Success Rate: 90%+
Avg Retries: 4-8
Avg Wait: 1500-4000ms
Max Retries: 8-10
Max Wait: 4000-8000ms
Latency: 2000-6000ms
```

## Response Examples

### Success (No Retry)
```json
{
  "success": true,
  "message": "Lead created and assigned successfully",
  "retried": false,
  "retryCount": 0,
  "totalWaitTime": 0,
  "totalTime": 123
}
```

### Success (With Retries)
```json
{
  "success": true,
  "message": "Lead created and assigned successfully after 3 retries (transaction conflict resolved, waited 687ms)",
  "retried": true,
  "retryCount": 3,
  "totalWaitTime": 687,
  "totalTime": 745
}
```

### Failure (After All Retries)
```json
{
  "success": false,
  "code": "TRANSACTION_CONFLICT",
  "message": "Allocation failed after 10 retries (waited 9847ms total). High concurrent load detected. Please try again.",
  "retried": true,
  "retryCount": 10,
  "totalWaitTime": 9847,
  "totalTime": 10123
}
```

## Test Summary Example

```
Concurrent Test Summary
9 succeeded, 1 failed | 12 total retries (avg: 1.33, max: 4) | Average wait time: 234ms (max: 687ms)

Metrics:
{
  "successCount": 9,
  "failureCount": 1,
  "totalRetries": 12,
  "averageRetries": 1.33,
  "maxRetries": 4,
  "totalWaitTime": 2106,
  "averageWaitTime": 234,
  "maxWaitTime": 687
}
```

## Monitoring Thresholds

### ✅ Healthy System
- Success rate: >98%
- Average retries: <3
- Average wait: <500ms
- Max retries: <5

### ⚠️ Warning Signs
- Success rate: 95-98%
- Average retries: 3-5
- Average wait: 500-1500ms
- Max retries: 5-7

### ❌ Critical Issues
- Success rate: <95%
- Average retries: >5
- Average wait: >1500ms
- Max retries: >7

## Tuning Presets

### Preset 1: Low Latency (Fast but less reliable)
```typescript
MAX_TRANSACTION_RETRIES = 5
RETRY_BASE_DELAYS_MS = [50, 100, 200, 400, 600]
JITTER_RANGE_MS = 30
// Total: ~1.5 seconds
// Use when: Latency <500ms required, concurrency <15
```

### Preset 2: Balanced (Current - Recommended)
```typescript
MAX_TRANSACTION_RETRIES = 10
RETRY_BASE_DELAYS_MS = [100, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800]
JITTER_RANGE_MS = 50
// Total: ~10 seconds
// Use when: Production, variable load, 15-50 concurrent
```

### Preset 3: High Reliability (Slow but very reliable)
```typescript
MAX_TRANSACTION_RETRIES = 15
RETRY_BASE_DELAYS_MS = [100, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800]
JITTER_RANGE_MS = 75
// Total: ~20 seconds
// Use when: Critical operations, 50+ concurrent, success rate paramount
```

### Preset 4: Extreme Load (For 100+ concurrent)
```typescript
MAX_TRANSACTION_RETRIES = 12
RETRY_BASE_DELAYS_MS = [150, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300]
JITTER_RANGE_MS = 100
// Total: ~18 seconds
// Use when: Sustained extreme load, 100+ concurrent requests
```

## Log Examples

### Successful Allocation (No Retry)
```
Allocation: attempt started { attempt: 1, retryCount: 0, phone: '555...', serviceId: '...' }
Allocation: transaction committed successfully { leadId: '...', assignedProviders: [...] }
```

### Successful Allocation (With Retries)
```
Allocation: attempt started { attempt: 1, retryCount: 0, phone: '555...', serviceId: '...' }
Allocation: retrying after transaction conflict { attempt: 1, retryCount: 1, delayMs: 123, totalWaitTime: 123, remainingAttempts: 9 }
Allocation: attempt started { attempt: 2, retryCount: 1, phone: '555...', serviceId: '...', totalWaitTime: 123 }
Allocation: retrying after transaction conflict { attempt: 2, retryCount: 2, delayMs: 234, totalWaitTime: 357, remainingAttempts: 8 }
Allocation: attempt started { attempt: 3, retryCount: 2, phone: '555...', serviceId: '...', totalWaitTime: 357 }
Allocation: succeeded after retry { retryCount: 2, phone: '555...', serviceId: '...', totalWaitTime: 357, totalTime: 412 }
Allocation: transaction committed successfully { leadId: '...', assignedProviders: [...] }
```

### Failed Allocation (All Retries Exhausted)
```
Allocation: attempt started { attempt: 1, retryCount: 0, phone: '555...', serviceId: '...' }
... (9 retry attempts with increasing delays) ...
Allocation: attempt started { attempt: 10, retryCount: 9, phone: '555...', serviceId: '...', totalWaitTime: 9234 }
Allocation: transaction aborted { code: 'TRANSACTION_CONFLICT', message: '...', phone: '555...', serviceId: '...' }
Create lead error: AllocationError: Allocation failed after retrying transaction conflicts.
```

## Quick Diagnostic Guide

### Problem: High Failure Rate (>5%)
**Check:**
1. Provider quotas (reset if exhausted)
2. Database connection and performance
3. Concurrent request count
4. Server resources (CPU, memory)

**Solutions:**
- Reset provider quotas
- Increase retry attempts to 15
- Scale database resources
- Add rate limiting

### Problem: High Retry Counts (avg >4)
**Check:**
1. Concurrent load level
2. Database performance
3. Retry delay configuration

**Solutions:**
- Increase retry delays (use Preset 3)
- Scale horizontally (more app instances)
- Optimize database queries
- Consider caching

### Problem: Long Latency (>2 seconds avg)
**Check:**
1. Retry counts and wait times
2. Database query performance
3. Network latency

**Solutions:**
- Reduce retry attempts (use Preset 1)
- Optimize database indexes
- Scale database
- Consider async processing

### Problem: Requests Reaching Max Retries
**Check:**
1. Sustained high concurrency
2. Database bottlenecks
3. Provider quota exhaustion

**Solutions:**
- Increase max retries to 15
- Increase retry delays
- Scale database
- Implement request queuing

## Testing Commands

### Quick Test (10 requests)
```bash
# In browser: http://localhost:3000/test-tools
# Click "Generate 10 Leads Concurrently"
```

### Load Test (20 requests)
```bash
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/leads \
    -H "Content-Type: application/json" \
    -d '{"name":"Test'$i'","phone":"555'$i'","city":"Mumbai","serviceId":"ID","description":"Test"}' &
done
wait
```

### Stress Test (50 requests)
```bash
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/leads \
    -H "Content-Type: application/json" \
    -d '{"name":"Test'$i'","phone":"555'$i'","city":"Mumbai","serviceId":"ID","description":"Test"}' &
done
wait
```

## Key Files

- **Configuration:** `lib/assignLead.ts` (lines 1-30)
- **Retry Logic:** `lib/assignLead.ts` (assignLead function)
- **API Responses:** `app/api/leads/route.ts`
- **Test Tools:** `app/test-tools/page.tsx`

## Quick Reference

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Success Rate | >98% | 95-98% | <95% |
| Avg Retries | <3 | 3-5 | >5 |
| Avg Wait | <500ms | 500-1500ms | >1500ms |
| Max Retries | <5 | 5-7 | >7 |
| Max Wait | <2000ms | 2000-4000ms | >4000ms |

---

**Last Updated:** May 18, 2026  
**Configuration Version:** 2.0 (Enhanced)  
**Status:** Production Ready ✅
