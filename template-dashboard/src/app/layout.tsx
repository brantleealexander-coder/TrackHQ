import type { Metadata } from "next";
import { getTenantConfig, brandColorToRgbTriple } from "@/lib/tenant-config";
import "./globals.css";

const config = getTenantConfig();

export const metadata: Metadata = {
  title: config.business.site_title,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brandRgb = brandColorToRgbTriple(config.business.brand_color);
  return (
    <html lang="en" style={{ ["--brand-rgb" as string]: brandRgb }}>
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
