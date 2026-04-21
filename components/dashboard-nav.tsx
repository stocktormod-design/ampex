import Link from "next/link";
import { cn } from "@/lib/utils";

type NavProps = {
  canManageUsers: boolean;
};

export function DashboardNavLinks({ canManageUsers }: NavProps) {
  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      <Link
        href="/dashboard"
        className={cn(
          "rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        )}
      >
        Oversikt
      </Link>
      {canManageUsers ? (
        <Link
          href="/dashboard/settings/users"
          className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Brukere
        </Link>
      ) : null}
    </nav>
  );
}
