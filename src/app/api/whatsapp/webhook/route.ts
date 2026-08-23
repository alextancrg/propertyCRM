import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentConfig, generateAgentReply, type ChatTurn, logAudit } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * Stub for the Meta WhatsApp Cloud API webhook.
 *
 * GET  — handles the verification handshake (hub.challenge).
 * POST — receives inbound messages; the AI agent replies if enabled.
 *
 * Production: point your Meta app's webhook to https://<domain>/api/whatsapp/webhook
 * and set WHATSAPP_VERIFY_TOKEN / WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID.
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

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const config = await getAgentConfig();

  // Extract a text message from the Meta payload (best-effort).
  const entries = payload?.entry ?? [];
  const firstMessage =
    entries[0]?.changes?.[0]?.value?.messages?.[0] ??
    entries[0]?.messaging?.[0]?.message;

  const inbound: string =
    typeof firstMessage?.text?.body === "string"
      ? firstMessage.text.body
      : "";

  if (!config.enabled || !inbound) {
    return NextResponse.json({ received: true, handled: false, reason: config.enabled ? "no-text" : "disabled" });
  }

  await prisma.chatMessage.create({
    data: { sessionId: "whatsapp", role: "tenant", content: inbound },
  });

  const history = await prisma.chatMessage.findMany({
    where: { sessionId: "whatsapp" },
    orderBy: { createdAt: "asc" },
  });
  const turns: ChatTurn[] = history.map((m) => ({
    role: m.role === "ai" ? "ai" : "tenant",
    content: m.content,
  }));

  const { reply } = await generateAgentReply(turns, config);

  await prisma.chatMessage.create({
    data: { sessionId: "whatsapp", role: "ai", content: reply },
  });

  await logAudit("WhatsApp", "AI_REPLY", `AI agent replied to tenant via WhatsApp.`);

  // NOTE: To actually send the reply to WhatsApp, call the Meta Graph API here:
  // POST https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
  // with the access token and the recipient phone number.

  return NextResponse.json({ received: true, handled: true, reply });
}
