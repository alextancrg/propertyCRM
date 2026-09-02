"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cx, formatDate } from "@/lib/format";
import { DOC_MAX_BYTES, DOC_MAX_BYTES_LABEL, formatBytes } from "@/lib/documents";

type DocDTO = {
  id: string;
  title: string;
  category: string;
  isStamped: boolean;
  fileUrl: string | null;
  file2Url: string | null; // 2nd attachment download link (?slot=2), null when absent
  year: number;
  leaseFrom: string | null; // "YYYY-MM-DD" — lease tenure start
  leaseTo: string | null; // "YYYY-MM-DD", or null = open-ended (until further notice)
  uploadedAt: string;
  propertyId: string | null;
  property: string | null;
  tenantId: string | null;
  tenant: string | null;
};

/** The property's current active lease — reused from Properties & Leases. */
type ActiveLease = {
  tenantId: string;
  tenantName: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string | null; // null = open-ended
};

type PropertyOption = {
  id: string;
  name: string;
  activeLease: ActiveLease | null;
};

const CATEGORY_ICON: Record<string, { icon: string; cls: string }> = {
  "Lease Agreement": { icon: "fa-file-signature", cls: "bg-purple-100 text-purple-600" },
  Receipt: { icon: "fa-receipt", cls: "bg-emerald-100 text-emerald-600" },
  Insurance: { icon: "fa-shield", cls: "bg-amber-100 text-amber-600" },
  Warranty: { icon: "fa-certificate", cls: "bg-sky-100 text-sky-600" },
  Title: { icon: "fa-landmark", cls: "bg-blue-100 text-blue-600" },
  Compliance: { icon: "fa-scale-balanced", cls: "bg-rose-100 text-rose-600" },
};

/**
 * Whether a document sits within the given search year, based on its lease
 * tenure (lease start → lease end). Open-ended leases (null end date, i.e.
 * "until further notice") always match — they must appear in every year's
 * search results.
 */
function docInYear(d: DocDTO, year: number): boolean {
  // Legacy docs (filed by year, no lease dates) → single-year tenure.
  if (d.leaseFrom === null && d.leaseTo === null) {
    return d.year === year;
  }
  // Open-ended lease (has a start date, no end date) → always matches any year.
  if (d.leaseTo === null) return true;
  const fromY = d.leaseFrom ? Number(d.leaseFrom.slice(0, 4)) : d.year;
  const toY = Number(d.leaseTo.slice(0, 4));
  return fromY <= year && year <= toY;
}

function tenureLabel(d: DocDTO): string | null {
  if (!d.leaseFrom) return null;
  const from = formatDate(new Date(`${d.leaseFrom}T00:00:00`));
  if (d.leaseTo === null) return `${from} – Open (until further notice)`;
  const to = formatDate(new Date(`${d.leaseTo}T00:00:00`));
  return `${from} – ${to}`;
}

