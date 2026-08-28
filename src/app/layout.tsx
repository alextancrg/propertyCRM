import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n";
import { getLocaleFromCookies } from "@/lib/i18n-server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GoAssetHub — Property Management",
  description:
    "AI-powered property management CRM: leases, bills, tax audit readiness, documents, and a configurable WhatsApp AI agent.",
};

// The root layout only owns the document shell. The authenticated application
// chrome (<AppShell/>) lives in src/app/(app)/layout.tsx so that public pages
// (e.g. /privacy-policy) render standalone without the sidebar.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocaleFromCookies();
  return (
    <html lang={locale} className={inter.variable}>
      <head>
        <meta name="facebook-domain-verification" content="xjrguvh9kocm9v7i53n38dohki8rk7" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
