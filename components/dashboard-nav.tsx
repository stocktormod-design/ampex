"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Package, Users, LayoutGrid, House, BookOpen } from "lucide-react";

type NavProps = {
  canViewProjects: boolean;
  canManageUsers: boolean;
  canManageLager: boolean;
};

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

function buildLinks(props: NavProps): NavItem[] {
  const links: NavItem[] = [
    { href: "/dashboard", label: "Hjem", exact: true },
  ];
  if (props.canViewProjects) links.push({ href: "/dashboard/projects", label: "Prosjekter" });
  links.push({ href: "/dashboard/protokoller", label: "Protokoller" });
  if (props.canManageLager)  links.push({ href: "/dashboard/lager",    label: "Lager" });
  if (props.canManageUsers)  links.push({ href: "/dashboard/settings/users", label: "Brukere" });
  return links;
}

/* ── Desktop top nav ── */
export function DashboardNavLinks(props: NavProps) {
  const pathname = usePathname();
  const links = buildLinks(props);

  return (
    <nav className="flex items-center gap-0.5 text-sm">
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Mobile bottom tab bar ── */
const ICONS: Record<string, typeof FolderKanban> = {
  "/dashboard":                 House,
  "/dashboard/projects":        FolderKanban,
  "/dashboard/protokoller":     BookOpen,
  "/dashboard/lager":           Package,
  "/dashboard/settings/users":  Users,
};

export function MobileBottomNav(props: NavProps) {
  const pathname = usePathname();
  const links = buildLinks(props);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Navigasjon"
    >
      <div className="flex h-[3.75rem] items-stretch">
        {links.map((link) => {
          const isActive = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          const Icon = ICONS[link.href] ?? LayoutGrid;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                className={`size-5 transition-transform ${isActive ? "scale-105" : ""}`}
                aria-hidden
              />
              {link.label}
              {isActive && (
                <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-foreground" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
