// Resolve the public origin of the app for links inside emails.
// NEXT_PUBLIC_APP_URL takes precedence (set on Vercel); otherwise fall back to
// the request's forwarded host, then localhost.
export function appOrigin(req: { headers: { get(name: string): string | null }; nextUrl?: { origin: string } }): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (req.nextUrl) return req.nextUrl.origin;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
