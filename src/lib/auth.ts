import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE = "assethub_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_TTL_S = 7 * 24 * 60 * 60;

function sessionSecret(): string {
  // In production set AUTH_SECRET to a long random value. The fallback keeps
  // local/dev workflows working out of the box.
  return process.env.AUTH_SECRET || "dev-only-assethub-secret-change-me";
}

function sign(data: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Build an HMAC-signed session token for a user. */
export function buildSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Verify a session token; returns the userId or null. */
export function verifySessionToken(token: string): string | null {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.userId || typeof data.userId !== "string") return null;
    if (Date.now() > data.exp) return null;
    return data.userId;
  } catch {
    return null;
  }
}

/** Set the session cookie on the outgoing response. */
export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, buildSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Resolve the currently logged-in user (null when anonymous / invalid). */
export async function getSessionUser(): Promise<
  { id: string; name: string; email: string; role: string; language: string } | null
> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, language: true },
  });
  return user;
}

/** Server-component guard: redirect to /login when not authenticated. */
export async function requireUser(): Promise<NonNullable<Awaited<ReturnType<typeof getSessionUser>>>> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
