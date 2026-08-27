import crypto from "crypto";
import { prisma } from "./prisma";
import { getUserWhatsappLimit } from "./billing";
import { visiblePropertyIds, type SessionUser } from "./access";

// ---------------------------------------------------------------------------
// Twilio WhatsApp configuration (env vars — never store secrets in the DB).
//   TWILIO_ACCOUNT_SID      — Twilio account SID
//   TWILIO_AUTH_TOKEN       — Twilio auth token
//   TWILIO_WHATSAPP_FROM    — the Twilio WhatsApp sender, e.g. "whatsapp:+14155238886"
//                             (the sandbox/approved sender number from Twilio)
// Outbound messages are sent to the Twilio Messages API:
//   POST /2010-04-01/Accounts/{SID}/Messages.json  with To=whatsapp:+<E.164>
// ---------------------------------------------------------------------------

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
// Optional approved WhatsApp Content Template SIDs, per language. When set,
// outbound messages are sent with ContentSid + ContentVariables instead of a
// free-form Body — required by WhatsApp for proactive messages sent outside the
// 24-hour session window. Placeholders used by the app:
//   Rent reminder / test (TWILIO_WHATSAPP_CONTENT_SID[_MS|_ZH]):
//     {{1}} = tenant name · {{2}} = rent amount · {{3}} = unit · {{4}} = due date
//   Self-escalation alert (TWILIO_WHATSAPP_CONTENT_SID_ESCALATION[_MS|_ZH]):
//     {{1}} = unit · {{2}} = tenant name · {{3}} = tenant phone · {{4}} = amount · {{5}} = due date
const CONTENT_SIDS: Record<string, string | null> = {
  en: process.env.TWILIO_WHATSAPP_CONTENT_SID || null,
  ms: process.env.TWILIO_WHATSAPP_CONTENT_SID_MS || null,
  "zh-CN": process.env.TWILIO_WHATSAPP_CONTENT_SID_ZH || null,
};
const CONTENT_SIDS_ESCALATION: Record<string, string | null> = {
  en: process.env.TWILIO_WHATSAPP_CONTENT_SID_ESCALATION || null,
  ms: process.env.TWILIO_WHATSAPP_CONTENT_SID_ESCALATION_MS || null,
  "zh-CN": process.env.TWILIO_WHATSAPP_CONTENT_SID_ESCALATION_ZH || null,
};

/** Normalize a language tag for template lookup (falls back to English). */
function templateLanguage(lang: string | null | undefined): "en" | "ms" | "zh-CN" {
  return lang === "ms" || lang === "zh-CN" ? lang : "en";
}

/**
 * Validate an incoming Twilio webhook signature (the X-Twilio-Signature header)
 * using the same canonical-string construction as Twilio's official
 * request validator: HMAC-SHA1 over
 *   `{full URL}{POST params sorted by key, each concatenated as key+value with no delimiters}`
 * where the param values are the URL-decoded form values (matches Twilio's
 * signing of WhatsApp/voice webhooks, including non-ASCII message bodies).
 * Returns false when the signature header is missing or does not match.
 */
export function validateTwilioRequest(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  return expected === signature;
}

/** Whether Twilio WhatsApp credentials are configured. */
export function twilioConfigured(): boolean {
  return Boolean(TWILIO_SID && TWILIO_TOKEN);
}

export type MessageStatus =
  | "SENT"
  | "SKIPPED_QUOTA"
  | "TWILIO_NOT_CONFIGURED"
  | "FAILED"
  | "INFO"; // informational feed entry (e.g. auto-removal notice), not a send

type LogInput = {
  userId?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  tenantName?: string | null;
  propertyName?: string | null;
  action: string;
  status?: MessageStatus;
  recipient?: string | null;
  message?: string | null;
};

/** Record an outbound WhatsApp attempt / informational feed entry. */
export async function logWhatsAppMessage(input: LogInput): Promise<void> {
  await prisma.whatsAppMessageLog.create({
    data: {
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? null,
      propertyId: input.propertyId ?? null,
      tenantName: input.tenantName ?? null,
      propertyName: input.propertyName ?? null,
      action: input.action,
      status: input.status ?? "SENT",
      recipient: input.recipient ?? null,
      message: input.message ?? null,
    },
  });
}

function monthWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

/** How many WhatsApp messages the user has actually sent this month. */
export async function countWhatsappUsed(user: SessionUser, now = new Date()): Promise<number> {
  const { start, end } = monthWindow(now);
  const where = { status: "SENT", createdAt: { gte: start, lt: end } };
  if (user.role !== "Administrator") {
    return prisma.whatsAppMessageLog.count({ where: { ...where, userId: user.id } });
  }
  return prisma.whatsAppMessageLog.count({ where });
}

