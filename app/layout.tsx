import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { withMetadataBase } from "@/lib/metadata-base";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = withMetadataBase({
  title: "Ampex — prosjektstyring for elektro",
  description:
    "Samlet oversikt over prosjekter, tegninger og team for norske elektroentreprenorer.",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="no" className={inter.variable}>
      <body className={`${inter.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
