"use client";

import { useEffect, useState } from "react";

type ServiceOption = {
  _id: string;
  name: string;
};

type TestLog = {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: unknown;
  timestamp: string;
};

const firstNames = [
  "Aarav",
  "Diya",
  "Rohan",
  "Meera",
  "Kabir",
  "Anaya",
  "Vivaan",
  "Ira",
  "Arjun",
  "Sara",
];

const cities = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Pune",
  "Chennai",
  "Hyderabad",
  "Kolkata",
  "Ahmedabad",
];

export default function TestToolsPage() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [sendingDuplicate, setSendingDuplicate] = useState(false);
  const [generatingLeads, setGeneratingLeads] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);

  useEffect(() => {
    fetchServices();
  }, []);

  function addLog(type: string, title: string, message: string, data?: unknown) {
    setLogs((prev) => [
      {
        id: crypto.randomUUID(),
        type,
        title,
        message,
        data,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  }

  async function fetchServices() {
    try {
      setLoadingServices(true);

      const response = await fetch("/api/services");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch services");
      }

      setServices(data.services || []);
      addLog("success", "Services Loaded", `Loaded ${data.services?.length || 0} services`);
    } catch (error: any) {
      addLog("error", "Services Error", error.message || "Failed to load services");
    } finally {
      setLoadingServices(false);
    }
  }

  function generateEventId() {
    return `reset-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function getRandomItem<T>(items: T[]) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function generateRandomLead(index: number) {
    const service = getRandomItem(services);
    const firstName = getRandomItem(firstNames);
    const city = getRandomItem(cities);
    const phone = `9${Date.now().toString().slice(-6)}${index}${Math.floor(100 + Math.random() * 900)}`;

    return {
      name: `${firstName} Test ${index + 1}`,
      phone,
      city,
      serviceId: service._id,
      description: `Auto-generated test lead for ${service.name}`,
    };
  }

  async function handleResetQuotas() {
    try {
      setResetting(true);

      const eventId = generateEventId();
      const response = await fetch("/api/webhook/reset-quotas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset quotas");
      }

      addLog(
        "success",
        "Reset Provider Quotas",
        data.message || "Provider quotas reset successfully",
        data
      );
    } catch (error: any) {
      addLog("error", "Reset Provider Quotas", error.message || "Request failed");
    } finally {
      setResetting(false);
    }
  }

  async function handleDuplicateWebhook() {
    try {
      setSendingDuplicate(true);

      const eventId = generateEventId();

      const firstResponse = await fetch("/api/webhook/reset-quotas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId }),
      });

      const firstData = await firstResponse.json();

      addLog(
        firstResponse.ok ? "success" : "error",
        "Duplicate Webhook Test - First Request",
        firstData.message || "First webhook finished",
        firstData
      );

      const secondResponse = await fetch("/api/webhook/reset-quotas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId }),
      });

      const secondData = await secondResponse.json();

      addLog(
        secondData.duplicate ? "info" : secondResponse.ok ? "success" : "error",
        "Duplicate Webhook Test - Second Request",
        secondData.message || "Second webhook finished",
        secondData
      );
    } catch (error: any) {
      addLog("error", "Duplicate Webhook Test", error.message || "Request failed");
    } finally {
      setSendingDuplicate(false);
    }
  }

  async function handleGenerateLeads() {
    if (!services.length) {
      addLog("error", "Generate 10 Leads Concurrently", "No services available to create leads");
      return;
    }

    try {
      setGeneratingLeads(true);
      addLog("info", "Generate 10 Leads Concurrently", "Starting 10 staggered concurrent lead requests");

      // Create lead requests with slight staggering to simulate realistic concurrent load.
      // This prevents all 10 requests from hitting the database at the exact same millisecond,
      // which is more realistic than perfectly synchronized requests.
      const leadRequests = Array.from({ length: 10 }, (_, index) => {
        const lead = generateRandomLead(index);
        
        // Add small random delay (0-50ms) before each request starts.
        // This staggers the requests slightly while keeping them concurrent.
        // Benefits:
        // - More realistic simulation of real-world traffic patterns
        // - Reduces initial collision probability
        // - Still tests concurrent handling (all requests overlap)
        // - Allows retry mechanism to work more effectively
        const staggerDelay = Math.random() * 50;

        return new Promise((resolve, reject) => {
          setTimeout(() => {
            fetch("/api/leads", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(lead),
            })
              .then(async (response) => {
                const data = await response.json();

                if (!response.ok) {
                  throw new Error(data.message || `Lead ${index + 1} failed`);
                }

                resolve({
                  index,
                  lead,
                  data,
                });
              })
              .catch((error) => {
                reject(error);
              });
          }, staggerDelay);
        });
      });

      const results = await Promise.allSettled(leadRequests);

      let successCount = 0;
      let failureCount = 0;
      let totalRetries = 0;
      let totalWaitTime = 0;
      let maxRetries = 0;
      let maxWaitTime = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successCount++;
          const retryCount = result.value.data.retryCount || 0;
          const waitTime = result.value.data.totalWaitTime || 0;
          
          totalRetries += retryCount;
          totalWaitTime += waitTime;
          maxRetries = Math.max(maxRetries, retryCount);
          maxWaitTime = Math.max(maxWaitTime, waitTime);
          
          const retryInfo = result.value.data.retried 
            ? ` (${retryCount} ${retryCount === 1 ? 'retry' : 'retries'}, waited ${waitTime}ms)`
            : '';
          
          addLog(
            "success",
            `Lead Request ${index + 1}${retryInfo}`,
            result.value.data.message || "Lead created successfully",
            result.value.data
          );
        } else {
          failureCount++;
          addLog(
            "error",
            `Lead Request ${index + 1}`,
            result.reason?.message || "Lead request failed"
          );
        }
      });

      // Enhanced summary log with detailed metrics
      const avgRetries = successCount > 0 ? (totalRetries / successCount).toFixed(2) : 0;
      const avgWaitTime = successCount > 0 ? Math.round(totalWaitTime / successCount) : 0;
      
      const summaryMessage = [
        `${successCount} succeeded, ${failureCount} failed`,
        `${totalRetries} total retries (avg: ${avgRetries}, max: ${maxRetries})`,
        `Average wait time: ${avgWaitTime}ms (max: ${maxWaitTime}ms)`
      ].join(' | ');

      addLog(
        successCount === 10 ? "success" : successCount > 0 ? "info" : "error",
        "Concurrent Test Summary",
        summaryMessage,
        {
          successCount,
          failureCount,
          totalRetries,
          averageRetries: parseFloat(avgRetries),
          maxRetries,
          totalWaitTime,
          averageWaitTime: avgWaitTime,
          maxWaitTime,
        }
      );
    } catch (error: any) {
      addLog("error", "Generate 10 Leads Concurrently", error.message || "Lead generation failed");
    } finally {
      setGeneratingLeads(false);
    }
  }

  function getLogStyles(type: string) {
    if (type === "success") {
      return "border-green-200 bg-green-50 text-green-800";
    }

    if (type === "error") {
      return "border-red-200 bg-red-50 text-red-800";
    }

    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Testing Workspace
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Test Tools
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                Run manual checks for webhook idempotency, quota resets, and concurrent
                lead creation from one organized screen.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {loadingServices
                ? "Loading services for testing..."
                : `Services loaded: ${services.length}`}
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-sm font-semibold text-slate-900">Reset Provider Quotas</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Send the quota reset webhook once and confirm providers return to their
                default monthly state.
              </p>
              <button
                type="button"
                onClick={handleResetQuotas}
                disabled={resetting}
                className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {resetting ? "Resetting..." : "Reset Provider Quotas"}
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-sm font-semibold text-slate-900">Duplicate Webhook Check</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Reuse the same webhook `eventId` twice to confirm idempotency behavior and
                duplicate protection.
              </p>
              <button
                type="button"
                onClick={handleDuplicateWebhook}
                disabled={sendingDuplicate}
                className="mt-5 w-full rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {sendingDuplicate ? "Sending..." : "Send Duplicate Webhook"}
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-sm font-semibold text-slate-900">Concurrent Lead Test</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Trigger 10 lead requests concurrently with slight staggering (0-50ms delays) 
                to simulate realistic traffic and test retry handling.
              </p>
              <button
                type="button"
                onClick={handleGenerateLeads}
                disabled={generatingLeads || loadingServices}
                className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {generatingLeads ? "Generating..." : "Generate 10 Leads Concurrently"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Testing Logs</h2>
              <p className="mt-1 text-sm text-slate-600">
                Review timestamped results for each action and inspect API responses.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear Logs
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
              No logs yet. Run one of the test actions above to start collecting results.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-[1.25rem] border p-4 ${getLogStyles(log.type)}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{log.title}</p>
                      <p className="mt-1 text-sm leading-6">{log.message}</p>
                    </div>
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-700">
                      {log.timestamp}
                    </span>
                  </div>

                  {Boolean(log.data) && (
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-white/80 p-4 text-xs leading-6 text-slate-700 ring-1 ring-slate-200/70">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
