"use client";

import { useState } from "react";
import { formatDate, cx } from "@/lib/format";

const CATEGORIES = ["Feature Request", "Bug Report", "Question", "Other"] as const;
const MESSAGE_MAX = 4000;
const SUBJECT_MAX = 120;
const SUPPORT_EMAIL = "goassethub@gmail.com";

type SupportItem = {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-sky-100 text-sky-700 border-sky-200",
  open: "bg-amber-100 text-amber-700 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const CATEGORY_ICONS: Record<string, string> = {
  "Feature Request": "fa-wand-magic-sparkles",
  "Bug Report": "fa-bug",
  Question: "fa-circle-question",
  Other: "fa-ellipsis",
};

export function SupportClient({
  me,
  initial,
}: {
  me: { id: string; name: string; email: string; role: string };
  initial: SupportItem[];
}) {
  const [items, setItems] = useState<SupportItem[]>(initial);
  const [category, setCategory] = useState<string>("Feature Request");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not submit your message.");
      setSuccess(`Thank you, ${me.name}! Your message has been sent to ${SUPPORT_EMAIL}.`);
      if (data.feedback) setItems((prev) => [data.feedback, ...prev]);
      setSubject("");
      setMessage("");
      setCategory("Feature Request");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Support &amp; Feedback</h3>
        <p className="text-sm text-slate-500">
          Found an issue, want a feature, or have a question? Tell us — we read every message.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <form onSubmit={submit} className="card space-y-4 p-6 lg:col-span-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white">
              <i className="fa-solid fa-headset" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Send us a message</p>
              <p className="text-xs text-slate-500">
                Emailed to <span className="font-semibold text-slate-700">{SUPPORT_EMAIL}</span>. And expect a reply
                from the GoAssetHub team.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1">
                Subject <span className="normal-case text-slate-400">({subject.length}/{SUBJECT_MAX})</span>
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                className="input"
                placeholder="Short summary, e.g. Add dark mode"
                required
              />
            </div>
          </div>

          <div>
            <label className="label mb-1">
              Message <span className="normal-case text-slate-400">({message.length}/{MESSAGE_MAX})</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
              rows={6}
              className="input resize-none"
              placeholder="Tell us what's on your mind — steps to reproduce a bug, what you'd like to see, etc."
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              <i className="fa-solid fa-triangle-exclamation mr-1" /> {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <i className="fa-solid fa-circle-check mr-1" /> {success}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              <i className="fa-regular fa-envelope mr-1" />
              Average response time: within 1–2 business days.
            </p>
            <button type="submit" disabled={saving || message.length < 10} className="btn-primary">
              {saving ? (
                <><i className="fa-solid fa-spinner fa-spin" /> Sending…</>
              ) : (
                <><i className="fa-solid fa-paper-plane" /> Send feedback</>
              )}
            </button>
          </div>
        </form>

        {/* Side card */}
        <div className="lg:col-span-2">
          <div className="card space-y-4 bg-gradient-to-br from-primary-900 to-primary p-6 text-white">
            <p className="text-sm font-bold uppercase tracking-wider text-blue-300">Prefer email?</p>
            <p className="text-sm leading-relaxed text-blue-100">
              Reach the AssetHub team directly at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
                {SUPPORT_EMAIL}
              </a>
              . Replies to your messages come from your logged-in email address.
            </p>
            <ul className="space-y-2 text-xs text-blue-200">
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-check mt-0.5 text-accent" />
                <span><span className="font-semibold text-white">Feature requests</span> — we prioritise what our users ask for most.</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-check mt-0.5 text-accent" />
                <span><span className="font-semibold text-white">Bug reports</span> — include steps to reproduce and what you expected.</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-check mt-0.5 text-accent" />
                <span><span className="font-semibold text-white">Questions</span> — billing, plans, data, anything.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-bold text-slate-900">
            <i className="fa-solid fa-clock-rotate-left mr-2 text-primary" />
            Your messages
          </h4>
          <span className="pill border border-slate-200 bg-slate-100 text-slate-500">{items.length}</span>
        </div>

        {items.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <i className="fa-regular fa-message mb-3 text-3xl text-slate-300" />
            <p className="text-sm font-medium">No messages yet.</p>
            <p className="text-xs text-slate-400">Your submitted feedback will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cx(
                      "pill border",
                      item.category === "Bug Report"
                        ? "border-red-200 bg-red-100 text-red-700"
                        : item.category === "Feature Request"
                          ? "border-violet-200 bg-violet-100 text-violet-700"
                          : "border-slate-200 bg-slate-100 text-slate-600",
                    )}
                  >
                    <i className={cx("fa-solid mr-1 text-[10px]", CATEGORY_ICONS[item.category] ?? "fa-ellipsis")} />
                    {item.category}
                  </span>
                  <span className={cx("pill border", STATUS_STYLES[item.status] ?? STATUS_STYLES.new)}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                </div>
                <p className="mt-2 font-semibold text-slate-800">{item.subject}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{item.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
