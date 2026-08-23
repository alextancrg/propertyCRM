import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

  let fileUrl: string | null = null;

  // Local file storage (dev only). On Vercel use Vercel Blob / S3.
  if (file instanceof File && file.size > 0 && !process.env.VERCEL) {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadsDir, safeName), bytes);
    fileUrl = `/uploads/${safeName}`;
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
      fileUrl,
    },
  });

  await logAudit("Document", "UPLOADED", `Document filed: ${title} (${category}).`, propertyId ?? undefined, me.id);
  return NextResponse.json({ ok: true, document });
}
