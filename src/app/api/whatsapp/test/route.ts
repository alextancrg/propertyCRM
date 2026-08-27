import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { dispatchWhatsAppMessage, getAuthorizedTenantIds } from "@/lib/whatsapp";
import { formatMYR } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Temporary testing endpoint: send a reminder-style WhatsApp message to an
 * authorized tenant right now, bypassing the alert-day schedule. Goes through
 * the normal quota check + logging so it appears in the Dashboard feed.
 * Use it to verify Twilio outbound delivery while testing.
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : null;
  if (!tenantId) return NextResponse.json({ error: "tenantId is required." }, { status: 400 });

  const authorized = await getAuthorizedTenantIds(me);
  if (!authorized.includes(tenantId)) {
    return NextResponse.json({ error: "Tenant is not on your authorized list." }, { status: 403 });
  }

  const lease = await prisma.lease.findFirst({
    where: { tenantId, status: "ACTIVE" },
    include: { tenant: true, property: true },
  });
  if (!lease) return NextResponse.json({ error: "No active lease for this tenant." }, { status: 404 });

  const message = `🧪 TEST from AssetHub — This is a test WhatsApp reminder for ${lease.tenant.name} (${lease.property.name}). Your rent of ${formatMYR(lease.monthlyRent)} is due — please ignore if received in error.`;

  // Current month's rent due date (same derivation as the reminder engine).
  const now = new Date();
  const dueDay = lease.property.rentStartDate?.getDate() ?? lease.startDate.getDate() ?? 1;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dueDate = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, lastDay));

  const result = await dispatchWhatsAppMessage({
    user: me,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    tenantName: lease.tenant.name,
    propertyName: lease.property.name,
    action: "RENT_REMINDER",
    phone: lease.tenant.phone,
    body: message,
    language: lease.tenant.language, // tenant's template language
    // Approved-template variables (used when TWILIO_WHATSAPP_CONTENT_SID is set):
    // 1 = name, 2 = amount, 3 = unit, 4 = due date.
    contentVariables: {
      "1": lease.tenant.name,
      "2": formatMYR(lease.monthlyRent),
      "3": lease.property.name,
      "4": dueDate.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" }),
    },
  });

  return NextResponse.json({
    ok: true,
    status: result.status,
    reason: result.reason,
    tenantName: lease.tenant.name,
  });
}
