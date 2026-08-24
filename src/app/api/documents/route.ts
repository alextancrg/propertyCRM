import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const title = form?.get("title")?.toString() ?? "";
  const category = form?.get("category")?.toString() ?? "Other";
  const propertyId = form?.get("propertyId")?.toString() || null;
  const tenantId = form?.get("tenantId")?.toString() || null;
  const isStamped = form?.get("isStamped") === "true";
  // Lease tenure replaces the filing-year field: documents are searched by
  // lease tenure, so we capture the lease start/end dates (end may be open-ended).
  const openEnded = form?.get("openEnded") === "true";
  const leaseFromRaw = form?.get("leaseFrom")?.toString();
  const leaseToRaw = form?.get("leaseTo")?.toString();
  const leaseFrom =
    leaseFromRaw && /^\d{4}-\d{2}-\d{2}/.test(leaseFromRaw) ? new Date(leaseFromRaw) : null;
  const leaseTo =
    openEnded || !leaseToRaw || !/^\d{4}-\d{2}-\d{2}/.test(leaseToRaw) ? null : new Date(leaseToRaw);
  const year = leaseFrom ? leaseFrom.getFullYear() : new Date().getFullYear();
  const file = form?.get("file");

  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  // Property managers may only file documents for properties they can see.
  if (propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });
    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }
    if (me.role !== "Administrator") {
      const visible = await visiblePropertyIds(me);
      if (!visible || !visible.includes(propertyId)) {
        return NextResponse.json(
          { error: "You do not have access to this property." },
          { status: 403 },
        );
      }
    }
  }

  // File bytes are persisted in the DB (base64) so documents download on any
  // host — Vercel's serverless filesystem is ephemeral.
  let fileData: string | null = null;
  let fileMime: string | null = null;
  if (file instanceof File && file.size > 0) {
    fileData = Buffer.from(await file.arrayBuffer()).toString("base64");
    fileMime = file.type || "application/octet-stream";
  }

  const document = await prisma.document.create({
    data: {
      title,
      category,
      propertyId,
      tenantId,
      isStamped,
      year,
      leaseFrom,
      leaseTo,
      fileData,
      fileMime,
    },
  });

  // Serve URL reads the persisted bytes from the DB.
  if (fileData) {
    await prisma.document.update({
      where: { id: document.id },
      data: { fileUrl: `/api/uploads/document/${document.id}` },
    });
  }

  await logAudit("Document", "UPLOADED", `Document filed: ${title} (${category}).`, propertyId ?? undefined, me.id);
  return NextResponse.json({ ok: true, document });
}
