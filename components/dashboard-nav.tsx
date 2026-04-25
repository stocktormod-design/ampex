"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FolderKanban,
  Package,
  BookOpen,
  LayoutGrid,
  House,
  Users,
  ChevronRight,
  X,
  User,
  LogOut,
} from "lucide-react";

type BaseNavProps = {
  canViewProjects: boolean;
  canManageUsers: boolean;
  canManageLager: boolean;
};

type MobileNavProps = BaseNavProps & {
  signOut: () => Promise<void>;
};

type NavItem = { href: string; label: string; exact?: boolean };

function buildDesktopLinks(props: BaseNavProps): NavItem[] {
  const links: NavItem[] = [{ href: "/dashboard", label: "Hjem", exact: true }];
  if (props.canViewProjects) links.push({ href: "/dashboard/projects", label: "Prosjekter" });
  links.push({ href: "/dashboard/protokoller", label: "Protokoller" });
  if (props.canManageLager) links.push({ href: "/dashboard/lager", label: "Lager" });
  if (props.canManageUsers) links.push({ href: "/dashboard/settings/users", label: "Brukere" });
  return links;
}

/* ── Desktop top nav ── */
export function DashboardNavLinks(props: BaseNavProps) {
  const pathname = usePathname();
  const links = buildDesktopLinks(props);

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
const PRIMARY_TABS = [
  { href: "/dashboard/projects",    label: "Prosjekter",  Icon: FolderKanban },
  { href: "/dashboard/lager",       label: "Lager",       Icon: Package      },
  { href: "/dashboard/protokoller", label: "Protokoller", Icon: BookOpen     },
];

export function MobileBottomNav(props: MobileNavProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const onPrimaryTab = PRIMARY_TABS.some((t) => pathname.startsWith(t.href));
  const isMoreActive = !onPrimaryTab;

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* Slide-up drawer */}
      <div
        className={`fixed inset-x-0 z-50 sm:hidden transition-all duration-300 ease-out ${
          drawerOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))" }}
        aria-hidden={!drawerOpen}
      >
        <div className="mx-3 mb-2 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Meny</span>
            <button
              onClick={() => setDrawerOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Lukk meny"
            >
              <X className="size-4" />
            </button>
          </div>

          <ul className="py-1">
            <li>
              <Link
                href="/dashboard"
                className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/60 ${
                  pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <House className="size-5 shrink-0" />
                <span className="flex-1">Hjem</span>
                <ChevronRight className="size-4 text-muted-foreground/40" />
              </Link>
            </li>

            <li className="border-t border-border/60">
              <Link
                href="/dashboard/settings/profile"
                className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/60 ${
                  pathname.startsWith("/dashboard/settings/profile") ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <User className="size-5 shrink-0" />
                <span className="flex-1">Min profil</span>
                <ChevronRight className="size-4 text-muted-foreground/40" />
              </Link>
            </li>

            {props.canManageUsers && (
              <li className="border-t border-border/60">
                <Link
                  href="/dashboard/settings/users"
                  className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/60 ${
                    pathname.startsWith("/dashboard/settings/users") ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Users className="size-5 shrink-0" />
                  <span className="flex-1">Brukere</span>
                  <ChevronRight className="size-4 text-muted-foreground/40" />
                </Link>
              </li>
            )}

            <li className="border-t border-border/60">
              <form action={props.signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
                >
                  <LogOut className="size-5 shrink-0" />
                  <span className="flex-1 text-left">Logg ut</span>
                </button>
              </form>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Navigasjon"
      >
        <div className="flex h-[3.75rem] items-stretch">
          {PRIMARY_TABS.map(({ href, label, Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`size-5 transition-transform ${isActive ? "scale-105" : ""}`}
                  aria-hidden
                />
                {label}
                {isActive && (
                  <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-foreground" />
                )}
              </Link>
            );
          })}

          {/* Mer */}
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              isMoreActive || drawerOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-expanded={drawerOpen}
            aria-label="Mer"
          >
            <LayoutGrid
              className={`size-5 transition-transform ${drawerOpen ? "scale-105" : ""}`}
              aria-hidden
            />
            Mer
            {isMoreActive && !drawerOpen && (
              <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-foreground" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
