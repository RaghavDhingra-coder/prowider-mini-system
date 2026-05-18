import mongoose from "mongoose";
import AllocationState from "../models/AllocationState";
import Lead from "../models/Lead";
import LeadAssignment from "../models/LeadAssignment";
import Provider from "../models/Provider";
import Service from "../models/Service";

const REQUIRED_PROVIDER_COUNT = 3;

// Transaction retry configuration:
// When multiple requests try to allocate leads simultaneously, MongoDB may encounter
// write conflicts on shared documents (providers, allocation state). These are transient
// errors that can be resolved by retrying the entire transaction.
//
// Increased retry attempts (10) ensure requests wait for conflicting transactions to complete
// instead of failing prematurely. Under high concurrency, some transactions may need
// multiple retries before finding a clear window to commit.
const MAX_TRANSACTION_RETRIES = 10;

// Stronger exponential backoff configuration:
// Each retry waits progressively longer, giving conflicting transactions ample time to complete.
// This prevents premature failures under sustained high concurrency.
//
// Retry delays (base values before jitter):
// Retry 1: 100ms   - Quick retry for transient conflicts
// Retry 2: 200ms   - Double wait for persistent contention
// Retry 3: 400ms   - Quadruple wait for high load
// Retry 4: 600ms   - Continue increasing for very high load
// Retry 5: 800ms   - Even longer wait
// Retry 6: 1000ms  - 1 second wait
// Retry 7: 1200ms  - Continue gradual increase
// Retry 8: 1400ms  - Sustained high load handling
// Retry 9: 1600ms  - Near-maximum wait
// Retry 10: 1800ms - Final attempt with longest wait
//
// Total possible retry time: ~10 seconds across all retries
// This ensures requests don't fail prematurely while maintaining reasonable latency.
const RETRY_BASE_DELAYS_MS = [100, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800];
const JITTER_RANGE_MS = 50; // ±50ms randomization to prevent synchronized retries

