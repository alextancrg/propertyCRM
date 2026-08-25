import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getAgentConfig();
  return NextResponse.json({ config });
}

type UpdateData = Partial<{
  enabled: boolean;
  provider: string;
  model: string;
  systemPrompt: string;
  greeting: string;
  escalationEmail: string | null;
  autonomyLevel: string;
  autoRentReminder: boolean;
  autoMaintenanceTriage: boolean;
  autoViewingSchedule: boolean;
  tenantNames: string;
}>;

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const data: UpdateData = {};
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body.provider === "string") data.provider = body.provider;
  if (typeof body.model === "string") data.model = body.model;
  if (typeof body.systemPrompt === "string") data.systemPrompt = body.systemPrompt;
  if (typeof body.greeting === "string") data.greeting = body.greeting;
  if (body.escalationEmail !== undefined) data.escalationEmail = body.escalationEmail || null;
  if (body.autonomyLevel === "semi" || body.autonomyLevel === "full") data.autonomyLevel = body.autonomyLevel;
  if (typeof body.autoRentReminder === "boolean") data.autoRentReminder = body.autoRentReminder;
  if (typeof body.autoMaintenanceTriage === "boolean") data.autoMaintenanceTriage = body.autoMaintenanceTriage;
  if (typeof body.autoViewingSchedule === "boolean") data.autoViewingSchedule = body.autoViewingSchedule;
  if (typeof body.tenantNames === "string") data.tenantNames = body.tenantNames;

  const config = await prisma.aiAgentConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enabled: true,
      provider: "deepseek",
      model: "deepseek-v4-flash",
      systemPrompt: "You are the AI assistant for a property management office.",
      greeting: "Hi, this is the property management office. How can I help you today?",
      ...data,
    },
    update: { ...data },
  });

  return NextResponse.json({ config, ok: true });
}
