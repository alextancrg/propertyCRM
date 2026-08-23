import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildRentalCollection } from "@/lib/rentals";

export const dynamic = "force-dynamic";

// List the rental collection for the logged-in user (scoped to their
// visible properties). Also ensures monthly rental records exist per lease.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const rentals = await buildRentalCollection(me);
  return NextResponse.json({ rentals });
}