class AllocationError extends Error {
  code: string;
  retryCount?: number;
  retried?: boolean;
  totalWaitTime?: number;
  totalTime?: number;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AllocationError";
    this.code = code;
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detects MongoDB transient transaction errors that are safe to retry.
 * 
 * Why conflicts happen:
 * - Multiple requests update the same provider documents (incrementing leadsReceived)
 * - Multiple requests update the same allocation state (updating currentIndex)
 * - MongoDB's optimistic concurrency control detects these write conflicts
 * 
 * These errors are transient and typically resolve on retry because:
 * - One transaction completes and releases locks
 * - The retry reads fresh data and can proceed
 * - Round robin naturally distributes load across different providers
 */
function isTransientTransactionError(error: any): boolean {
  const message = error?.message || "";

  return (
    // MongoDB's official transient error labels
    error?.errorLabels?.includes("TransientTransactionError") ||
    error?.errorLabels?.includes("UnknownTransactionCommitResult") ||
    // WriteConflict error code (concurrent updates to same document)
    error?.code === 112 ||
    // String-based detection for write conflicts
    message.includes("WriteConflict") ||
    message.includes("write conflict")
  );
}

/**
 * Calculates retry delay with exponential backoff and randomized jitter.
 * 
 * Why exponential backoff helps:
 * - Early retries happen quickly (100-200ms) for transient conflicts
 * - Later retries wait much longer (800-1800ms) for persistent contention
 * - Gives conflicting transactions ample time to complete and release locks
 * - Reduces database load during sustained high concurrency periods
 * - Prevents premature failures when system is under heavy load
 * 
 * Why jitter reduces repeated collisions:
 * - Without jitter: 10 requests fail → all wait 100ms → all retry at same time → collide again
 * - With jitter: 10 requests fail → wait 50-150ms (randomized) → retries spread out → less collision
 * - Jitter breaks synchronization between concurrent requests
 * - Each request wakes at slightly different time, reducing thundering herd
 * 
 * Example delays with jitter:
 * - Retry 1: 50-150ms (100ms ± 50ms jitter)
 * - Retry 2: 150-250ms (200ms ± 50ms jitter)
 * - Retry 3: 350-450ms (400ms ± 50ms jitter)
 * - Retry 4: 550-650ms (600ms ± 50ms jitter)
 * - Retry 5: 750-850ms (800ms ± 50ms jitter)
 * - Retry 6: 950-1050ms (1000ms ± 50ms jitter)
 * - Retry 7: 1150-1250ms (1200ms ± 50ms jitter)
 * - Retry 8: 1350-1450ms (1400ms ± 50ms jitter)
 * - Retry 9: 1550-1650ms (1600ms ± 50ms jitter)
 * - Retry 10: 1750-1850ms (1800ms ± 50ms jitter)
 * 
 * Total retry window: ~50ms to ~10 seconds
 * This ensures requests wait for conflicting transactions instead of failing prematurely.
 */
function getRetryDelay(retryCount: number): number {
  // Get base delay for this retry attempt (1-indexed)
  const baseDelay = RETRY_BASE_DELAYS_MS[retryCount - 1] || RETRY_BASE_DELAYS_MS[RETRY_BASE_DELAYS_MS.length - 1];
  
  // Add randomized jitter: ±JITTER_RANGE_MS
  // Math.random() returns [0, 1), so (Math.random() - 0.5) returns [-0.5, 0.5)
  const jitter = (Math.random() - 0.5) * 2 * JITTER_RANGE_MS;
  
  const totalDelay = baseDelay + jitter;
  
  // Ensure delay is always positive
  return Math.max(totalDelay, 10);
}

/**
 * Service allocation rules define which providers are assigned to each service.
 * 
 * - mandatory: Always included first (e.g., specialized providers)
 * - pool: Round-robin selection fills remaining slots
 * 
 * This separation reduces conflicts because:
 * - Mandatory providers are checked once upfront
 * - Round robin distributes pool providers across concurrent requests
 * - Different services use different provider pools
 */
const SERVICE_RULES: Record<
  string,
  {
    mandatory: string[];
    pool: string[];
  }
> = {
  "Service 1": {
    mandatory: ["Provider 1"],
    pool: ["Provider 2", "Provider 3", "Provider 4"],
  },
  "Service 2": {
    mandatory: ["Provider 5"],
    pool: ["Provider 6", "Provider 7", "Provider 8"],
  },
  "Service 3": {
    mandatory: ["Provider 1", "Provider 4"],
    pool: ["Provider 2", "Provider 3", "Provider 5", "Provider 6", "Provider 7", "Provider 8"],
  },
};

/**
 * Sorts providers to match the requested name order.
 * This ensures consistent provider ordering across retries.
 */
function sortProvidersByNames(providers: any[], names: string[]) {
  return names
    .map((name) => providers.find((provider) => provider.name === name))
    .filter(Boolean);
}

/**
 * Logs provider details for debugging concurrent allocation scenarios.
 */
function logProviderList(label: string, providers: any[]) {
  console.log(
    label,
    providers.map((provider) => ({
      id: String(provider._id),
      name: provider.name,
      leadsReceived: provider.leadsReceived,
      monthlyQuota: provider.monthlyQuota,
    }))
  );
}

/**
 * Validates that no provider appears twice in the assignment.
 * This prevents duplicate provider assignments which would violate business rules.
 */
function ensureUniqueProviders(providers: any[]): boolean {
  const providerIds = providers.map((provider) => String(provider._id));
  return new Set(providerIds).size === providerIds.length;
}

/**
 * Selects providers using round-robin allocation with quota awareness.
 * 
 * How consistency is preserved:
 * - Reads current allocation state within transaction
 * - Selects providers based on saved index
 * - Updates allocation state atomically in same transaction
 * - If transaction fails, state is rolled back and retry uses fresh data
 * 
 * Why conflicts happen here:
 * - Multiple requests may read the same currentIndex
 * - Both try to update allocation state with different nextIndex values
 * - MongoDB detects the conflict and one transaction must retry
 * 
 * Round robin fairness is maintained because:
 * - Only committed transactions update the index
 * - Retries read the updated index and continue from there
 * - Over time, all providers receive equal distribution
 */
function pickRoundRobinProviders(poolProviders: any[], currentIndex: number, count: number) {
  if (!poolProviders.length || count === 0) {
    return {
      selectedProviders: [],
      nextIndex: currentIndex,
    };
  }

  const selectedProviders = [];
  const skippedProviders = [];
  const startIndex = currentIndex % poolProviders.length;
  let lastVisitedOffset = -1;

  // Round robin walks through providers in a fixed order, skipping those at quota.
  // The next index is persisted so rotation continues correctly across requests and restarts.
  for (let offset = 0; offset < poolProviders.length; offset += 1) {
    const provider = poolProviders[(startIndex + offset) % poolProviders.length];
    lastVisitedOffset = offset;

    console.log("Allocation: round robin quota check", {
      provider: provider.name,
      leadsReceived: provider.leadsReceived,
      monthlyQuota: provider.monthlyQuota,
      hasCapacity: provider.leadsReceived < provider.monthlyQuota,
    });

    if (provider.leadsReceived < provider.monthlyQuota) {
      selectedProviders.push(provider);
    } else {
      skippedProviders.push(provider.name);
    }

    if (selectedProviders.length === count) {
      break;
    }
  }

  if (selectedProviders.length < count) {
    console.error("Allocation: insufficient pool providers", {
      selectedProviders: selectedProviders.map((provider) => provider.name),
      skippedProviders,
      requiredCount: count,
    });

    throw new AllocationError(
      "NOT_ENOUGH_PROVIDERS",
      "Not enough providers available for allocation"
    );
  }

  const nextIndex = (startIndex + lastVisitedOffset + 1) % poolProviders.length;

  console.log("Allocation: round robin selection", {
    startIndex,
    nextIndex,
    selectedProviders: selectedProviders.map((provider) => provider.name),
    skippedProviders,
  });

  return {
    selectedProviders,
    nextIndex,
  };
}

/**
 * Gets or creates allocation state for a service within a transaction.
 * 
 * Uses findOneAndUpdate with upsert to atomically create state if missing.
 * This prevents duplicate state documents when multiple requests start simultaneously.
 */
async function getAllocationState(serviceId: string, session: mongoose.ClientSession) {
  const allocationState = await AllocationState.findOneAndUpdate(
    { serviceId },
    {
      $setOnInsert: {
        serviceId,
        currentIndex: 0,
      },
    },
    {
      new: true,
      upsert: true,
      session,
    }
  );

  if (!allocationState) {
    throw new AllocationError("ALLOCATION_STATE_NOT_FOUND", "Failed to load allocation state");
  }

  return allocationState;
}

/**
 * Fetches providers by name within a transaction.
 * Results are sorted to match the requested name order for consistency.
 */
async function getProviders(names: string[], session: mongoose.ClientSession) {
  const providers = await Provider.find({
    name: { $in: names },
  }).session(session);

  return sortProvidersByNames(providers, names);
}

/**
 * Atomically increments provider lead count with quota protection.
 * 
 * How quota protection works:
 * - Query condition checks leadsReceived < monthlyQuota
 * - Update increments leadsReceived by 1
 * - If quota was reached between read and write, update returns null
 * - This prevents quota overflow even under high concurrency
 * 
 * Why this reduces conflicts:
 * - Uses atomic $inc operation (single write)
 * - No separate read-then-write cycle
 * - MongoDB handles the increment internally
 */
async function incrementProviderLeadCount(provider: any, session: mongoose.ClientSession) {
  const updatedProvider = await Provider.findOneAndUpdate(
    {
      _id: provider._id,
      leadsReceived: { $lt: provider.monthlyQuota },
    },
    {
      $inc: { leadsReceived: 1 },
    },
    {
      new: true,
      session,
    }
  );

  if (!updatedProvider) {
    throw new AllocationError(
      "QUOTA_EXHAUSTED",
      `${provider.name} is already at monthly quota`
    );
  }

  return updatedProvider;
}

/**
 * Performs a single lead allocation attempt within a MongoDB transaction.
 * 
 * Transaction scope includes:
 * - Lead creation
 * - Provider selection (mandatory + round robin)
 * - Provider quota updates (atomic increments)
 * - Lead-provider assignments
 * - Allocation state update (round robin index)
 * 
 * All operations succeed together or fail together, ensuring consistency.
 * 
 * Why conflicts happen:
 * - Multiple concurrent requests update the same providers
 * - Multiple requests update the same allocation state
 * - MongoDB detects write conflicts and aborts one transaction
 * 
 * The retry wrapper (assignLead) handles these transient failures.
 */
async function assignLeadOnce(data: {
  name: string;
  phone: string;
  city: string;
  serviceId: string;
  description: string;
}) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const service = await Service.findById(data.serviceId).session(session);

