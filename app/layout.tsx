import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ampex — prosjektstyring for elektro",
  description:
    "Samlet oversikt over prosjekter, tegninger og team for norske elektroentreprenorer.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="no">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
