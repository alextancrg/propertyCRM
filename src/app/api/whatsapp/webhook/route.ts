import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentConfig, generateAgentReply, type ChatTurn, logAudit } from "@/lib/ai";
import {
  dispatchWhatsAppMessage,
  expectedTwilioSignature,
  validateTwilioRequest,
} from "@/lib/whatsapp";
import type { SessionUser } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * WhatsApp inbound webhook — supports Twilio WhatsApp (form-encoded) and the
 * legacy Meta Cloud API (JSON) payloads.
 *
 * Twilio setup: point your Twilio WhatsApp sender's "When a message comes in"
 * webhook to https://<domain>/api/whatsapp/webhook (method POST). Required env
 * vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.
 *
 * GET — legacy Meta verification handshake (hub.challenge).
 */
export async function GET(req: NextRequest) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = req.nextUrl.searchParams.get("hub.verify_token");

  if (mode === "subscribe" && token && verifyToken === token) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Find the tenant whose phone matches an inbound sender number (plus an active unit). */
async function findTenantByPhone(from: string): Promise<{ id: string; name: string; phone: string | null; propertyId: string | null } | null> {
  const norm = normalizePhone(from);
  if (!norm) return null;
  const tenants = await prisma.tenant.findMany({
    where: { phone: { not: null } },
    include: { leases: { where: { status: "ACTIVE" }, select: { propertyId: true }, take: 1 } },
  });
  const match = tenants.find((t) => normalizePhone(t.phone) === norm);
  if (!match) return null;
  return { id: match.id, name: match.name, phone: match.phone, propertyId: match.leases[0]?.propertyId ?? null };
}

/** Which manager should be charged for replying to this tenant (their authorizer). */
async function actorForTenant(tenantId: string | null): Promise<SessionUser | null> {
  if (!tenantId) return null;
  const auth = await prisma.aiAuthorizedTenant.findFirst({
    where: { tenantId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!auth?.user) return null;
  return auth.user;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const config = await getAgentConfig();

  // --- Parse the inbound message from either payload format ---
  let inbound = "";
  let from = "";
  let metaFormat = false;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const form = new URLSearchParams(text);

    // Twilio signature validation — only enforced when the auth token is
    // configured, so the endpoint still works in local/dev without Twilio creds.
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = req.headers.get("x-twilio-signature") ?? "";
      const proto = req.headers.get("x-forwarded-proto") ?? "https";
      const host = req.headers.get("host") ?? "";
      // Full public URL exactly as configured in Twilio (no query string here).
      const fullUrl = `${proto}://${host}${req.nextUrl.pathname}`;
      const params: Record<string, string> = {};
      for (const [k, v] of form.entries()) params[k] = v;
      if (!validateTwilioRequest(authToken, signature, fullUrl, params)) {
        // TEMP DEBUG — remove after diagnosing signature mismatch.
        return NextResponse.json(
          {
            error: "invalid twilio signature",
            fullUrl,
            params,
            expected: expectedTwilioSignature(authToken, fullUrl, params),
            received: signature,
          },
          { status: 403 },
        );
      }
    }

    inbound = form.get("Body") ?? "";
    from = form.get("From") ?? ""; // e.g. "whatsapp:+60123456789"
  } else {
    const payload = await req.json().catch(() => ({}));
    const entries = payload?.entry ?? [];
    const firstMessage =
      entries[0]?.changes?.[0]?.value?.messages?.[0] ?? entries[0]?.messaging?.[0]?.message;
    inbound = typeof firstMessage?.text?.body === "string" ? firstMessage.text.body : "";
    from = typeof firstMessage?.from === "string" ? firstMessage.from : "";
    metaFormat = true;
  }

  if (!inbound) {
    return NextResponse.json({ received: true, handled: false, reason: "no-text" });
  }
  if (!config.enabled) {
    // Record but do not answer.
    return NextResponse.json({ received: true, handled: false, reason: "disabled" });
  }

  const tenant = await findTenantByPhone(from);

  // Attribute the reply to the manager who authorized this tenant (falls back
  // to an unlimited system actor so the conversation is not dropped).
  const actor: SessionUser =
    (await actorForTenant(tenant?.id ?? null)) ?? {
      id: "system",
      name: "System",
      email: "system@goassethub.com",
      role: "Administrator",
    };

  const sessionId = tenant ? `tenant:${tenant.id}` : "whatsapp";
  await prisma.chatMessage.create({
    data: { sessionId, role: "tenant", content: inbound },
  });

  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  const turns: ChatTurn[] = history.map((m) => ({
    role: m.role === "ai" ? "ai" : "tenant",
    content: m.content,
  }));

  const { reply } = await generateAgentReply(turns, config);

  await prisma.chatMessage.create({
    data: { sessionId, role: "ai", content: reply },
  });

  // Send the reply back through Twilio (quota-checked and logged).
  await dispatchWhatsAppMessage({
    user: actor,
    tenantId: tenant?.id ?? null,
    propertyId: tenant?.propertyId ?? null,
    tenantName: tenant?.name ?? "Unknown",
    action: "CHAT_REPLY",
    phone: from ? from.replace(/^whatsapp:/, "") : null,
    body: reply,
  });

  await logAudit("WhatsApp", "AI_REPLY", `AI agent replied to tenant${tenant ? ` ${tenant.name}` : ""} via WhatsApp.`);

  // Twilio expects an acknowledgement — a plain ok (or empty TwiML) confirms receipt.
  if (metaFormat) {
    return NextResponse.json({ received: true, handled: true, reply });
  }
  return new NextResponse("", { status: 200, headers: { "Content-Type": "text/plain" } });
}
