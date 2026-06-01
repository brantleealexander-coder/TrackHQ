import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getTenantConfig, brandColorToRgbTriple } from "@/lib/tenant-config";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html
      lang="en"
      style={{ ["--brand-rgb" as string]: brandRgb }}
      className={inter.variable}
    >
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
