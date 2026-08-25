import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getEligibleTenants,
  getAuthorizedTenantIds,
  setAuthorizedTenants,
  getWhatsappUsage,
  pruneExpiredAuthorizedTenants,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// GET — eligible tenants (active leases on the manager's units), the manager's
// currently authorized tenant list, and the monthly WhatsApp usage. Also prunes
// tenants whose leases expired over a week ago (and informs the manager).
export async function GET() {
  const user = await requireUser();
  const pruned = await pruneExpiredAuthorizedTenants(user);
  const [eligible, authorized, usage] = await Promise.all([
    getEligibleTenants(user),
    getAuthorizedTenantIds(user),
    getWhatsappUsage(user),
  ]);
  return NextResponse.json({ eligible, authorized, usage, pruned });
}

// POST — replace the manager's authorized-tenant list.
// Body: { tenantIds: string[] } (only eligible/visible tenants are accepted).
export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { tenantIds?: unknown };
  const raw = Array.isArray(body.tenantIds) ? body.tenantIds : [];
  const tenantIds = raw.filter((x): x is string => typeof x === "string");

  await setAuthorizedTenants(user, tenantIds);

  const [eligible, authorized, usage] = await Promise.all([
    getEligibleTenants(user),
    getAuthorizedTenantIds(user),
    getWhatsappUsage(user),
  ]);
  return NextResponse.json({ ok: true, eligible, authorized, usage });
}
