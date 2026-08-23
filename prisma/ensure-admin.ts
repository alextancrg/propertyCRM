import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Ensures a property manager can log in. Uses admin@assethub.my; if that user
// does not exist it reuses the first existing user (preserving audit links),
// otherwise it creates one. Safe to run repeatedly.
const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@assethub.my";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Assethub@2026";

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  let admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    const first = await prisma.user.findFirst();
    if (first) {
      admin = await prisma.user.update({
        where: { id: first.id },
        data: { email: ADMIN_EMAIL, passwordHash, role: "Administrator" },
      });
    } else {
      admin = await prisma.user.create({
        data: { name: "John Doe", email: ADMIN_EMAIL, role: "Administrator", passwordHash },
      });
    }
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash, role: "Administrator" },
    });
  }

  console.log(`Admin ready: ${admin.email} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
