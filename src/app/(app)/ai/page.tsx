import { prisma } from "@/lib/prisma";
import { AiSettings } from "@/components/ai/AiSettings";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  await requireUser();
  const cfg = await prisma.aiAgentConfig.findUnique({ where: { id: "default" } });
  const [messages, reminders] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { sessionId: "default" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.rentReminder.findMany({
      include: { lease: { include: { tenant: true, property: true } } },
      orderBy: { sentAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <AiSettings
      config={{
        enabled: cfg?.enabled ?? true,
        provider: cfg?.provider ?? "mock",
        model: cfg?.model ?? "gpt-4o-mini",
        systemPrompt: cfg?.systemPrompt ?? "",
        greeting: cfg?.greeting ?? "",
        escalationEmail: cfg?.escalationEmail ?? "",
        autonomyLevel: cfg?.autonomyLevel ?? "semi",
        autoRentReminder: cfg?.autoRentReminder ?? true,
        autoMaintenanceTriage: cfg?.autoMaintenanceTriage ?? true,
        autoViewingSchedule: cfg?.autoViewingSchedule ?? true,
        tenantNames: cfg?.tenantNames ?? "",
      }}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role as "ai" | "tenant", content: m.content }))}
      initialReminders={reminders.map((r) => ({
        id: r.id,
        month: r.month,
        stage: r.stage,
        message: r.message,
        self: r.self,
        sentAt: r.sentAt.toISOString(),
        property: r.lease.property.name,
        tenant: r.lease.tenant.name,
        phone: r.lease.tenant.phone,
      }))}
    />
  );
}
