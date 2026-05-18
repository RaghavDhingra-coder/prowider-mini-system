"use client";

import { useEffect, useState } from "react";

type ServiceOption = {
  _id: string;
  name: string;
};

const initialForm = {
  name: "",
  phone: "",
  city: "",
  serviceId: "",
  description: "",
};

export default function RequestServicePage() {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [formData, setFormData] = useState(initialForm);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    try {
      setLoadingServices(true);
      setError("");

      const response = await fetch("/api/services");
      const data = await response.json();

      console.log("Request Service: fetch /api/services status", response.status);
      console.log("Request Service: fetch /api/services data", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to load services");
      }

      setServices(data.services || []);
      console.log("Request Service: services loaded", data.services || []);
    } catch (error: any) {
      console.error("Request Service: failed to load services", error);
      setError(error.message || "Something went wrong");
    } finally {
      setLoadingServices(false);
    }
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function validateForm() {
    if (!formData.name.trim()) return "Name is required";
    if (!formData.phone.trim()) return "Phone number is required";
    if (!/^[0-9+\-\s()]+$/.test(formData.phone.trim())) {
      return "Enter a valid phone number";
    }
    if (!formData.city.trim()) return "City is required";
    if (!formData.serviceId) return "Please select a service type";
    if (!formData.description.trim()) return "Description is required";

    return "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      // The backend handles duplicate leads, allocation, and provider
      // concurrency rules. The form only sends clean input data.
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit request");
      }

      setSuccess("Your service request has been submitted successfully.");
      setFormData(initialForm);
    } catch (error: any) {
      setError(error.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm sm:p-8">
          <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            Customer Intake
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Request Service
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            Capture a lead with the core contact details, service type, and a short
            description. The backend handles provider matching and duplicate checks.
          </p>

          <div className="mt-8 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">What happens next</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                After submission, the system saves the lead, allocates providers, and
                updates the dashboard automatically.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 p-5 text-white">
              <p className="text-sm font-semibold">Helpful tip</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Use a unique phone number for each new test lead to avoid duplicate-lead
                validation errors for the same service.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.4)] sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Lead Request Form</h2>
              <p className="mt-1 text-sm text-slate-600">
                Fill out the form below and submit a new customer request.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {loadingServices ? "Loading services" : `${services.length} services available`}
            </div>
          </div>

          {loadingServices && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Loading services...
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="phone">
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Enter city"
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-medium text-slate-700"
                  htmlFor="serviceId"
                >
                  Service Type
                </label>
                <select
                  id="serviceId"
                  name="serviceId"
                  value={formData.serviceId}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                  disabled={loadingServices}
                >
                  <option value="">Select a service</option>
                  {services.map((service) => (
                    <option key={service._id} value={service._id}>
                      {service.name}
                    </option>
                  ))}
                </select>
                {!loadingServices && services.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    No services found. Run the seed script and reload this page.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-slate-700"
                htmlFor="description"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Describe the service request"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || loadingServices}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
