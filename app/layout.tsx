import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/app/components/pwa-register";

export const metadata: Metadata = {
  title: "Ampex — prosjektstyring for elektro",
  description:
    "Samlet oversikt over prosjekter, tegninger og team for norske elektroentreprenorer.",
  manifest: "/manifest.webmanifest",
  applicationName: "Ampex",
  appleWebApp: {
    capable: true,
    title: "Ampex",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="no">
      <body className="min-h-screen touch-manipulation bg-background font-sans text-foreground antialiased [-webkit-tap-highlight-color:transparent]">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
