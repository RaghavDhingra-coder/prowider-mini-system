# Transaction Retry Flow - Visual Guide

## Scenario: 10 Concurrent Lead Requests

### Timeline Visualization

```
TIME    REQUEST FLOW                                    DATABASE STATE
────────────────────────────────────────────────────────────────────────────

0ms     [R1] [R2] [R3] [R4] [R5] [R6] [R7] [R8] [R9] [R10]
        ↓ Staggered start (0-50ms random delays)
        
12ms    [R1] Start transaction
        [R2] Start transaction (12ms delay)
        
28ms    [R3] Start transaction (28ms delay)
        
35ms    [R1] Read allocation state: currentIndex=5      currentIndex: 5
        [R1] Select providers, increment quotas
        
40ms    [R2] Read allocation state: currentIndex=5      currentIndex: 5
        [R2] Select providers, increment quotas
        [R4] Start transaction (40ms delay)
        
45ms    [R1] Update allocation state: currentIndex=6
        [R1] ✅ COMMIT SUCCESS                          currentIndex: 6
        
48ms    [R2] Try update allocation state
        [R2] ❌ WRITE CONFLICT (state changed 5→6)
        [R2] Abort transaction
        [R2] Schedule retry in 87ms (100ms - 13ms jitter)
        
50ms    [R3] Read allocation state: currentIndex=6      currentIndex: 6
        [R3] Select providers, increment quotas
        [R5] Start transaction (50ms delay)
        
55ms    [R3] Update allocation state: currentIndex=7
        [R3] ✅ COMMIT SUCCESS                          currentIndex: 7
        
60ms    [R4] Read allocation state: currentIndex=7      currentIndex: 7
        [R4] Select providers, increment quotas
        
65ms    [R4] Update allocation state: currentIndex=8
        [R4] ✅ COMMIT SUCCESS                          currentIndex: 8
        
70ms    [R5] Read allocation state: currentIndex=8      currentIndex: 8
        [R5] Select providers, increment quotas
        [R6] Start transaction
        
75ms    [R5] Update allocation state: currentIndex=9
        [R5] ✅ COMMIT SUCCESS                          currentIndex: 9
        
80ms    [R6] Read allocation state: currentIndex=9      currentIndex: 9
        [R6] Select providers, increment quotas
        [R7] Start transaction
        
85ms    [R6] Update allocation state: currentIndex=10
        [R6] ✅ COMMIT SUCCESS                          currentIndex: 10
        
90ms    [R7] Read allocation state: currentIndex=10     currentIndex: 10
        [R7] Select providers, increment quotas
        [R8] Start transaction
        
95ms    [R7] Update allocation state: currentIndex=11
        [R7] ✅ COMMIT SUCCESS                          currentIndex: 11
        
100ms   [R8] Read allocation state: currentIndex=11     currentIndex: 11
        [R8] Select providers, increment quotas
        [R9] Start transaction
        
105ms   [R8] Update allocation state: currentIndex=12
        [R8] ✅ COMMIT SUCCESS                          currentIndex: 12
        
110ms   [R9] Read allocation state: currentIndex=12     currentIndex: 12
        [R9] Select providers, increment quotas
        [R10] Start transaction
        
115ms   [R9] Update allocation state: currentIndex=13
        [R9] ✅ COMMIT SUCCESS                          currentIndex: 13
        
120ms   [R10] Read allocation state: currentIndex=13    currentIndex: 13
        [R10] Select providers, increment quotas
        
125ms   [R10] Update allocation state: currentIndex=14
        [R10] ✅ COMMIT SUCCESS                         currentIndex: 14
        
135ms   [R2] RETRY #1 (after 87ms wait)
        [R2] Start new transaction
        [R2] Read allocation state: currentIndex=14     currentIndex: 14
        [R2] Select providers, increment quotas
        
140ms   [R2] Update allocation state: currentIndex=15
        [R2] ✅ COMMIT SUCCESS (after 1 retry)          currentIndex: 15

────────────────────────────────────────────────────────────────────────────
RESULT: All 10 requests succeeded
        - 9 requests: 0 retries (succeeded immediately)
        - 1 request: 1 retry (succeeded after 87ms wait)
        - Total time: ~140ms
        - Success rate: 100%
```

## Comparison: Without vs With Exponential Backoff

### ❌ WITHOUT EXPONENTIAL BACKOFF (Linear 50ms delays)

```
TIME    REQUESTS                                        OUTCOME
────────────────────────────────────────────────────────────────────

0ms     [R1-R10] All start simultaneously
5ms     [R1] Commits, [R2-R10] Write conflict          1 success
55ms    [R2-R10] All retry together                    
60ms    [R2] Commits, [R3-R10] Write conflict          2 success
110ms   [R3-R10] All retry together
115ms   [R3] Commits, [R4-R10] Write conflict          3 success
165ms   [R4-R10] All retry together
170ms   [R4] Commits, [R5-R10] Write conflict          4 success
        [R5-R10] Exhausted retries → FAIL              6 FAILURES

Result: 40% success rate, repeated collisions
```

### ✅ WITH EXPONENTIAL BACKOFF + JITTER

