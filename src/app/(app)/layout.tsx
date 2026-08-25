import { AppShell } from "@/components/AppShell";

// Route group layout for the authenticated application. Route-group names do
// not appear in URLs, so every page under (app) keeps its current path while
// being wrapped in the sidebar/header chrome.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
