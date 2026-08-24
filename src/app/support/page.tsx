import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SupportClient } from "@/components/support/SupportClient";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const me = await requireUser();

  // Users see their own submissions; administrators see everything (triage).
  const where = me.role === "Administrator" ? {} : { userId: me.id };
  const feedback = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <SupportClient
      me={me}
      initial={feedback.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
    />
  );
}