export type WhatsappUsage = {
  limit: number | null; // null = unlimited (Administrator)
  used: number;
  left: number | null; // null = unlimited
};

/** The user's monthly WhatsApp allowance vs. usage. */
export async function getWhatsappUsage(user: SessionUser, now = new Date()): Promise<WhatsappUsage> {
  const limit = await getUserWhatsappLimit(user);
  const used = await countWhatsappUsed(user, now);
  const left = limit === null ? null : Math.max(0, limit - used);
  return { limit, used, left };
}

/** Send a real WhatsApp message through the Twilio API (no logging). */
export async function sendWhatsAppMessage(opts: {
  to: string; // E.164 phone, e.g. "+60123456789"
  body: string;
  contentSid?: string | null;
  contentVariables?: Record<string, string> | null;
}): Promise<{ ok: boolean; sid?: string; reason?: string }> {
  if (!twilioConfigured()) return { ok: false, reason: "twilio-not-configured" };
  try {
    const params = new URLSearchParams({ From: TWILIO_FROM, To: `whatsapp:${opts.to}` });
    const contentSid = opts.contentSid ?? null;
    if (contentSid && opts.contentVariables) {
      // WhatsApp Content API — send via the approved template.
      params.set("ContentSid", contentSid);
      params.set("ContentVariables", JSON.stringify(opts.contentVariables));
    } else {
      params.set("Body", opts.body);
    }
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
        },
        body: params,
      },
    );
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) return { ok: false, reason: data?.message ?? "twilio-error" };
    return { ok: true, sid: data?.sid };
  } catch {
    return { ok: false, reason: "twilio-error" };
  }
}

export type DispatchInput = {
  user: SessionUser;
  tenantId?: string | null;
  propertyId?: string | null;
  tenantName?: string | null;
  propertyName?: string | null;
  phone?: string | null;
  action: string;
  body: string;
  /** When set (and a matching TWILIO_WHATSAPP_CONTENT_SID* is configured), sends via the approved template. */
  contentVariables?: Record<string, string> | null;
  /** Optional explicit template SID (defaults to per-language SID by action). */
  contentSid?: string | null;
  /** Recipient language ("en" | "ms" | "zh-CN") — selects the per-language template SID. Defaults to English. */
  language?: string | null;
  now?: Date;
};

/**
 * The one entry point the reminder engine / AI agent uses to message a tenant.
 * Enforces the plan's monthly WhatsApp quota, sends via Twilio, and logs every
 * attempt (even blocked ones) so the Dashboard's "AI Agent Actions" feed shows
 * exactly what the agent tried and when.
 */
export async function dispatchWhatsAppMessage(
  input: DispatchInput,
): Promise<{ status: MessageStatus; sid?: string; reason?: string }> {
  const now = input.now ?? new Date();
  const base = {
    userId: input.user.id,
    tenantId: input.tenantId ?? null,
    propertyId: input.propertyId ?? null,
    tenantName: input.tenantName ?? null,
    propertyName: input.propertyName ?? null,
    action: input.action,
    message: input.body,
  };

  if (!input.phone) {
    await logWhatsAppMessage({ ...base, status: "FAILED", recipient: null, message: `${input.body} (no phone on file)` });
    return { status: "FAILED", reason: "no-phone" };
  }

  const usage = await getWhatsappUsage(input.user, now);
  if (usage.limit !== null && usage.used >= usage.limit) {
    await logWhatsAppMessage({
      ...base,
      status: "SKIPPED_QUOTA",
      recipient: input.phone,
      message: `${input.body} (monthly WhatsApp quota of ${usage.limit} reached — skipped)`,
    });
    return { status: "SKIPPED_QUOTA", reason: "quota-exhausted" };
  }

  const lang = templateLanguage(input.language);
  const sids = input.action === "SELF_ALERT" ? CONTENT_SIDS_ESCALATION : CONTENT_SIDS;
  const contentSid = input.contentSid ?? sids[lang] ?? null;
  const res = await sendWhatsAppMessage({
    to: input.phone,
    body: input.body,
    contentSid,
    contentVariables: input.contentVariables ?? null,
  });
  const status: MessageStatus = res.ok ? "SENT" : res.reason === "twilio-not-configured" ? "TWILIO_NOT_CONFIGURED" : "FAILED";
  // Persist the real Twilio error so the dashboard can show WHY a send failed
  // (auth 401, invalid sender, session/template, quota, etc.) instead of a
  // bare "Failed".
  await logWhatsAppMessage({
    ...base,
    status,
    recipient: input.phone,
    message:
      status === "FAILED"
        ? `${input.body}\n[Twilio: ${res.reason ?? "unknown error"}]`
        : input.body,
  });
  return { status, sid: res.sid, reason: res.reason };
}

