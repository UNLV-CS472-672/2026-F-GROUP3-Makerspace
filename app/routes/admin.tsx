import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  // Placeholder for the initial UI.
  // Query students from Prisma later.
  // Add authorization checks before exposing admin functionality.

  return {
    success: true,
  };
}

export default function AdminPage() {
  const loaderData = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<"users" | "machines" | "certs">(
    "users"
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Top header */}
      <header className="h-20 bg-[#c00000]">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Circular UNLV mark */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#c00000] font-bold">
              UNLV
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide">
                UNIVERSITY OF NEVADA, LAS VEGAS
              </div>

              <div className="text-lg font-bold tracking-wider">
                MAKERSPACE ADMIN CONSOLE
              </div>
            </div>
          </div>

          <Link
            to="/"
            className="text-sm font-semibold transition-opacity hover:opacity-80"
          >
            ← STUDENT SCANNER
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>

        <p className="mt-2 text-sm text-gray-400">
          {loaderData.success
            ? "Admin page is ready for development."
            : "Unable to load the admin page."}
        </p>

        {/* Tabs */}
        <nav className="mt-8 border-b border-gray-700">
          <ul className="flex gap-8">
            <li>
              <button
                onClick={() => setActiveTab("users")}
                className={`pb-4 text-sm font-semibold tracking-wider transition-colors ${
                  activeTab === "users"
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span className="relative">
                  USERS
                  {activeTab === "users" && (
                    <span className="absolute left-0 -bottom-4 h-1 w-full rounded bg-[#c00000]" />
                  )}
                </span>
              </button>
            </li>

            <li>
              <button
                onClick={() => setActiveTab("machines")}
                className={`pb-4 text-sm font-semibold tracking-wider transition-colors ${
                  activeTab === "machines"
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span className="relative">
                  MACHINES
                  {activeTab === "machines" && (
                    <span className="absolute left-0 -bottom-4 h-1 w-full rounded bg-[#c00000]" />
                  )}
                </span>
              </button>
            </li>

            <li>
              <button
                onClick={() => setActiveTab("certs")}
                className={`pb-4 text-sm font-semibold tracking-wider transition-colors ${
                  activeTab === "certs"
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span className="relative">
                  CERTIFICATIONS
                  {activeTab === "certs" && (
                    <span className="absolute left-0 -bottom-4 h-1 w-full rounded bg-[#c00000]" />
                  )}
                </span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Spacing after tabs */}
        <div className="mt-8" />

        {/* Student roster (table-like) */}
        <section>
          <h2 className="mb-4 text-sm uppercase text-gray-400">
            Student Roster
          </h2>

          <div className="overflow-hidden rounded border border-gray-800 bg-[#0c0c0c]">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs text-gray-400 uppercase">
              <div className="col-span-4 font-semibold">Name</div>
              <div className="col-span-2 font-semibold">NSHE ID</div>
              <div className="col-span-2 font-semibold">RebelCard ID</div>
              <div className="col-span-3 font-semibold">Email</div>
              <div className="col-span-1 text-right font-semibold">Certs</div>
            </div>

            <div className="divide-y divide-gray-800">
              {/* Example rows - replace with live data later */}
              {[
                {
                  name: "Maria Sanchez",
                  nshe: "2001234567",
                  rebel: "1001234567",
                  email: "m.sanchez@unlv.nevada.edu",
                  certs: 2,
                },
                {
                  name: "James Okafor",
                  nshe: "2009876543",
                  rebel: "1009876543",
                  email: "j.okafor@unlv.nevada.edu",
                  certs: 4,
                },
                {
                  name: "Taylor Kim",
                  nshe: "2005551234",
                  rebel: "1005551234",
                  email: "t.kim@unlv.nevada.edu",
                  certs: 0,
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center text-sm"
                >
                  <div className="col-span-4">
                    <div className="font-medium text-white">{row.name}</div>
                  </div>

                  <div className="col-span-2 text-gray-300">{row.nshe}</div>

                  <div className="col-span-2 text-gray-300">{row.rebel}</div>

                  <div className="col-span-3 text-gray-400">{row.email}</div>

                  <div className="col-span-1 text-right">
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                        row.certs > 0
                          ? "bg-[#2b0000] text-[#ffb6b6] border border-[#5a0000]"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {row.certs}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Two-column forms */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left: Add New Student */}
          <div className="rounded border border-gray-800 bg-[#0c0c0c] p-6">
            <h3 className="mb-4 text-sm uppercase text-gray-400">
              Add New Student
            </h3>

            <label className="mb-2 block text-xs text-gray-400">Full name</label>
            <input
              className="mb-4 w-full rounded bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 border border-gray-800"
              placeholder="Jane Smith"
            />

            <label className="mb-2 block text-xs text-gray-400">NSHE ID</label>
            <input
              className="mb-4 w-full rounded bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 border border-gray-800"
              placeholder="2001234567"
            />

            <label className="mb-2 block text-xs text-gray-400">RebelCard ID</label>
            <input
              className="mb-4 w-full rounded bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 border border-gray-800"
              placeholder="1001234567"
            />

            <label className="mb-2 block text-xs text-gray-400">Email</label>
            <input
              className="mb-6 w-full rounded bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 border border-gray-800"
              placeholder="j.smith@unlv.nevada.edu"
            />

            <button className="rounded bg-[#c00000] px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90">
              Add Student
            </button>
          </div>

          {/* Right: Link NSHE ID -> RebelCard */}
          <div className="rounded border border-gray-800 bg-[#0c0c0c] p-6">
            <h3 className="mb-4 text-sm uppercase text-gray-400">
              Link NSHE ID → RebelCard
            </h3>

            <label className="mb-2 block text-xs text-gray-400">NSHE ID</label>
            <input
              className="mb-4 w-full rounded bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 border border-gray-800"
              placeholder="2001234567"
            />

            <label className="mb-2 block text-xs text-gray-400">
              New RebelCard ID
            </label>
            <input
              className="mb-6 w-full rounded bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 border border-gray-800"
              placeholder="1001234567"
            />

            <button className="rounded bg-[#c00000] px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90">
              Link IDs
            </button>
          </div>
        </div>
      </main>

      {/* Floating help button */}
      <div className="fixed right-6 bottom-6">
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] border border-gray-700 text-gray-300">
          ?
        </button>
      </div>
    </div>
  );
}