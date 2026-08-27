import { prisma } from "@/lib/prisma";
import { AiSettings } from "@/components/ai/AiSettings";
import { requireUser } from "@/lib/auth";
import { getAgentConfig } from "@/lib/ai";
import { visiblePropertyIds } from "@/lib/access";
import { getSubscriptionView } from "@/lib/billing";
import {
  getEligibleTenants,
  getAuthorizedTenantIds,
  getWhatsappUsage,
  pruneExpiredAuthorizedTenants,
  twilioConfigured,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const me = await requireUser();
  // Remove authorized tenants whose lease expired over a week ago + notify.
  const pruned = await pruneExpiredAuthorizedTenants(me);

  const [cfg, eligible, authorized, usage, sub, messages, propIds] = await Promise.all([
    getAgentConfig(),
    getEligibleTenants(me),
    getAuthorizedTenantIds(me),
    getWhatsappUsage(me),
    getSubscriptionView(me.id),
    prisma.chatMessage.findMany({
      where: { sessionId: "default" },
      orderBy: { createdAt: "asc" },
    }),
    visiblePropertyIds(me),
  ]);

  const reminders = await prisma.rentReminder.findMany({
    where: propIds ? { lease: { propertyId: { in: propIds } } } : {},
    include: { lease: { include: { tenant: true, property: true } } },
    orderBy: { sentAt: "desc" },
    take: 50,
  });

  return (
    <AiSettings
      me={{ id: me.id, name: me.name, email: me.email, role: me.role }}
      planName={sub.planName}
      config={{
        enabled: cfg.enabled,
        provider: cfg.provider,
        model: cfg.model,
        systemPrompt: cfg.systemPrompt,
        greeting: cfg.greeting,
        escalationEmail: cfg.escalationEmail ?? "",
        autonomyLevel: cfg.autonomyLevel,
        autoRentReminder: cfg.autoRentReminder,
        autoMaintenanceTriage: cfg.autoMaintenanceTriage,
        autoViewingSchedule: cfg.autoViewingSchedule,
        tenantNames: cfg.tenantNames,
        reminderDays1: cfg.reminderDays1,
        reminderDays2: cfg.reminderDays2,
        reminderDays3: cfg.reminderDays3,
        reminderEscalationDays: cfg.reminderEscalationDays,
      }}
      eligibleTenants={eligible}
      authorizedTenantIds={authorized}
      usage={{ limit: usage.limit, used: usage.used, left: usage.left }}
      prunedCount={pruned}
      twilioConfigured={twilioConfigured()}
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