    if (!service) {
      throw new AllocationError("SERVICE_NOT_FOUND", "Selected service was not found");
    }

    const serviceRule = SERVICE_RULES[service.name];

    if (!serviceRule) {
      throw new AllocationError("RULE_NOT_FOUND", "No allocation rule found for this service");
    }

    console.log("Allocation: starting assignment", {
      serviceId: data.serviceId,
      serviceName: service.name,
      phone: data.phone,
    });

    // Step 1: Load and validate mandatory providers
    // Mandatory providers must always be included first for each service.
    const mandatoryProviders = await getProviders(serviceRule.mandatory, session);
    logProviderList("Allocation: mandatory providers loaded", mandatoryProviders);

    if (mandatoryProviders.length !== serviceRule.mandatory.length) {
      throw new AllocationError(
        "MANDATORY_PROVIDERS_MISSING",
        "Mandatory providers are missing in the database"
      );
    }

    const availableMandatoryProviders = mandatoryProviders.filter(
      (provider) => provider.leadsReceived < provider.monthlyQuota
    );

    if (availableMandatoryProviders.length !== mandatoryProviders.length) {
      console.error("Allocation: mandatory provider quota failure", {
        mandatoryProviders: mandatoryProviders.map((provider) => ({
          name: provider.name,
          leadsReceived: provider.leadsReceived,
          monthlyQuota: provider.monthlyQuota,
        })),
      });

      throw new AllocationError(
        "QUOTA_EXHAUSTED",
        "A mandatory provider is already at monthly quota"
      );
    }

