const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const p = new PrismaClient();
(async () => {
  const email = "canceltest@assethub.my";
  let user = await p.user.findUnique({ where: { email } });
  if (!user) {
    user = await p.user.create({
      data: { name: "Cancel Test", email, role: "Property Manager", passwordHash: await bcrypt.hash("Cancelpass@123", 10) },
    });
    console.log("created user", user.id);
  }
  await p.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan: "growth",
      status: "active",
      propertyLimit: 10,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      currentPeriodEnd: new Date("2027-08-24T00:00:00Z"),
      cancelAtPeriodEnd: true,
    },
    update: {
      plan: "growth",
      status: "active",
      propertyLimit: 10,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      currentPeriodEnd: new Date("2027-08-24T00:00:00Z"),
      cancelAtPeriodEnd: true,
    },
  });
  console.log("subscription set (cancelAtPeriodEnd=true, period end 2027-08-24)");
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
