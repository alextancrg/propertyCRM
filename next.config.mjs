/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  // Keep pdfkit unbundled so its internal __dirname still points at the real
  // package directory (where its AFM font data lives). Bundling it breaks
  // loading of the built-in Helvetica/Times/Courier standard fonts.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
