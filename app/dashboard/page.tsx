"use client";

import { useEffect, useState } from "react";
import { getSocketClient, SOCKET_EVENT_LEAD_ASSIGNED } from "../../lib/socket-client";

type DashboardLead = {
  customerName: string;
  phone: string;
  city: string;
  serviceName: string;
  description: string;
  createdAt: string;
};

type DashboardProvider = {
  _id: string;
  name: string;
  monthlyQuota: number;
  leadsReceived: number;
  remainingQuota: number;
  assignedLeads: DashboardLead[];
};

export default function DashboardPage() {
  const [providers, setProviders] = useState<DashboardProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    // When the backend emits that a lead was assigned, we simply refetch
    // the existing dashboard API instead of duplicating dashboard logic here.
    const socket = getSocketClient();

    function handleLeadAssigned() {
      fetchDashboard();
    }

    socket.on(SOCKET_EVENT_LEAD_ASSIGNED, handleLeadAssigned);

    return () => {
      socket.off(SOCKET_EVENT_LEAD_ASSIGNED, handleLeadAssigned);
    };
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/dashboard");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load dashboard");
      }

      setProviders(data.providers || []);
    } catch (error: any) {
      setError(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Operations Dashboard
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Provider Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Monitor provider quotas, assigned leads, and overall allocation activity
                in a compact view.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-fit">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Providers
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{providers.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-white">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
                  Total Assigned
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {providers.reduce(
                    (total, provider) => total + provider.assignedLeads.length,
                    0
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-8 rounded-2xl bg-white p-6 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
            Loading dashboard...
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl bg-red-50 p-6 text-sm text-red-700 shadow-sm ring-1 ring-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <div
                key={provider._id}
                className="rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{provider.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Monthly quota: {provider.monthlyQuota}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Remaining
                    </p>
                    <p className="text-lg font-bold text-emerald-900">
                      {provider.remainingQuota}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Leads Received
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-950">
                      {provider.leadsReceived}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Assigned Leads
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-950">
                      {provider.assignedLeads.length}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Assigned Leads</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {provider.assignedLeads.length} items
                    </span>
                  </div>

                  {provider.assignedLeads.length === 0 ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      No leads assigned yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {provider.assignedLeads.map((lead, index) => (
                        <div
                          key={`${provider._id}-${lead.phone}-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{lead.customerName}</p>
                              <p className="text-sm text-slate-600">{lead.phone}</p>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                              {lead.serviceName}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-slate-600">
                            <p>
                              <span className="font-medium text-slate-700">City:</span> {lead.city}
                            </p>
                            <p>
                              <span className="font-medium text-slate-700">Description:</span>{" "}
                              {lead.description}
                            </p>
                            <p>
                              <span className="font-medium text-slate-700">Created:</span>{" "}
                              {new Date(lead.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
