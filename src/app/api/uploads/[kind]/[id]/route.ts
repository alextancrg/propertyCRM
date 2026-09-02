import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * Serves uploaded files that are persisted as base64 bytes in the database
 * (bill receipts, rent payment slips, and vault documents). Vercel's serverless
 * filesystem is ephemeral, so storing the bytes in the DB is what makes the
 * Download links work reliably in production.
 *
 * Route: /api/uploads/[kind]/[id]  where kind = bill-receipt | rent-slip | document
 */

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
};

function mimeExt(mime: string): string {
  return EXT_BY_MIME[mime.split(";")[0].trim()] ?? "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { kind, id } = await params;

  let data: string | null = null;
  let mime = "application/octet-stream";
  let fileName = "download";

  if (kind === "bill-receipt") {
    const receipt = await prisma.billReceipt.findUnique({
      where: { id },
      include: { payment: { include: { bill: { include: { property: true } } } } },
    });
    if (!receipt) return NextResponse.json({ error: "Not found." }, { status: 404 });
    // PMs may only download receipts for properties they can see.
    if (me.role !== "Administrator") {
      const visible = await visiblePropertyIds(me);
      if (!visible || !visible.includes(receipt.payment.bill.propertyId)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
    }
    data = receipt.data;
    mime = receipt.mimeType;
    fileName = receipt.fileName;
  } else if (kind === "rent-slip") {
    const payment = await prisma.rentPayment.findUnique({
      where: { id },
      include: { lease: { include: { property: true } } },
    });
    if (!payment || !payment.receiptData) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (me.role !== "Administrator") {
      const visible = await visiblePropertyIds(me);
      if (!visible || !visible.includes(payment.lease.propertyId)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
    }
    data = payment.receiptData;
    mime = payment.receiptMime ?? "application/octet-stream";
    fileName = `rent-slip-${payment.month}.${mimeExt(mime) || "pdf"}`;
  } else if (kind === "document") {
    const doc = await prisma.document.findUnique({ where: { id }, include: { property: true } });
    if (!doc || (!doc.fileData && !doc.fileData2)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (me.role !== "Administrator" && doc.propertyId) {
      const visible = await visiblePropertyIds(me);
      if (!visible || !visible.includes(doc.propertyId)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
    }
    // ?slot=2 serves the optional 2nd attachment (a document holds up to 2 files).
    const slot = req.nextUrl.searchParams.get("slot");
    if (slot === "2") {
      if (!doc.fileData2) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      data = doc.fileData2;
      mime = doc.fileMime2 ?? "application/octet-stream";
      fileName = `${doc.title} (2)`;
    } else {
      if (!doc.fileData) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      data = doc.fileData;
      mime = doc.fileMime ?? "application/octet-stream";
      fileName = doc.title;
    }
    fileName = fileName.includes(".") ? fileName : `${fileName}${mimeExt(mime)}`;
  } else {
    return NextResponse.json({ error: "Unknown file kind." }, { status: 404 });
  }

  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const buffer = Buffer.from(data, "base64");
  const safeName = fileName.replace(/[^\w.\- ]/g, "_").replace(/\s+/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
