import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentConfig, generateAgentReply, type ChatTurn } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = "default";
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "default";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const config = await getAgentConfig();

  if (!config.enabled) {
    return NextResponse.json(
      {
        reply:
          "The WhatsApp AI agent is currently disabled. Your message has been recorded and the property manager will follow up personally.",
        enabled: false,
      },
      { status: 200 },
    );
  }

  // Persist the tenant's inbound message.
  await prisma.chatMessage.create({
    data: { sessionId, role: "tenant", content: message },
  });

  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  const turns: ChatTurn[] = history.map((m) => ({
    role: m.role === "ai" ? "ai" : "tenant",
    content: m.content,
  }));

  const { reply, provider } = await generateAgentReply(turns, config);

  await prisma.chatMessage.create({
    data: { sessionId, role: "ai", content: reply },
  });

  return NextResponse.json({ reply, enabled: true, provider });
}

export async function DELETE() {
  await prisma.chatMessage.deleteMany({ where: { sessionId: "default" } });
  return NextResponse.json({ ok: true });
}
