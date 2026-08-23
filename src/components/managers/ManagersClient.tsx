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

export function ManagersClient({
  me,
  managers: initial,
}: {
  me: { id: string; name: string; email: string; role: string };
  managers: Manager[];
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Property Managers</h3>
          <p className="text-sm text-slate-500">
            Register managers and update their profiles. Sign in is by registered email + password.
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
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            Signed in as {me.name}
          </p>
          <p className="truncate text-xs text-slate-500">{me.email} · {me.role}</p>
        </div>
      </div>

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
              {saving ? "Saving…" : editing ? "Save changes" : "Register"}
            </button>
          </div>
        </form>
      )}

      {/* Managers table */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100">
          {managers.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    {m.name}
                    {m.id === me.id && <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">You</span>}
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
              {(isAdmin || m.id === me.id) && (
                <button onClick={() => openEdit(m)} className="btn-ghost !px-3 !py-1.5 text-xs">
                  <i className="fa-solid fa-pen" /> Update profile
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