export function DocumentsClient({
  documents,
  properties,
  tenants,
}: {
  documents: DocDTO[];
  properties: PropertyOption[];
  tenants: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocDTO | null>(null);
  // Property sections are collapsible/expandable — click a property header to
  // collapse or expand its documents. Default: all expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const categories = useMemo(() => Array.from(new Set(documents.map((d) => d.category))), [documents]);
  // Property filter options come from the properties documents are filed under.
  const propertyOptions = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.property) set.add(d.property);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [documents]);
  // Year options come from lease tenure years plus the current year.
  const yearOptions = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    documents.forEach((d) => {
      if (d.leaseFrom) set.add(Number(d.leaseFrom.slice(0, 4)));
      if (d.leaseTo) set.add(Number(d.leaseTo.slice(0, 4)));
      set.add(d.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [documents]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return documents.filter((d) => {
      // Search matches the title, property name and tenant name.
      const matchQ =
        !q ||
        d.title.toLowerCase().includes(q) ||
        (d.property ?? "").toLowerCase().includes(q) ||
        (d.tenant ?? "").toLowerCase().includes(q);
      const matchP = propertyFilter === "All" || d.property === propertyFilter;
      const matchC = catFilter === "All" || d.category === catFilter;
      const matchY = yearFilter === "all" || docInYear(d, Number(yearFilter));
      return matchQ && matchP && matchC && matchY;
    });
  }, [documents, query, propertyFilter, catFilter, yearFilter]);

  // Group by property (one collapsible section per property), sorted
  // alphabetically with unassigned documents last; documents inside a property
  // are newest first.
  const propertyGroups = useMemo(() => {
    const NONE = "__none__";
    const byProp = new Map<string, { key: string; name: string; docs: DocDTO[] }>();
    [...filtered]
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .forEach((d) => {
        const key = d.propertyId ?? NONE;
        const name = d.property ?? "No property";
        const g = byProp.get(key) ?? { key, name, docs: [] };
        g.docs.push(d);
        byProp.set(key, g);
      });
    return Array.from(byProp.values()).sort((a, b) => {
      if (a.key === NONE) return 1;
      if (b.key === NONE) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Document Vault</h3>
          <p className="text-sm text-slate-500">Secure system of record for leases, receipts, insurance, titles and warranties.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary self-start sm:self-auto">
          <i className="fa-solid fa-file-arrow-up" /> Upload Document
        </button>
      </div>

      {/* Search + year + category filter */}
      <div className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, property or tenant…" className="input pl-11" />
        </div>
        <div className="relative md:w-64">
          <i className="fa-solid fa-building absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="input pl-9 cursor-pointer">
            <option value="All">All properties</option>
            {propertyOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="relative md:w-48">
          <i className="fa-regular fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="input pl-9 cursor-pointer">
            <option value="all">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="relative md:w-56">
          <i className="fa-solid fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input pl-9 cursor-pointer">
            <option>All</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grouped by property — collapsible sections */}
      {propertyGroups.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <i className="fa-solid fa-folder-open mb-3 text-4xl text-slate-300" />
          <p className="text-lg font-medium">No documents found.</p>
        </div>
      ) : (
        propertyGroups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          return (
            <div key={group.key} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCollapsed(group.key)}
                className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4 text-left transition hover:brightness-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <i className="fa-solid fa-building" />
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">{group.name}</h4>
                    <p className="text-xs text-slate-500">
                      {group.docs.length} document{group.docs.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                  <i className={cx("fa-solid transition-transform", isCollapsed ? "fa-chevron-down" : "fa-chevron-up")} />
                </span>
              </button>

              {isCollapsed ? (
                <p className="px-6 py-4 text-xs text-slate-400">
                  <i className="fa-regular fa-eye-slash mr-1" />
                  {group.docs.length} document{group.docs.length === 1 ? "" : "s"} — click the header to expand.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {group.docs.map((d) => {
                    const meta = CATEGORY_ICON[d.category] ?? { icon: "fa-file", cls: "bg-slate-100 text-slate-500" };
                    return (
                      <li key={d.id} className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50">
                        <div className={cx("grid h-11 w-11 place-items-center rounded-xl", meta.cls)}>
                          <i className={`fa-solid ${meta.icon}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-800">{d.title}</p>
                            {d.isStamped && (
                              <span className="pill bg-green-100 text-green-700">
                                <i className="fa-solid fa-stamp" /> Stamped
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-500">
                            {d.category}
                            {d.property ? ` · ${d.property}` : ""}
                            {d.tenant ? ` · ${d.tenant}` : ""}
                          </p>
                          {d.leaseFrom && (
                            <p className="mt-0.5 text-[11px] font-medium text-primary/80">
                              <i className="fa-solid fa-calendar mr-1" />
                              Lease: {tenureLabel(d)}
                            </p>
                          )}
                        </div>
                        <span className="hidden shrink-0 text-xs font-medium text-slate-400 sm:block">{formatDate(d.uploadedAt)}</span>
                        <button
                          onClick={() => setEditing(d)}
                          className="btn-ghost !px-3 !py-1.5 text-xs"
                          title="Update lease dates / details"
                        >
                          <i className="fa-solid fa-pen" /> Edit
                        </button>
                        {d.fileUrl || d.file2Url ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            {d.fileUrl ? (
                              <a
                                href={d.fileUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="btn-ghost !px-3 !py-1.5 text-xs"
                                title="Click to download"
                              >
                                <i className="fa-solid fa-download" /> Download
                              </a>
                            ) : null}
                            {d.file2Url ? (
                              <a
                                href={d.file2Url}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="btn-ghost !px-3 !py-1.5 text-xs"
                                title="Download the 2nd attachment"
                              >
                                <i className="fa-solid fa-paperclip" /> Attachment 2
                              </a>
                            ) : null}
                          </div>
                        ) : (
                          <span className="rounded-lg border border-dashed border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400">
                            No file
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}

      {(showModal || editing) && (
        <UploadModal
          doc={editing}
          properties={properties}
          tenants={tenants}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowModal(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  doc,
  properties,
  tenants,
  onClose,
  onSaved,
}: {
  doc: DocDTO | null;
  properties: PropertyOption[];
  tenants: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(doc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [file2Error, setFile2Error] = useState<string | null>(null);
  // Open-ended = no end date (until further notice).
  const [openEnded, setOpenEnded] = useState(doc ? doc.leaseTo === null : false);
  // Tenant + lease dates are auto-filled from the chosen property's ACTIVE
  // lease (the Properties & Leases section). Kept as controlled state.
  const [propId, setPropId] = useState(doc?.propertyId ?? "");
  const [tenantId, setTenantId] = useState(doc?.tenantId ?? "");
  const [leaseFrom, setLeaseFrom] = useState(doc?.leaseFrom ?? "");
  const [leaseTo, setLeaseTo] = useState(doc?.leaseTo ?? "");
  // Editing a document that already has a 2nd attachment → option to remove it.
  const [removeFile2, setRemoveFile2] = useState(false);

  function applyProperty(p: PropertyOption | undefined) {
    setPropId(p?.id ?? "");
    if (p?.activeLease) {
      setTenantId(p.activeLease.tenantId);
      setLeaseFrom(p.activeLease.startDate);
      setLeaseTo(p.activeLease.endDate ?? "");
      setOpenEnded(p.activeLease.endDate === null);
    } else {
      setTenantId("");
      setLeaseFrom("");
      setLeaseTo("");
      setOpenEnded(false);
    }
  }

  // Document bytes ride in a single request body, and the host (Vercel) caps
  // the request at 4.5 MB — reject oversized files up front with a clear
  // message instead of letting the upload fail with an opaque error.
  function fileTooBig(f: File | undefined | null): string | null {
    if (!f || f.size <= DOC_MAX_BYTES) return null;
    return `“${f.name}” is ${formatBytes(f.size)} — the maximum upload size is ${DOC_MAX_BYTES_LABEL}. Please compress the file (e.g. re-scan at a lower resolution) and try again.`;
  }

  async function saveForm(url: string, method: string, body: FormData): Promise<Response> {
    const res = await fetch(url, { method, body });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let msg = "Could not save the document. Please try again.";
      if (text) {
        try {
          const data = JSON.parse(text) as { error?: string };
          msg = data.error || msg;
        } catch {
          // Non-JSON body (e.g. the host's 413 FUNCTION_PAYLOAD_TOO_LARGE).
          if (res.status === 413 || /payload too large|request entity too large/i.test(text)) {
            msg = `The file is too large to upload — the maximum is ${DOC_MAX_BYTES_LABEL}. Please compress the PDF and try again.`;
          } else if (text.trim().length < 300) {
            msg = text.trim();
          }
        }
      }
      throw new Error(msg);
    }
    return res;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFileError(null);
    setFile2Error(null);
    try {
      const formEl = e.currentTarget;
      const file1 = (formEl.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0];
      const file2 = (formEl.elements.namedItem("file2") as HTMLInputElement | null)?.files?.[0];
      if (file1 && file1.size > DOC_MAX_BYTES) throw new Error(fileTooBig(file1) ?? "File is too large to upload.");
      if (file2 && file2.size > DOC_MAX_BYTES) throw new Error(fileTooBig(file2) ?? "File is too large to upload.");

      // A document holds up to 2 attachments. The host caps a single request
      // body at ~4.5 MB, so when a 2nd file is picked it is sent as its own
      // follow-up request — each request stays safely under the body cap.
      const main = new FormData(formEl);
      main.delete("file2");
      if (openEnded) main.set("leaseTo", "");
      main.set("openEnded", openEnded ? "true" : "false");
      // Always send the stamp flag so it can be toggled off when editing.
      main.set("isStamped", main.get("isStamped") === "true" ? "true" : "false");
      if (removeFile2) main.set("clearFile2", "true");

      const url = isEdit ? `/api/documents/${doc!.id}` : "/api/documents";
      const method = isEdit ? "PATCH" : "POST";
      const res = await saveForm(url, method, main);
      const saved = (await res.json().catch(() => ({}))) as { document?: { id?: string } };
      const docId = isEdit ? doc!.id : saved.document?.id;

      // Optional 2nd attachment — a separate PATCH so both files never share
      // one (potentially too-large) request body.
      if (file2 && docId) {
        const second = new FormData(formEl);
        second.delete("file");
        if (openEnded) second.set("leaseTo", "");
        second.set("openEnded", openEnded ? "true" : "false");
        second.set("isStamped", main.get("isStamped") === "true" ? "true" : "false");
        await saveForm(`/api/documents/${docId}`, "PATCH", second);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the document. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h3 className="font-bold text-slate-900">{isEdit ? "Edit Document" : "Upload Document"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <i className="fa-solid fa-xmark text-xl" />
          </button>
        </div>
        <div className="grid gap-4 p-6">
          <div>
            <label className="label mb-1">Title</label>
            <input name="title" className="input" placeholder="e.g. Tenancy Agreement — Apt 4B" defaultValue={doc?.title ?? ""} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1">Category</label>
              <select name="category" className="input cursor-pointer" defaultValue={doc?.category ?? ""}>
                <option value="" disabled>Select category</option>
                <option>Lease Agreement</option>
                <option>Receipt</option>
                <option>Insurance</option>
                <option>Warranty</option>
                <option>Title</option>
                <option>Compliance</option>
              </select>
            </div>
            <div>
              <label className="label mb-1">Property</label>
              <select
                name="propertyId"
                value={propId}
                onChange={(e) => {
                  const chosen = e.target.value;
                  setPropId(chosen);
                  applyProperty(properties.find((p) => p.id === chosen));
                }}
                className="input cursor-pointer"
              >
                <option value="">— None —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Tenant &amp; lease dates fill in automatically from this property&apos;s active lease.
              </p>
            </div>
            <div>
              <label className="label mb-1">Tenant</label>
              <select name="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="input cursor-pointer">
                <option value="">— None —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1">Lease from date</label>
              <input name="leaseFrom" type="date" value={leaseFrom} onChange={(e) => setLeaseFrom(e.target.value)} className="input cursor-pointer" />
            </div>
            <div>
              <label className="label mb-1">Lease to date</label>
              <input
                name="leaseTo"
                type="date"
                value={leaseTo}
                disabled={openEnded}
                onChange={(e) => setLeaseTo(e.target.value)}
                className="input cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              />
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={openEnded}
                  onChange={(e) => setOpenEnded(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>Lease is infinite — until further notice (no end date)</span>
              </label>
            </div>
            <div className="col-span-2 space-y-3">
              <div>
                <label className="label mb-1">{isEdit ? "Attachment 1 (replace, optional)" : "Attachment 1"}</label>
                <input
                  name="file"
                  type="file"
                  onChange={(e) => setFileError(fileTooBig(e.target.files?.[0]))}
                  className="input file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
                />
                {fileError && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-red-600">
                    <i className="fa-solid fa-triangle-exclamation mt-0.5" />
                    {fileError}
                  </p>
                )}
              </div>
              <div>
                <label className="label mb-1">Attachment 2 (optional)</label>
                <input
                  name="file2"
                  type="file"
                  onChange={(e) => {
                    setFile2Error(fileTooBig(e.target.files?.[0]));
                    if (e.target.files?.[0]) setRemoveFile2(false);
                  }}
                  className="input file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold"
                />
                {file2Error && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-red-600">
                    <i className="fa-solid fa-triangle-exclamation mt-0.5" />
                    {file2Error}
                  </p>
                )}
              </div>
              {isEdit && doc?.file2Url && !removeFile2 && (
                <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={removeFile2}
                    onChange={(e) => setRemoveFile2(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>Remove the existing 2nd attachment on save</span>
                </label>
              )}
              <p className="text-[11px] text-slate-400">
                Up to 2 attachments per document · maximum file size per attachment: {DOC_MAX_BYTES_LABEL}
              </p>
            </div>
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <i className="fa-solid fa-circle-info mr-1" />
            {isEdit
              ? "If the lease end date wasn't confirmed when this document was filed, update it here once the end date is determined."
              : "Lease end date not determined yet? Tick “Lease is infinite” and file the document. When the end date is later confirmed, use Edit on the document to update it."}
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="isStamped"
              value="true"
              defaultChecked={doc?.isStamped ?? false}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Legally stamped / legalized (e.g. LHDN)
          </label>
        </div>
        {error && <p className="px-6 pb-2 text-sm font-medium text-red-500">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : isEdit ? "Save changes" : "Upload"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
