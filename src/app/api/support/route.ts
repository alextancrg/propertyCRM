import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendMail, SUPPORT_TO_EMAIL } from "@/lib/mail";
import { logAudit } from "@/lib/ai";

export const dynamic = "force-dynamic";

const FEEDBACK_CATEGORIES = ["Feature Request", "Bug Report", "Question", "Other"];

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 4000;

// Past submissions — the user sees their own; administrators see everything.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const where = me.role === "Administrator" ? {} : { userId: me.id };
  const feedback = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    feedback: feedback.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
  });
}

// Submit support feedback: store it and email the support inbox. Replies to the
// email are addressed to the logged-in user's email address.
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const category = typeof body.category === "string" ? body.category : "Other";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!FEEDBACK_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ error: "A subject is required." }, { status: 400 });
  }
  if (subject.length > SUBJECT_MAX) {
    return NextResponse.json(
      { error: `Subject must be ${SUBJECT_MAX} characters or fewer.` },
      { status: 400 },
    );
  }
  if (message.length < 10) {
    return NextResponse.json(
      { error: "Please describe your feedback (at least 10 characters)." },
      { status: 400 },
    );
  }
  if (message.length > MESSAGE_MAX) {
    return NextResponse.json(
      { error: `Message must be ${MESSAGE_MAX} characters or fewer.` },
      { status: 400 },
    );
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: me.id,
      name: me.name,
      email: me.email,
      category,
      subject,
      message,
      status: "new",
    },
  });

  const emailSent = await sendMail({
    to: SUPPORT_TO_EMAIL,
    replyTo: me.email,
    subject: `[AssetHub Support] ${category}: ${subject}`,
    text: [
      `New support message from ${me.name} <${me.email}>`,
      "",
      `Category: ${category}`,
      `Subject: ${subject}`,
      "",
      message,
      "",
      `— Reply to this email to respond to ${me.name}. Replies are sent to ${me.email}.`,
    ].join("\n"),
  });

  await logAudit(
    "Support",
    "CREATED",
    `Support message submitted: ${subject}.`,
    feedback.id,
    me.id,
  );

  return NextResponse.json({
    ok: true,
    feedback: { ...feedback, createdAt: feedback.createdAt.toISOString() },
    emailSent: emailSent.sent,
  });
}
