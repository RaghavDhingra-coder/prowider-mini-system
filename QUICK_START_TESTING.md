# Quick Start - Testing Concurrent Lead Allocation

## 🚀 Quick Test (2 minutes)

### Step 1: Start the Application
```bash
npm run dev
```

### Step 2: Open Test Tools
Navigate to: `http://localhost:3000/test-tools`

### Step 3: Reset Provider Quotas
Click: **"Reset Provider Quotas"** button

Wait for success message in logs.

### Step 4: Run Concurrent Test
Click: **"Generate 10 Leads Concurrently"** button

### Step 5: Review Results
Check the logs for:
- ✅ Success count (should be 9-10 out of 10)
- ✅ Retry counts (should be 0-2 per request)
- ✅ Summary statistics

## 📊 What to Look For

### ✅ Good Results
```
Concurrent Test Summary
9 succeeded, 1 failed, 5 total retries
Average retries: 0.56

Lead Request 1
Lead created and assigned successfully

Lead Request 2 (1 retry)
Lead created and assigned successfully after 1 retry

Lead Request 3
Lead created and assigned successfully
```

**Indicators:**
- Success rate: 90-100%
- Average retries: 0-2
- Most requests succeed immediately
- Some requests show retry counts (normal)

### ⚠️ Warning Signs
```
Concurrent Test Summary
6 succeeded, 4 failed, 18 total retries
Average retries: 3.0
```

**Indicators:**
- Success rate: 60-80%
- Average retries: >2
- Many failures

**Action:** Check provider quotas, database connection

### ❌ Critical Issues
```
Concurrent Test Summary
2 succeeded, 8 failed, 24 total retries
Average retries: 12.0
```

**Indicators:**
- Success rate: <50%
- High retry counts
- Most requests failing

**Action:** Check database, provider configuration, quotas

## 🔍 Understanding the Logs

### Success Without Retry
```json
{
  "success": true,
  "message": "Lead created and assigned successfully",
  "retried": false,
  "retryCount": 0,
  "lead": { ... },
  "assignedProviders": [ ... ]
}
```
**Meaning:** Request succeeded on first attempt (ideal)

### Success After Retry
```json
{
  "success": true,
  "message": "Lead created and assigned successfully after 1 retry (transaction conflict resolved)",
  "retried": true,
  "retryCount": 1,
  "lead": { ... },
  "assignedProviders": [ ... ]
}
```
**Meaning:** Request had conflict, retried once, succeeded (normal under load)

### Failure - Quota Exhausted
```json
{
  "success": false,
  "code": "QUOTA_EXHAUSTED",
  "message": "Provider X is already at monthly quota",
  "retried": false,
  "retryCount": 0
}
```
**Meaning:** Provider reached monthly limit (reset quotas to continue testing)

### Failure - Transaction Conflict
```json
{
  "success": false,
  "code": "TRANSACTION_CONFLICT",
  "message": "Allocation failed after 3 retries. High concurrent load detected.",
  "retried": true,
  "retryCount": 3
}
```
**Meaning:** Very high load, all retries exhausted (rare, client should retry)

## 🧪 Advanced Testing

### Test 1: Moderate Load (10 requests)
```bash
# In test-tools page
Click "Generate 10 Leads Concurrently"

Expected:
- Success rate: 95-100%
- Average retries: 0-1
- Time: 1-2 seconds
```

### Test 2: High Load (20 requests via CLI)
```bash
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/leads \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test User '$i'",
      "phone": "555'$(date +%s)$i'",
      "city": "Mumbai",
      "serviceId": "YOUR_SERVICE_ID",
      "description": "Load test"
    }' &
done
wait

Expected:
- Success rate: 90-95%
- Some retries visible in server logs
- Time: 2-4 seconds
```

### Test 3: Stress Test (50 requests)
```bash
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/leads \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test User '$i'",
      "phone": "555'$(date +%s)$i'",
      "city": "Mumbai",
      "serviceId": "YOUR_SERVICE_ID",
      "description": "Stress test"
    }' &
done
wait

Expected:
- Success rate: 85-90%
- Multiple retries common
- Some failures possible (client should retry)
- Time: 5-10 seconds
```

## 📈 Monitoring Server Logs

### Terminal Output to Watch

#### ✅ Normal Operation
```
Allocation: starting assignment { serviceId: '...', serviceName: 'Service 1', phone: '555...' }
Allocation: transaction committed successfully { leadId: '...', assignedProviders: [...] }
```

#### ⚠️ Retry Happening (Normal Under Load)
```
Allocation: retrying after transaction conflict {
  attempt: 1,
  retryCount: 1,
  phone: '555...',
  serviceId: '...',
  delayMs: 87,
  remainingAttempts: 2
}
```

