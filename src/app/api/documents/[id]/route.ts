import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";

export const dynamic = "force-dynamic";

// Update an existing document — used to update the lease end date later once
// it is determined (open-ended leases can be closed out), plus details/file.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const title = form?.get("title")?.toString();
  const category = form?.get("category")?.toString();
  const propertyId = form?.get("propertyId")?.toString() || null;
  const tenantId = form?.get("tenantId")?.toString() || null;
  const isStampedRaw = form?.get("isStamped")?.toString();

  // Lease tenure (drives the year search). Open-ended = null end date.
  const openEnded = form?.get("openEnded") === "true";
  const leaseFromRaw = form?.get("leaseFrom")?.toString();
  const leaseToRaw = form?.get("leaseTo")?.toString();
  const leaseFrom =
    leaseFromRaw && /^\d{4}-\d{2}-\d{2}/.test(leaseFromRaw) ? new Date(leaseFromRaw) : existing.leaseFrom;
  const leaseTo =
    openEnded
      ? null
      : leaseToRaw && /^\d{4}-\d{2}-\d{2}/.test(leaseToRaw)
        ? new Date(leaseToRaw)
        : existing.leaseTo;
  const year = leaseFrom ? leaseFrom.getFullYear() : existing.year ?? new Date().getFullYear();

  // Property managers may only edit documents for properties they can see.
  if (propertyId && propertyId !== existing.propertyId) {
    const property = await prisma.property.findFirst({ where: { id: propertyId, deletedAt: null } });
    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }
    if (me.role !== "Administrator") {
      const visible = await visiblePropertyIds(me);
      if (!visible || !visible.includes(propertyId)) {
        return NextResponse.json({ error: "You do not have access to this property." }, { status: 403 });
      }
    }
  }

  // Optional file replacement — bytes persisted in the DB so the download
  // works on any host.
  let fileData = existing.fileData;
  let fileMime = existing.fileMime;
  const file = form?.get("file");
  if (file instanceof File && file.size > 0) {
    fileData = Buffer.from(await file.arrayBuffer()).toString("base64");
    fileMime = file.type || "application/octet-stream";
  }

  const document = await prisma.document.update({
    where: { id },
    data: {
      title: title && title.trim() ? title.trim() : existing.title,
      category: category && category.trim() ? category.trim() : existing.category,
      propertyId,
      tenantId,
      isStamped: isStampedRaw !== undefined ? isStampedRaw === "true" : existing.isStamped,
      year,
      leaseFrom,
      leaseTo,
      fileUrl: fileData ? `/api/uploads/document/${id}` : existing.fileUrl,
      fileData,
      fileMime,
    },
  });

  await logAudit(
    "Document",
    "UPDATED",
    `Document updated: ${document.title} (${document.category}).`,
    document.propertyId ?? undefined,
    me.id,
  );
  return NextResponse.json({ ok: true, document });
}