    // Step 2: Load pool providers for round-robin selection
    const poolProviders = await getProviders(serviceRule.pool, session);
    logProviderList("Allocation: round robin pool loaded", poolProviders);

    if (poolProviders.length !== serviceRule.pool.length) {
      throw new AllocationError(
        "POOL_PROVIDERS_MISSING",
        "Some round robin providers are missing in the database"
      );
    }

    // Step 3: Get allocation state and select round-robin providers
    const allocationState = await getAllocationState(String(service._id), session);
    const poolCountNeeded = REQUIRED_PROVIDER_COUNT - mandatoryProviders.length;

    if (poolCountNeeded < 0) {
      throw new AllocationError("INVALID_RULE", "Invalid provider rule configuration");
    }

    // Round robin always starts from the saved currentIndex so allocation
    // continues correctly even after a server restart or transaction retry.
    const { selectedProviders: roundRobinProviders, nextIndex } = pickRoundRobinProviders(
      poolProviders,
      allocationState.currentIndex,
      poolCountNeeded
    );

    const selectedProviders = [...mandatoryProviders, ...roundRobinProviders];

    console.log("Allocation: selected providers before increment", {
      selectedProviders: selectedProviders.map((provider) => provider.name),
      mandatoryProviders: mandatoryProviders.map((provider) => provider.name),
      roundRobinProviders: roundRobinProviders.map((provider) => provider.name),
    });