#### ✅ Retry Succeeded
```
Allocation: succeeded after retry { retryCount: 1, phone: '555...', serviceId: '...' }
Allocation: transaction committed successfully { leadId: '...', assignedProviders: [...] }
```

#### ❌ All Retries Exhausted (Rare)
```
Allocation: retrying after transaction conflict { attempt: 3, retryCount: 3, ... }
Create lead error: AllocationError: Allocation failed after retrying transaction conflicts.
```

## 🎯 Success Metrics

### Excellent Performance
- ✅ Success rate: 95-100%
- ✅ Average retries: 0-1
- ✅ Latency: <300ms
- ✅ No quota issues

### Good Performance
- ✅ Success rate: 90-95%
- ✅ Average retries: 1-2
- ✅ Latency: 300-500ms
- ✅ Occasional retries visible

### Acceptable Performance (High Load)
- ⚠️ Success rate: 85-90%
- ⚠️ Average retries: 2-3
- ⚠️ Latency: 500-800ms
- ⚠️ Some failures (client retries)

### Poor Performance (Investigate)
- ❌ Success rate: <85%
- ❌ Average retries: >3
- ❌ Latency: >800ms
- ❌ Many failures

## 🔧 Troubleshooting

### Issue: High Failure Rate

**Check 1: Provider Quotas**
```bash
# Reset quotas in test-tools page
Click "Reset Provider Quotas"
```

**Check 2: Database Connection**
```bash
# Check MongoDB is running
mongosh
# Should connect successfully
```

**Check 3: Service Configuration**
```bash
# Verify services exist
curl http://localhost:3000/api/services
# Should return list of services
```

### Issue: All Requests Failing Immediately

**Check 1: Environment Variables**
```bash
# Verify .env.local has MONGODB_URI
cat .env.local | grep MONGODB_URI
```

**Check 2: Database Seeded**
```bash
# Run seed script
npm run seed
```

**Check 3: Server Running**
```bash
# Check server is running on port 3000
curl http://localhost:3000/api/services
```

### Issue: Slow Response Times

**Check 1: Database Performance**
```bash
# Check MongoDB logs for slow queries
# Look for queries taking >100ms
```

**Check 2: Concurrent Load**
```bash
# Reduce concurrent requests
# Test with 5 instead of 10
```

**Check 3: Retry Settings**
```typescript
// In lib/assignLead.ts
// Reduce retry delays for testing
const RETRY_BASE_DELAYS_MS = [50, 150, 300];
```

## 📚 Next Steps

### Learn More
1. Read `CONCURRENCY_IMPROVEMENTS.md` for detailed explanation
2. Read `RETRY_MECHANISM.md` for retry logic details
3. Read `RETRY_FLOW_DIAGRAM.md` for visual timeline

### Tune Settings
1. Adjust retry delays in `lib/assignLead.ts`
2. Adjust stagger delay in `app/test-tools/page.tsx`
3. Test with different concurrency levels

### Monitor Production
1. Track success rates over time
2. Monitor average retry counts
3. Set up alerts for <90% success rate
4. Review logs for patterns

## ✅ Quick Checklist

Before testing:
- [ ] MongoDB running
- [ ] Application running (`npm run dev`)
- [ ] Database seeded (`npm run seed`)
- [ ] Provider quotas reset

During testing:
- [ ] Open test-tools page
- [ ] Click "Generate 10 Leads Concurrently"
- [ ] Review logs for success/retry counts
- [ ] Check summary statistics

After testing:
- [ ] Success rate >90%
- [ ] Average retries <2
- [ ] No critical errors
- [ ] Database consistent (3 providers per lead)

## 🎉 Expected Results

**First test run:**
```
✅ 9-10 leads created successfully
✅ 0-5 total retries across all requests
✅ Average retries: 0.5-1.0
✅ Time: 1-2 seconds
✅ No errors in server logs
```

**This indicates:**
- ✅ Exponential backoff working
- ✅ Jitter preventing collisions
- ✅ Staggering reducing initial conflicts
- ✅ System handling concurrency well

## 🚨 When to Worry

**If you see:**
- ❌ Success rate <80%
- ❌ Average retries >3
- ❌ Many "QUOTA_EXHAUSTED" errors → Reset quotas
- ❌ Many "TRANSACTION_CONFLICT" errors → Check database
- ❌ "SERVICE_NOT_FOUND" errors → Run seed script

**Action:** Review troubleshooting section above

---

**Ready to test?** Start with Step 1 above! 🚀
