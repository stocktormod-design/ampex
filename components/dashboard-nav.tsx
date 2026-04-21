"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Oversikt", match: (p: string) => p === "/dashboard" },
  {
    href: "/dashboard/settings/users",
    label: "Brukere",
    match: (p: string) => p.startsWith("/dashboard/settings"),
  },
] as const;

export function DashboardNavLinks() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
