// Public, standalone pages (e.g. /privacy-policy). No application shell —
// these render as independent branded documents so they can be linked from
// external systems (app stores, payment gateways, etc.).
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
