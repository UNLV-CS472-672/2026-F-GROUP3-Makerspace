import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";

import { prisma } from "~/db.server";
import { getUser } from "~/session.server";
import { validateEmail } from "~/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const user = await getUser(request);

  if (!user) {
    const redirectTo = url.pathname + url.search;
    return redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const allowedRoles = new Set(["staff", "admin", "super admin"]);
  const roles = (user.roles ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  const hasAllowedRole = roles.some((role) => allowedRoles.has(role));

  if (!hasAllowedRole) {
    throw new Response("Forbidden", { status: 403 });
  }

  const students = await prisma.student.findMany({
    orderBy: { name: "asc" },
    include: { certifications: true },
  });

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      roles: roles.join(", "),
    },
    students: students.map((student) => ({
      id: student.id,
      name: student.name,
      nshe: student.nsheId,
      rebel: student.rebelCardId,
      email: student.email,
      certs: student.certifications.length,
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getUser(request);

  const allowedRoles = new Set(["staff", "admin", "super admin"]);
  const roles = (user?.roles ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  const hasAllowedRole = roles.some((role) => allowedRoles.has(role));

  if (!user || !hasAllowedRole) {
    throw new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();

  if (formData.get("intent") === "link") {
    const nsheId = String(formData.get("linkNsheId") ?? "").trim();
    const newRebelCardId = String(formData.get("newRebelCardId") ?? "").trim();

    const linkErrors: Record<string, string> = {};

    if (!/^\d{10}$/.test(nsheId)) {
      linkErrors.linkNsheId = "NSHE ID must be 10 digits";
    }

    if (!/^\d{10}$/.test(newRebelCardId)) {
      linkErrors.newRebelCardId = "RebelCard ID must be 10 digits";
    }

    if (Object.keys(linkErrors).length > 0) {
      return json({ errors: linkErrors }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { nsheId } });
    if (!student) {
      linkErrors.linkNsheId = "No student has this NSHE ID";
      return json({ errors: linkErrors }, { status: 400 });
    }

    const cardInUse = await prisma.student.findUnique({
      where: { rebelCardId: newRebelCardId },
    });

    if (cardInUse) {
      linkErrors.newRebelCardId =
        "This RebelCard ID is already assigned to a student";
      return json({ errors: linkErrors }, { status: 400 });
    }

    await prisma.student.update({
      where: { nsheId },
      data: { rebelCardId: newRebelCardId },
    });

    return redirect("/admin");
  }

  const name = String(formData.get("fullName") ?? "").trim();
  const nsheId = String(formData.get("nsheId") ?? "").trim();
  const rebelCardId = String(formData.get("rebelCardId") ?? "").trim();
  const email = String(formData.get("studentEmail") ?? "").trim();

  const errors: Record<string, string> = {};

  if (!name) errors.fullName = "Name is required";
  if (!/^\d{10}$/.test(nsheId)) errors.nsheId = "NSHE ID must be 10 digits";
  if (!/^\d{10}$/.test(rebelCardId)) {
    errors.rebelCardId = "RebelCard ID must be 10 digits";
  }
  if (!validateEmail(email)) errors.studentEmail = "Email is invalid";

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 400 });
  }

  const existing = await prisma.student.findFirst({
    where: { OR: [{ nsheId }, { rebelCardId }, { email }] },
  });

  if (existing) {
    errors.form =
      "A student with this NSHE ID, RebelCard ID, or email already exists";
    return json({ errors }, { status: 400 });
  }

  await prisma.student.create({
    data: { name, nsheId, rebelCardId, email },
  });

  return redirect("/admin");
}

export default function AdminPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [activeTab, setActiveTab] = useState<"users" | "machines" | "certs">(
    "users",
  );

  const renderTabUnderline = (tab: "users" | "machines" | "certs") => {
    return activeTab === tab ? (
      <span className="absolute left-0 -bottom-4 h-1 w-full rounded bg-[#c00000]" />
    ) : null;
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <header className="h-20 bg-[#c00000]">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
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

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>

        <p className="mt-2 text-sm text-gray-400">
          {loaderData.success
            ? `Admin page is ready for development. Signed in as ${loaderData.user?.email ?? "admin"}`
            : "Unable to load the admin page."}
        </p>

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
                  {renderTabUnderline("users")}
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
                  {renderTabUnderline("machines")}
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
                  {renderTabUnderline("certs")}
                </span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="mt-8" />

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
              {loaderData.students.map((row) => (
                <div
                  key={row.id}
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

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Form
            method="post"
            className="rounded border border-gray-800 bg-[#0c0c0c] p-6"
          >
            <h3 className="mb-4 text-sm uppercase text-gray-400">
              Add New Student
            </h3>

            {actionData?.errors?.form ? (
              <p className="mb-4 text-sm text-red-400">
                {actionData.errors.form}
              </p>
            ) : null}

            <label htmlFor="fullName" className="mb-2 block text-xs text-gray-400">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              className="w-full rounded border border-gray-800 bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              placeholder="Jane Smith"
            />
            {actionData?.errors?.fullName ? (
              <p className="mb-4 pt-1 text-xs text-red-400">
                {actionData.errors.fullName}
              </p>
            ) : (
              <div className="mb-4" />
            )}

            <label htmlFor="nsheId" className="mb-2 block text-xs text-gray-400">
              NSHE ID
            </label>
            <input
              id="nsheId"
              name="nsheId"
              className="w-full rounded border border-gray-800 bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              placeholder="2001234567"
            />
            {actionData?.errors?.nsheId ? (
              <p className="mb-4 pt-1 text-xs text-red-400">
                {actionData.errors.nsheId}
              </p>
            ) : (
              <div className="mb-4" />
            )}

            <label
              htmlFor="rebelCardId"
              className="mb-2 block text-xs text-gray-400"
            >
              RebelCard ID
            </label>
            <input
              id="rebelCardId"
              name="rebelCardId"
              className="w-full rounded border border-gray-800 bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              placeholder="1001234567"
            />
            {actionData?.errors?.rebelCardId ? (
              <p className="mb-4 pt-1 text-xs text-red-400">
                {actionData.errors.rebelCardId}
              </p>
            ) : (
              <div className="mb-4" />
            )}

            <label
              htmlFor="studentEmail"
              className="mb-2 block text-xs text-gray-400"
            >
              Email
            </label>
            <input
              id="studentEmail"
              name="studentEmail"
              className="w-full rounded border border-gray-800 bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              placeholder="j.smith@unlv.nevada.edu"
            />
            {actionData?.errors?.studentEmail ? (
              <p className="mb-4 pt-1 text-xs text-red-400">
                {actionData.errors.studentEmail}
              </p>
            ) : (
              <div className="mb-6" />
            )}

            <button
              type="submit"
              className="rounded bg-[#c00000] px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Add Student
            </button>
          </Form>

          <Form
            method="post"
            className="rounded border border-gray-800 bg-[#0c0c0c] p-6"
          >
            <input type="hidden" name="intent" value="link" />

            <h3 className="mb-4 text-sm uppercase text-gray-400">
              Link NSHE ID → RebelCard
            </h3>

            <label
              htmlFor="linkNsheId"
              className="mb-2 block text-xs text-gray-400"
            >
              NSHE ID
            </label>
            <input
              id="linkNsheId"
              name="linkNsheId"
              className="w-full rounded border border-gray-800 bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              placeholder="2001234567"
            />
            {actionData?.errors?.linkNsheId ? (
              <p className="mb-4 pt-1 text-xs text-red-400">
                {actionData.errors.linkNsheId}
              </p>
            ) : (
              <div className="mb-4" />
            )}

            <label
              htmlFor="newRebelCardId"
              className="mb-2 block text-xs text-gray-400"
            >
              New RebelCard ID
            </label>
            <input
              id="newRebelCardId"
              name="newRebelCardId"
              className="w-full rounded border border-gray-800 bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
              placeholder="1001234567"
            />
            {actionData?.errors?.newRebelCardId ? (
              <p className="mb-6 pt-1 text-xs text-red-400">
                {actionData.errors.newRebelCardId}
              </p>
            ) : (
              <div className="mb-6" />
            )}

            <button
              type="submit"
              className="rounded bg-[#c00000] px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Link IDs
            </button>
          </Form>
        </div>
      </main>

      <div className="fixed bottom-6 right-6">
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-[#111111] text-gray-300">
          ?
        </button>
      </div>
    </div>
  );
}