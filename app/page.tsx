import Link from "next/link";

const navigationItems = [
  {
    href: "/request-service",
    title: "Request Service",
    description: "Submit customer requests with service details and clean validation.",
    badge: "Customer Intake",
  },
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Track provider quotas, assignments, and lead distribution activity.",
    badge: "Operations View",
  },
  {
    href: "/test-tools",
    title: "Test Tools",
    description: "Run concurrency, webhook, and quota reset checks from one place.",
    badge: "QA Utilities",
  },
];

export default function HomePage() {
  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 px-6 py-12 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.35)] sm:px-10 lg:px-14">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-600">
                Lead routing workspace
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                Prowider Mini Lead Distribution System
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                A clean workspace for receiving service requests, monitoring provider
                allocation, and testing the routing flow without changing backend logic.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/request-service"
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Start a Request
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Open Dashboard
                </Link>
              </div>
            </div>

            <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <p className="text-sm font-medium text-slate-500">Core Workflow</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  Request {"->"} Allocate {"->"} Monitor
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The app keeps request submission, provider assignment, and testing
                  tools close together so day-to-day usage stays simple.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-2xl bg-slate-900 p-5 text-white">
                  <p className="text-sm text-slate-300">Request Form</p>
                  <p className="mt-2 text-2xl font-bold">1</p>
                </div>
                <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">Dashboard View</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">2</p>
                </div>
                <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <p className="text-sm text-slate-500">Testing Area</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">3</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                {item.badge}
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {item.description}
              </p>
              <div className="mt-6 text-sm font-semibold text-slate-900 transition group-hover:translate-x-1">
                Open page {"->"}
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Why it feels organized
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                Clear navigation for each step of the workflow
              </h2>
            </div>
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Request Service</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Fast form flow for customer intake with clear fields and feedback.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Dashboard + Testing</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Keep operations monitoring and validation tools close by for quick checks.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
