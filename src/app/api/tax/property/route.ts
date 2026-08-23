import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/ai";
import { getSessionUser } from "@/lib/auth";
import { visiblePropertyIds } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * Correct a property's tax figures for a given year:
 *  - grossAmount      : set/adjust the annual gross rental collection (upsert)
 *  - expense          : add an expense { category, description, amount, incurredAt? }
 *  - deleteExpenseId  : remove an expense
 */
export async function PATCH(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { propertyId, year } = body;

  if (!propertyId || !year) {
    return NextResponse.json({ error: "propertyId and year are required." }, { status: 400 });
  }

  // Property managers may only correct tax data for properties they can see.
  if (me.role !== "Administrator") {
    const visible = await visiblePropertyIds(me);
    if (!visible || !visible.includes(propertyId)) {
      return NextResponse.json({ error: "You do not have access to this property." }, { status: 403 });
    }
  }

  const y = Number(year);
  const actions: string[] = [];

  // 1) Set / adjust annual gross rental collection.
  if (body.grossAmount !== undefined) {
    const gross = Number(body.grossAmount);
    if (Number.isNaN(gross) || gross < 0) {
      return NextResponse.json({ error: "grossAmount must be a valid non-negative number." }, { status: 400 });
    }
    await prisma.annualIncome.upsert({
      where: { propertyId_year: { propertyId, year: y } },
      create: { propertyId, year: y, grossAmount: gross },
      update: { grossAmount: gross },
    });
    actions.push(`set gross rental collection to ${gross}`);
  }

  // 2) Add an expense.
  if (body.expense) {
    const { category, description, amount, incurredAt } = body.expense;
    if (!category || amount === undefined || Number.isNaN(Number(amount))) {
      return NextResponse.json({ error: "expense requires a category and a valid amount." }, { status: 400 });
    }
    await prisma.expense.create({
      data: {
        propertyId,
        category,
        description: description ?? "",
        amount: Number(amount),
        incurredAt: incurredAt ? new Date(incurredAt) : new Date(y, 0, 1),
      },
    });
    actions.push(`added expense ${category}`);
  }

  // 3) Remove an expense.
  if (body.deleteExpenseId) {
    await prisma.expense.deleteMany({ where: { id: body.deleteExpenseId, propertyId } });
    actions.push("removed an expense");
  }

  await logAudit(
    "Tax",
    "UPDATED",
    `Tax correction for ${propertyId} (${y}): ${actions.join(", ") || "no change"}.`,
    propertyId,
    me.id,
  );

  return NextResponse.json({ ok: true, actions });
}
