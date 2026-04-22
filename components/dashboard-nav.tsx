import Link from "next/link";
import { cn } from "@/lib/utils";

type NavProps = {
  canViewProjects: boolean;
  canManageUsers: boolean;
  canManageLager: boolean;
};

const linkClass =
  "rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function DashboardNavLinks({ canViewProjects, canManageUsers, canManageLager }: NavProps) {
  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      <Link href="/dashboard" className={cn(linkClass)}>
        Oversikt
      </Link>
      {canViewProjects ? (
        <Link href="/dashboard/projects" className={cn(linkClass)}>
          Prosjekter
        </Link>
      ) : null}
      {canManageLager ? (
        <Link href="/dashboard/lager" className={cn(linkClass)}>
          Lager
        </Link>
      ) : null}
      {canManageUsers ? (
        <Link href="/dashboard/settings/users" className={cn(linkClass)}>
          Brukere
        </Link>
      ) : null}
    </nav>
  );
}
