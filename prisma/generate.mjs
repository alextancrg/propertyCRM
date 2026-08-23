// Chooses the correct Prisma schema + generates the client.
// - Local development (no Postgres URL): SQLite schema.
// - Vercel / production (DATABASE_URL starts with postgresql://): Postgres schema.
import { execSync } from "child_process";

const url = process.env.DATABASE_URL || "";
const isPostgres = url.startsWith("postgresql://") || url.startsWith("postgres://");
const schema = isPostgres
  ? "prisma/schema.postgresql.prisma"
  : "prisma/schema.prisma";

console.log(`[prisma] Generating client from ${schema} (${isPostgres ? "postgresql" : "sqlite"})`);
execSync(`prisma generate --schema ${schema}`, { stdio: "inherit", shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh" });