    if (selectedProviders.length !== REQUIRED_PROVIDER_COUNT) {
      throw new AllocationError("NOT_ENOUGH_PROVIDERS", "Exactly 3 providers must be assigned");
    }

    if (!ensureUniqueProviders(selectedProviders)) {
      throw new AllocationError(
        "DUPLICATE_ASSIGNMENT",
        "Duplicate provider assignment detected for this lead"
      );
    }

    // Step 4: Create lead document
    // Using create() within transaction ensures lead is only persisted if entire transaction succeeds
    const [lead] = await Lead.create(
      [
        {
          name: data.name,
          phone: data.phone,
          city: data.city,
          serviceId: data.serviceId,
          description: data.description,
        },
      ],
      { session }
    );

    // Step 5: Atomically increment provider quotas
    // Each increment is conditional on quota availability, preventing overflow
    const assignedProviders = [];

    for (const provider of selectedProviders) {
      // This conditional increment prevents quota overflow when multiple
      // requests try to assign the same provider at the same time.
      const updatedProvider = await incrementProviderLeadCount(provider, session);
      assignedProviders.push(updatedProvider);
    }

    // Step 6: Create lead-provider assignments
    await LeadAssignment.insertMany(
      assignedProviders.map((provider) => ({
        leadId: lead._id,
        providerId: provider._id,
      })),
      { session }
    );

    // Step 7: Update allocation state for next round-robin selection
    if (poolCountNeeded > 0) {
      // The allocation state is updated inside the same transaction so the
      // saved pointer always matches the providers that were actually chosen.
      // 
      // Optimistic concurrency: We check that currentIndex hasn't changed.
      // If another transaction updated it, this update fails and transaction retries.
      const updatedAllocationState = await AllocationState.findOneAndUpdate(
        {
          _id: allocationState._id,
          currentIndex: allocationState.currentIndex,
        },
        { currentIndex: nextIndex },
        { session, new: true }
      );

      if (!updatedAllocationState) {
        throw new AllocationError(
          "TRANSACTION_CONFLICT",
          "Allocation state changed during this request. Please try again."
        );
      }
    }

    await session.commitTransaction();

    console.log("Allocation: transaction committed successfully", {
      leadId: lead._id,
      assignedProviders: assignedProviders.map((p) => p.name),
    });

