"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

type Owner = {
  id: string;
  name: string;
  icNumber: string | null;
  phone: string | null;
  email: string | null;
  // Formatted on the server to keep the SSR HTML identical to what React
  // hydrates (Vercel renders in UTC, the browser in a different timezone).
  registeredAt: string;
  createdBy: { id: string; name: string } | null;
  assignedManagers: { user: { id: string; name: string } }[];
  properties: { property: { id: string; name: string } }[];
};

export function OwnersClient({
  me,
  owners: initial,
}: {
  me: { id: string; name: string; email: string; role: string };
  owners: Owner[];
}) {
  const router = useRouter();
  const [owners, setOwners] = useState<Owner[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [deleting, setDeleting] = useState<Owner | null>(null);
  const [form, setForm] = useState({ name: "", icNumber: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOwners = owners.filter(
    (o) => !query || o.name.toLowerCase().includes(query.toLowerCase()),
  );

  function resetForm() {
    setForm({ name: "", icNumber: "", phone: "", email: "" });
    setError(null);
  }

  function openEdit(o: Owner) {
    setEditing(o);
    setForm({ name: o.name, icNumber: o.icNumber ?? "", phone: o.phone ?? "", email: o.email ?? "" });
    setShowForm(true);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editing ? `/api/owners/${editing.id}` : "/api/owners";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save owner.");
      // Update the visible list immediately (router.refresh() alone won't
      // re-sync local state that was initialised from props).
      if (editing && editing.id) {
        setOwners((prev) =>
          prev.map((o) =>
            o.id === editing.id
              ? {
                  ...o,
                  name: data.owner?.name ?? o.name,
                  icNumber: data.owner?.icNumber ?? o.icNumber,
                  phone: data.owner?.phone ?? o.phone,
                  email: data.owner?.email ?? o.email,
                }
              : o,
          ),
        );
      } else {
        const created: Owner = {
          id: data.owner?.id ?? crypto.randomUUID(),
          name: data.owner?.name ?? form.name,
          icNumber: data.owner?.icNumber ?? null,
          phone: data.owner?.phone ?? null,
          email: data.owner?.email ?? null,
          registeredAt: formatDate(data.owner?.createdAt ?? new Date()),
          createdBy: { id: me.id, name: me.name },
          assignedManagers: [],
          properties: [],
        };
        setOwners((prev) => [created, ...prev]);
      }
      setEditing(null);
      setShowForm(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save owner.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Owners & Landlords</h3>
          <p className="text-sm text-slate-500">Register owners and keep their contact details up to date.</p>
        </div>
        <button onClick={() => { setEditing(null); resetForm(); setShowForm(true); }} className="btn-primary">
          <i className="fa-solid fa-user-plus" /> Register Owner
        </button>
      </div>

      {/* Search owners by name */}
      <div className="relative">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search owners by name…"
          className="input pl-11"
        />
      </div>

      {/* Register / edit form */}
      {showForm && (
        <form onSubmit={submit} className="card grid gap-4 p-6">
          <h4 className="font-bold text-slate-900">
            {editing ? `Update ${editing.name}` : "Register a New Owner"}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-1">Full name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label mb-1">IC / Passport no.</label>
              <input className="input" value={form.icNumber} onChange={(e) => setForm({ ...form, icNumber: e.target.value })} />
            </div>
            <div>
              <label className="label mb-1">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label mb-1">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-red-500">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setShowForm(false); resetForm(); }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : editing ? "Save changes" : "Register"}
            </button>
          </div>
        </form>
      )}

      {/* Owners list */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {filteredOwners.map((o) => (
          <div key={o.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-primary-900 text-sm font-bold text-white">
                  {o.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{o.name}</p>
                  <p className="text-xs text-slate-500">
                    {[o.email, o.phone, o.icNumber].filter(Boolean).join(" · ") || "No contact details"}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button onClick={() => openEdit(o)} className="btn-ghost !px-3 !py-1.5 text-xs">
                  <i className="fa-solid fa-pen" /> Update
                </button>
                <button onClick={() => setDeleting(o)} className="btn-ghost !px-3 !py-1.5 text-xs text-red-600 hover:bg-red-50">
                  <i className="fa-solid fa-trash-can" /> Delete
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Owned properties</p>
              {o.properties.length === 0 ? (
                <p className="mt-1 text-xs italic text-slate-400">Not linked to any property yet.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.properties.map((p) => (
                    <span key={p.property.id} className="pill bg-slate-100 text-slate-600">
                      {p.property.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-slate-400">Registered {o.registeredAt}</p>
              {o.createdBy && (
                <p className="mt-1 text-[11px] text-slate-400">Registered by {o.createdBy.name}</p>
              )}
              {o.assignedManagers.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Managed by: {o.assignedManagers.map((m) => m.user.name).join(", ")}
                </p>
              )}
            </div>
          </div>
        ))}
        {filteredOwners.length === 0 && (
          <p className="text-sm text-slate-400">
            {query ? `No owners match “${query}”.` : "No owners registered yet."}
          </p>
        )}
      </div>

      {deleting && (
        <DeleteOwnerModal
          owner={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setDeleting(null);
            setOwners((prev) => prev.filter((o) => o.id !== id));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Delete confirmation — retype the owner's name to remove them (soft delete). */
function DeleteOwnerModal({
  owner,
  onClose,
  onDeleted,
}: {
  owner: Owner;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const match = typed.trim() === owner.name.trim();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!match) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/owners/${owner.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete owner.");
      onDeleted(owner.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete owner.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="card w-full max-w-md">
        <div className="border-b border-slate-100 bg-red-50/60 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            <i className="fa-solid fa-triangle-exclamation mr-2 text-red-500" />
            Delete owner
          </h3>
        </div>
        <div className="grid gap-4 p-6">
          <p className="text-sm text-slate-600">
            Removing an owner keeps their properties, documents and bills in the system.
          </p>
          <p className="text-sm text-slate-600">
            Type <span className="font-bold text-slate-900">{owner.name}</span> to confirm:
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="input"
            placeholder={owner.name}
            autoFocus
          />
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!match || saving}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-40"
          >
            {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Deleting…</> : "Delete owner"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
