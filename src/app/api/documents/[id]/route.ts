import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";
import { DOC_MAX_BYTES, DOC_MAX_BYTES_LABEL, formatBytes } from "@/lib/documents";

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
  // Only change the property/tenant links when the form actually sends them —
  // so a partial update (e.g. adding the 2nd attachment only) never unlinks a
  // document from its property/tenant.
  const propertyId = form?.has("propertyId")
    ? form.get("propertyId")?.toString() || null
    : existing.propertyId;
  const tenantId = form?.has("tenantId")
    ? form.get("tenantId")?.toString() || null
    : existing.tenantId;
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
  // works on any host. Same 4.5 MB platform body cap applies, so reject
  // oversized replacement files up front with a clear reason.
  let fileData = existing.fileData;
  let fileMime = existing.fileMime;
  const file = form?.get("file");
  if (file instanceof File && file.size > DOC_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File is ${formatBytes(file.size)} — the maximum upload size is ${DOC_MAX_BYTES_LABEL}. Please compress the PDF (e.g. re-export or re-scan at a lower resolution) and try again.`,
      },
      { status: 400 },
    );
  }
  if (file instanceof File && file.size > 0) {
    fileData = Buffer.from(await file.arrayBuffer()).toString("base64");
    fileMime = file.type || "application/octet-stream";
  }

  // Optional 2nd attachment (a document holds up to 2 files). Send `file2` to
  // add/replace it, or `clearFile2=true` to remove it.
  let fileData2 = existing.fileData2;
  let fileMime2 = existing.fileMime2;
  const file2 = form?.get("file2");
  const clearFile2 = form?.get("clearFile2") === "true";
  if (file2 instanceof File && file2.size > DOC_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File is ${formatBytes(file2.size)} — the maximum upload size is ${DOC_MAX_BYTES_LABEL}. Please compress the PDF (e.g. re-export or re-scan at a lower resolution) and try again.`,
      },
      { status: 400 },
    );
  }
  if (file2 instanceof File && file2.size > 0) {
    fileData2 = Buffer.from(await file2.arrayBuffer()).toString("base64");
    fileMime2 = file2.type || "application/octet-stream";
  } else if (clearFile2) {
    fileData2 = null;
    fileMime2 = null;
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
      fileData2,
      fileMime2,
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
