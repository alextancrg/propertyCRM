import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Persist the client on globalThis in every environment so warm serverless
// invocations (Vercel) reuse the same PrismaClient + connection pool instead of
// re-instantiating (and re-connecting) on every cold-ish request.
globalForPrisma.prisma = prisma;
