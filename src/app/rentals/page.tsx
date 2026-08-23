import { requireUser } from "@/lib/auth";
import { RentalsClient } from "@/components/rentals/RentalsClient";
import { buildRentalCollection } from "@/lib/rentals";

export const dynamic = "force-dynamic";

export default async function RentalsPage() {
  const me = await requireUser();
  const rentals = await buildRentalCollection(me);
  return <RentalsClient rentals={rentals} />;
}