// ---------------------------------------------------------------------------
// Authorized tenants
// ---------------------------------------------------------------------------

export type TenantOption = {
  id: string;
  name: string;
  phone: string | null;
  unit: string; // the unit(s) the tenant leases
};

/**
 * Eligible tenants for the current manager: tenants with an active lease on a
 * unit the manager manages (visible properties), deduplicated.
 */
export async function getEligibleTenants(user: SessionUser): Promise<TenantOption[]> {
  const propIds = await visiblePropertyIds(user);

  // Only tenants with a currently-running lease on a managed unit are eligible
  // (an expired-but-not-yet-marked lease no longer makes a tenant eligible).
  const now = new Date();
  const leases = await prisma.lease.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      property: { deletedAt: null, ...(propIds ? { id: { in: propIds } } : {}) },
    },
    include: { tenant: { select: { id: true, name: true, phone: true } }, property: { select: { name: true } } },
    orderBy: { endDate: "asc" },
  });

  const map = new Map<string, TenantOption>();
  for (const lease of leases) {
    const t = lease.tenant;
    const existing = map.get(t.id);
    if (existing) {
      existing.unit = `${existing.unit}, ${lease.property.name}`;
    } else {
      map.set(t.id, { id: t.id, name: t.name, phone: t.phone, unit: lease.property.name });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** The tenant ids currently authorized by the user. */
export async function getAuthorizedTenantIds(user: SessionUser): Promise<string[]> {
  const rows = await prisma.aiAuthorizedTenant.findMany({
    where: { userId: user.id },
    select: { tenantId: true },
  });
  return rows.map((r) => r.tenantId);
}

/**
 * Replace the user's authorized-tenant list. Only tenants that are currently
 * eligible (visible to the manager) may be added.
 */
export async function setAuthorizedTenants(user: SessionUser, tenantIds: string[]): Promise<void> {
  const eligible = await getEligibleTenants(user);
  const eligibleIds = new Set(eligible.map((t) => t.id));
  const allowed = Array.from(new Set(tenantIds)).filter((id) => eligibleIds.has(id));

  const current = await prisma.aiAuthorizedTenant.findMany({
    where: { userId: user.id },
    select: { tenantId: true },
  });
  const currentIds = new Set(current.map((c) => c.tenantId));

  const toAdd = allowed.filter((id) => !currentIds.has(id));
  const toRemove = current.filter((c) => !allowed.includes(c.tenantId));

  if (toAdd.length) {
    await prisma.aiAuthorizedTenant.createMany({
      data: toAdd.map((tenantId) => ({ userId: user.id, tenantId })),
    });
  }
  if (toRemove.length) {
    await prisma.aiAuthorizedTenant.deleteMany({
      where: { userId: user.id, tenantId: { in: toRemove.map((r) => r.tenantId) } },
    });
  }
}

/**
 * Automatically remove authorized tenants whose lease expired more than a week
 * ago, and inform the property manager (audit trail + AI Agent Actions feed).
 * Returns how many tenants were pruned.
 */
export async function pruneExpiredAuthorizedTenants(
  user: SessionUser,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const authorized = await prisma.aiAuthorizedTenant.findMany({
    where: { userId: user.id },
    include: {
      tenant: {
        include: {
          leases: {
            where: { status: "ACTIVE" },
            select: { endDate: true, propertyId: true, property: { select: { name: true } } },
          },
        },
      },
    },
  });

  let removed = 0;
  for (const auth of authorized) {
    // Keep the tenant if any active lease is still running, or ended within the
    // 7-day grace period. Otherwise the lease has been expired for over a week.
    const kept = auth.tenant.leases.some((l) => !l.endDate || l.endDate >= cutoff);
    if (kept) continue;

    const latestLease = auth.tenant.leases[0];
    const unit = latestLease?.property.name ?? "n/a";
    const expiredOn = latestLease?.endDate?.toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) ?? "n/a";

    await prisma.aiAuthorizedTenant.delete({ where: { id: auth.id } });
    await prisma.auditLog.create({
      data: {
        entityType: "Tenant",
        action: "AUTO_REMOVED",
        description: `Authorized tenant ${auth.tenant.name} (${unit}) removed from the WhatsApp AI agent — lease expired ${expiredOn}.`,
        entityId: auth.tenantId,
        userId: user.id,
      },
    });
    await logWhatsAppMessage({
      userId: user.id,
      tenantId: auth.tenantId,
      propertyId: latestLease?.propertyId ?? null,
      tenantName: auth.tenant.name,
      propertyName: unit,
      action: "AUTO_REMOVED",
      status: "INFO",
      message: `Removed from WhatsApp AI agent — lease expired ${expiredOn}.`,
    });
    removed++;
  }

  return removed;
}