    return {
      lead,
      assignedProviders,
    };
  } catch (error: any) {
    await session.abortTransaction();

    console.error("Allocation: transaction aborted", {
      code: error?.code,
      message: error?.message,
      labels: error?.errorLabels,
      phone: data.phone,
      serviceId: data.serviceId,
    });

    // Convert transient MongoDB errors to retriable allocation errors
    if (isTransientTransactionError(error)) {
      throw new AllocationError(
        "TRANSACTION_CONFLICT",
        "A transaction conflict occurred during allocation. Please try again."
      );
    }

    // Handle duplicate key errors with specific context
    if (error?.code === 11000) {
      if (error?.keyPattern?.phone && error?.keyPattern?.serviceId) {
        throw new AllocationError(
          "DUPLICATE_LEAD",
          "A lead with this phone number already exists for the selected service"
        );
      }

      if (error?.keyPattern?.leadId && error?.keyPattern?.providerId) {
        throw new AllocationError(
          "DUPLICATE_ASSIGNMENT",
          "Duplicate provider assignment detected for this lead"
        );
      }

      if (error?.keyPattern?.serviceId) {
        throw new AllocationError(
          "TRANSACTION_CONFLICT",
          "Allocation state already exists for this service"
        );
      }
    }

    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Assigns a lead to providers with automatic retry on transaction conflicts.
 * 
 * How retry mechanism works:
 * 1. Attempts allocation in a MongoDB transaction
 * 2. If transient error occurs (write conflict), waits with exponential backoff
 * 3. Retries up to MAX_TRANSACTION_RETRIES times (10 attempts)
 * 4. Each retry reads fresh data, so it sees updates from other completed transactions
 * 
 * How consistency is preserved:
 * - All operations happen in a single transaction (atomic)
 * - Failed transactions are rolled back completely
 * - Successful transactions commit all changes together
 * - Retries use fresh data from the database
 * - Quota checks are conditional (prevent overflow)
 * - Duplicate checks use unique indexes (prevent duplicates)
 * 
 * Why this is safe for concurrent requests:
 * - MongoDB's transaction isolation ensures one transaction sees consistent data
 * - Write conflicts are detected automatically by MongoDB
 * - Retry with fresh data resolves most conflicts
 * - Business rules (quotas, uniqueness) are enforced at database level
 * - Round robin fairness is maintained through transactional state updates
 * 
 * Why 10 retries with strong backoff:
 * - Under high concurrency, some requests need multiple attempts
 * - Longer waits (up to 1.8s) give conflicting transactions time to complete
 * - Prevents premature failures when system is under sustained load
 * - Total retry window of ~10 seconds ensures high success rate
 * 
 * Non-retriable errors (quota exhausted, duplicate lead, etc.) fail immediately.
 */
export async function assignLead(data: {
  name: string;
  phone: string;
  city: string;
  serviceId: string;
  description: string;
}) {
  let retryCount = 0;
  let totalWaitTime = 0; // Track cumulative wait time across retries
  const startTime = Date.now();

  // Retry only transient transaction conflicts. This keeps quota checks,
  // duplicate protection, round robin updates, and all writes inside the
  // same transaction model while giving MongoDB a chance to resolve contention.
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      console.log("Allocation: attempt started", {
        attempt,
        retryCount,
        phone: data.phone,
        serviceId: data.serviceId,
        totalWaitTime,
      });

      const result = await assignLeadOnce(data);

      const totalTime = Date.now() - startTime;

      if (retryCount > 0) {
        console.log("Allocation: succeeded after retry", {
          retryCount,
          phone: data.phone,
          serviceId: data.serviceId,
          totalWaitTime,
          totalTime,
        });
      }

      return {
        ...result,
        retryCount,
        retried: retryCount > 0,
        totalWaitTime,
        totalTime,
      };
    } catch (error: any) {
      const isLastAttempt = attempt === MAX_TRANSACTION_RETRIES;

      // Only retry transaction conflicts, and only if we have attempts remaining
      if (error?.code !== "TRANSACTION_CONFLICT" || isLastAttempt) {
        // Attach retry metadata even to final failures
        if (error?.code === "TRANSACTION_CONFLICT") {
          error.retryCount = retryCount;
          error.retried = retryCount > 0;
          error.totalWaitTime = totalWaitTime;
          error.totalTime = Date.now() - startTime;
        }

        throw error;
      }

      retryCount += 1;
      const delayMs = getRetryDelay(retryCount);
      totalWaitTime += delayMs;

      console.warn("Allocation: retrying after transaction conflict", {
        attempt,
        retryCount,
        phone: data.phone,
        serviceId: data.serviceId,
        delayMs: Math.round(delayMs),
        totalWaitTime: Math.round(totalWaitTime),
        remainingAttempts: MAX_TRANSACTION_RETRIES - attempt,
      });

      // Exponential backoff with jitter gives conflicting transactions time to complete.
      // The randomized delay prevents all failed requests from retrying at the exact same time.
      await sleep(delayMs);
    }
  }

  // This should never be reached due to the loop logic, but TypeScript needs it
  const error = new AllocationError(
    "TRANSACTION_CONFLICT",
    "Allocation failed after retrying transaction conflicts."
  );
  error.retryCount = retryCount;
  error.retried = retryCount > 0;
  error.totalWaitTime = totalWaitTime;
  error.totalTime = Date.now() - startTime;
  throw error;
}
