import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ampex",
  description: "Prosjektstyring for norske elektroentreprenorer",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="no">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