```
TIME    REQUESTS                                        OUTCOME
────────────────────────────────────────────────────────────────────

0ms     [R1-R10] Start with 0-50ms stagger
5ms     [R1-R3] Start transactions
10ms    [R1] Commits                                   1 success
15ms    [R2-R3] Write conflict
        [R4-R6] Start transactions
20ms    [R4] Commits                                   2 success
25ms    [R5-R6] Write conflict
        [R7-R8] Start transactions
30ms    [R7] Commits                                   3 success
        [R9-R10] Start transactions

--- First retry wave (100ms ± 50ms) ---
115ms   [R2] Retry → Commits                           4 success
128ms   [R5] Retry → Commits                           5 success
142ms   [R3] Retry → Commits                           6 success
156ms   [R6] Retry → Commits                           7 success
35ms    [R8] Commits                                   8 success
40ms    [R9] Commits                                   9 success
45ms    [R10] Commits                                  10 success

Result: 100% success rate, retries spread out
```

## Retry Decision Tree

```
┌─────────────────────────────────────┐
│   Start Transaction Attempt        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Execute Lead Allocation           │
│   - Create lead                     │
│   - Select providers                │
│   - Update quotas                   │
│   - Update allocation state         │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  Success?    │
        └──┬────────┬──┘
           │        │
          YES       NO
           │        │
           ▼        ▼
    ┌──────────┐  ┌─────────────────────┐
    │ Return   │  │ Check Error Type    │
    │ Result   │  └──────┬──────────────┘
    └──────────┘         │
                         ▼
                  ┌──────────────┐
                  │ Transient?   │
                  └──┬────────┬──┘
                     │        │
                    YES       NO
                     │        │
                     ▼        ▼
            ┌────────────────┐  ┌──────────────┐
            │ Retry Count    │  │ Throw Error  │
            │ < 3?           │  │ (Quota,      │
            └──┬────────┬────┘  │  Duplicate,  │
               │        │        │  etc.)       │
              YES       NO       └──────────────┘
               │        │
               ▼        ▼
    ┌──────────────────┐  ┌──────────────────┐
    │ Wait with        │  │ Throw Error      │
    │ Exponential      │  │ (Max retries     │
    │ Backoff + Jitter │  │  exhausted)      │
    │                  │  └──────────────────┘
    │ Retry 1: ~100ms  │
    │ Retry 2: ~250ms  │
    │ Retry 3: ~500ms  │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Loop back to     │
    │ Start Transaction│
    └──────────────────┘
```

## Jitter Effect Visualization

### Without Jitter (All retry at same time)
```
Failed Requests: [R1] [R2] [R3] [R4] [R5]
                  ↓    ↓    ↓    ↓    ↓
Wait 100ms:      100  100  100  100  100
                  ↓    ↓    ↓    ↓    ↓
Retry at:        100ms ← All collide again!
```

### With Jitter (Retries spread out)
```
Failed Requests: [R1] [R2] [R3] [R4] [R5]
                  ↓    ↓    ↓    ↓    ↓
Wait 100ms±50:   87   124  103  145  91
                  ↓    ↓    ↓    ↓    ↓
Retry at:        87ms 124ms 103ms 145ms 91ms
                  ↓         ↓         ↓
                  ✅        ✅        ✅
                       ↓         ↓
                       ✅        ✅
                       
Result: Retries spread across 58ms window (87-145ms)
```

## Exponential Backoff Progression

```
Attempt 1: Initial transaction
           ↓
           ❌ Conflict
           ↓
           Wait ~100ms (50-150ms)
           ↓
Attempt 2: Retry with fresh data
           ↓
           ❌ Conflict (persistent contention)
           ↓
           Wait ~250ms (200-300ms) ← Longer wait
           ↓
Attempt 3: Retry with fresh data
           ↓
           ❌ Conflict (very high load)
           ↓
           Wait ~500ms (450-550ms) ← Even longer
           ↓
Attempt 4: Final retry with fresh data
           ↓
           ✅ Success (or fail permanently)
```

## Load Distribution Over Time

### High Concurrency Scenario (20 requests)

```
REQUESTS PER 50ms WINDOW

Without stagger + jitter:
0-50ms:   ████████████████████ (20 requests)
50-100ms: ████████████████████ (20 retries - all collide)
100-150ms:████████████████████ (20 retries - all collide)
150-200ms:████████████████████ (20 retries - all collide)

With stagger + jitter:
0-50ms:   ████████████████████ (20 requests, staggered)
50-100ms: ████████ (8 retries, spread out)
100-150ms:████ (4 retries, spread out)
150-200ms:██ (2 retries, spread out)
200-250ms:█ (1 retry)
250-300ms:█ (1 retry)

Result: Load distributed over time, fewer collisions
```

## Key Takeaways

1. **Staggering initial requests** (0-50ms) reduces initial collisions
2. **Exponential backoff** (100→250→500ms) gives transactions time to complete
3. **Jitter** (±50ms) prevents synchronized retries
4. **Combined effect**: High success rate even under heavy load
5. **Graceful degradation**: System remains stable as load increases

## Real-World Example

**Scenario:** 15 users submit leads within 2 seconds

```
Without improvements:
- All requests hit database simultaneously
- Repeated collisions on every retry
- 40-60% success rate
- Users see errors, retry manually
- Database under heavy load

With improvements:
- Requests naturally staggered (human timing)
- Conflicts resolved by exponential backoff
- 95-100% success rate
- Users see success messages
- Database load distributed over time
```

## Monitoring Checklist

✅ **Success indicators:**
- Most requests succeed on first attempt
- Retries are infrequent (0-2 per request)
- Success rate >95%
- Average latency <500ms

⚠️ **Warning signs:**
- Average retries >2
- Success rate 85-95%
- Latency 500-1000ms
- Consider tuning settings

❌ **Critical issues:**
- Success rate <85%
- Average retries >3
- Latency >1000ms
- Investigate immediately (quotas, database, load)
