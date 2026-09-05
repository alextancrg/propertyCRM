"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  role: string;
};

/**
 * "My Profile" modal — view/update name, phone, birthdate, and optionally the
 * password. The birthdate is the identity check used by forgot-password, so
 * keeping it accurate is emphasised in the UI.
 */
export function ProfileModal({ user, onClose, onSaved }: { user: ProfileUser; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [birthDate, setBirthDate] = useState(user.birthDate ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (changingPassword && newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          birthDate,
          ...(changingPassword && newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not save your profile. Please try again.");
      setSaved(true);
      onSaved();
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="card mt-10 w-full max-w-[90%]">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">
            <i className="fa-solid fa-user-pen mr-2 text-primary" /> My Profile
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>

        <div className="grid gap-4 p-6">
          <div>
            <label className="label mb-1">Email (login)</label>
            <input value={user.email} disabled className="input cursor-not-allowed bg-slate-50 text-slate-400" />
          </div>
          <div>
            <label className="label mb-1">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label mb-1">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="01x-xxx-xxxx" />
          </div>
          <div>
            <label className="label mb-1">Birthdate</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="input cursor-pointer"
            />
            <p className="mt-1 text-xs text-slate-400">
              <i className="fa-solid fa-circle-info mr-1" />
              Used to verify your identity when resetting a forgotten password — keep it accurate.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={changingPassword}
                onChange={(e) => setChangingPassword(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Change password
            </label>
            {changingPassword && (
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="label mb-1">Current password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <label className="label mb-1">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="label mb-1">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {saved && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <i className="fa-solid fa-circle-check mr-1.5" /> Profile saved.
            </p>
          )}
          {error && <p className="text-sm font-medium text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Close
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" /> Saving…
              </>
            ) : (
              "Save profile"
            )}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
