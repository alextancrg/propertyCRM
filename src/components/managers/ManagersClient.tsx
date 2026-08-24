"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

type Manager = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
};

type Invitation = {
  id: string;
  fromUserId: string;
  fromName: string;
  fromEmail: string;
  email: string;
  status: string; // pending | accepted | declined
  createdAt: string;
  respondedAt: string | null;
  toUserId: string | null;
  toName: string | null;
  toEmail: string | null;
};

type SharingPartner = { id: string; name: string; email: string; since: string };

export function ManagersClient({
  me,
  managers: initial,
  sent: initialSent,
  received: initialReceived,
  sharing,
}: {
  me: { id: string; name: string; email: string; role: string };
  managers: Manager[];
  sent: Invitation[];
  received: Invitation[];
  sharing: SharingPartner[];
}) {
  const router = useRouter();
  const isAdmin = me.role === "Administrator";
  const [managers, setManagers] = useState<Manager[]>(initial);
  const [showRegister, setShowRegister] = useState(false);
  const [editing, setEditing] = useState<Manager | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Property Manager",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sharing invitations
  const [sent, setSent] = useState<Invitation[]>(initialSent);
  const [received, setReceived] = useState<Invitation[]>(initialReceived);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

  function resetForm() {
    setForm({ name: "", email: "", phone: "", role: "Property Manager", password: "" });
    setError(null);
  }

  function openEdit(m: Manager) {
    setEditing(m);
    setForm({ name: m.name, email: m.email, phone: m.phone ?? "", role: m.role, password: "" });
    setShowRegister(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editing ? `/api/managers/${editing.id}` : "/api/managers";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save manager.");
      // Update the visible list immediately (router.refresh() won't re-sync
      // the local state that was initialised from props).
      const saved = data.manager as Manager | undefined;
      if (saved) {
        setManagers((prev) =>
          editing
            ? prev.map((m) => (m.id === editing.id ? { ...m, ...saved } : m))
            : [...prev, saved],
        );
      }
      setEditing(null);
      setShowRegister(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save manager.");
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/managers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not send the invitation.");
      const inv = data.invitation as Invitation | undefined;
      if (inv) setSent((prev) => [inv, ...prev]);
      setInviteEmail("");
      router.refresh();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not send the invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function respond(id: string, action: "accept" | "decline") {
    setResponding(id);
    setInviteError(null);
    try {
      const res = await fetch(`/api/managers/invitations/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not respond to the invitation.");
      setReceived((prev) => prev.map((i) => (i.id === id ? { ...i, status: action } : i)));
      // Re-fetch the scoped manager list so a new sharing partner appears
      // immediately (router.refresh() won't re-sync local state from props).
      try {
        const list = await fetch("/api/managers").then((r) => r.json().catch(() => ({})));
        if (Array.isArray(list?.managers)) setManagers(list.managers as Manager[]);
      } catch {
        /* ignore */
      }
      router.refresh();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not respond.");
    } finally {
      setResponding(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const pendingReceived = received.filter((i) => i.status === "pending");
  const pendingSent = sent.filter((i) => i.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Property Managers</h3>
          <p className="text-sm text-slate-500">
            {isAdmin
              ? "Register managers, update profiles, and manage shared visibility."
              : "You see yourself and the managers you share property visibility with."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button onClick={() => { setEditing(null); resetForm(); setShowRegister(true); }} className="btn-primary">
              <i className="fa-solid fa-user-plus" /> Register Manager
            </button>
          )}
          <button onClick={logout} className="btn-ghost">
            <i className="fa-solid fa-right-from-bracket" /> Sign out
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-white">
          {me.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Signed in as {me.name}</p>
          <p className="truncate text-xs text-slate-500">{me.email} · {me.role}</p>
        </div>
        {!isAdmin && (
          <span className="pill bg-primary/10 text-primary">
            <i className="fa-solid fa-share-nodes mr-1" /> Sharing with {sharing.length} manager{sharing.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Invite a manager by email — shared visibility */}
      <div className="card p-6">
        <div className="mb-3">
          <h4 className="font-bold text-slate-900">
            <i className="fa-solid fa-user-plus mr-2 text-primary" /> Share property management
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Invite another property manager by email to share property visibility. The invited manager must{" "}
            <span className="font-semibold text-slate-700">accept the invitation</span> — after that you both see each
            other&apos;s properties and can share the workload. Sharing works with more than two managers.
          </p>
        </div>
        <form onSubmit={sendInvite} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="manager@example.com"
              className="input pl-11"
              required
            />
          </div>
          <button type="submit" disabled={inviting} className="btn-primary shrink-0">
            {inviting ? <><i className="fa-solid fa-spinner fa-spin" /> Sending…</> : <><i className="fa-solid fa-paper-plane" /> Send invitation</>}
          </button>
        </form>
        {inviteError && <p className="mt-2 text-sm font-medium text-red-500">{inviteError}</p>}
      </div>

      {/* Invitations */}
      {(pendingReceived.length > 0 || pendingSent.length > 0) && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h4 className="font-bold text-slate-900">Invitations</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingReceived.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-sm font-bold text-amber-600">
                    {i.fromName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{i.fromName} invited you to share visibility</p>
                    <p className="text-xs text-slate-500">
                      {i.fromEmail} · {formatDate(i.createdAt)} ·{" "}
                      <span className="font-medium text-amber-600">Pending your response</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => respond(i.id, "accept")}
                    disabled={responding === i.id}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600"
                  >
                    <i className="fa-solid fa-check mr-1" /> Accept
                  </button>
                  <button
                    onClick={() => respond(i.id, "decline")}
                    disabled={responding === i.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
            {pendingSent.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
                    {i.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Invitation to {i.email}</p>
                    <p className="text-xs text-slate-500">
                      Sent {formatDate(i.createdAt)} · <span className="font-medium text-slate-400">Awaiting acceptance</span>
                    </p>
                  </div>
                </div>
                <span className="pill bg-slate-100 text-slate-600">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register / edit form */}
      {(showRegister || editing) && (
        <form onSubmit={submit} className="card grid gap-4 p-6">
          <h4 className="font-bold text-slate-900">
            {editing ? `Update ${editing.name}` : "Register a Property Manager"}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-1">Full name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label mb-1">Email address (login)</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label mb-1">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label mb-1">Role</label>
              <select className="input cursor-pointer" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={!isAdmin}>
                <option>Property Manager</option>
                <option>Administrator</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label mb-1">
                {editing ? "Reset password (leave blank to keep current)" : "Password"}
              </label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} minLength={8} placeholder={editing ? "••••••••" : "At least 8 characters"} />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-red-500">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setShowRegister(false); resetForm(); }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : editing ? "Save changes" : "Register"}
            </button>
          </div>
        </form>
      )}

      {/* Managers table */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h4 className="font-bold text-slate-900">
            {isAdmin ? "All managers" : "Your team"} ({managers.length})
          </h4>
          {!isAdmin && <p className="text-xs text-slate-500">You and the managers you share property visibility with.</p>}
        </div>
        <div className="divide-y divide-slate-100">
          {managers.map((m) => {
            const isMe = m.id === me.id;
            const isPartner = !isMe && sharing.some((s) => s.id === m.id);
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                    {m.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {m.name}
                      {isMe && <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">You</span>}
                      {isPartner && (
                        <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          <i className="fa-solid fa-share-nodes mr-0.5" /> Shared visibility
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {m.email} · {m.role}
                      {m.phone ? ` · ${m.phone}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Registered {formatDate(m.createdAt)} · Last updated {formatDate(m.updatedAt)}
                    </p>
                  </div>
                </div>
                {(isAdmin || isMe) && (
                  <button onClick={() => openEdit(m)} className="btn-ghost !px-3 !py-1.5 text-xs">
                    <i className="fa-solid fa-pen" /> Update profile
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
