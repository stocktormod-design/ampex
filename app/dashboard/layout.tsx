import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardNavLinks, MobileBottomNav } from "@/components/dashboard-nav";
import { createClient } from "@/lib/supabase/server";
import { canViewInstallerInbox as roleCanViewInstallerInbox } from "@/lib/roles";

type ProfileRow = {
  company_id: string | null;
  role: string;
  full_name: string | null;
  companies: { name: string } | null;
} | null;

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role, full_name, companies(name)")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as ProfileRow;

  const companyName =
    profile?.companies && "name" in profile.companies
      ? (profile.companies as { name: string }).name
      : null;

  const canViewProjects = Boolean(profile?.company_id);
  const canManageUsers  = profile?.role === "owner" || profile?.role === "admin";
  const canManageLager  = profile?.role === "owner" || profile?.role === "admin";
  const canViewInstallerInbox = profile?.role ? roleCanViewInstallerInbox(profile.role) : false;

  async function signOut() {
    "use server";
    const client = await createClient();
    await client.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border/60 bg-background/95 px-4 backdrop-blur-md sm:px-6">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-foreground"
        >
          Ampex
          {companyName && (
            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
              · {companyName}
            </span>
          )}
        </Link>

        {/* Desktop nav – center */}
        <div className="hidden flex-1 sm:flex">
          <DashboardNavLinks
            canViewProjects={canViewProjects}
            canManageUsers={canManageUsers}
            canManageLager={canManageLager}
            canViewInstallerInbox={canViewInstallerInbox}
          />
        </div>

        {/* Right: name/email + sign-out */}
        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/dashboard/settings/profile"
            className="hidden max-w-[180px] truncate text-xs text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            {profile?.full_name?.trim() ?? user.email}
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Logg ut
            </button>
          </form>
        </div>
      </header>

      {/* ── Page content ── */}
      <main
        className="flex-1 overflow-y-auto"
        /* leave room for mobile bottom nav */
        style={{ paddingBottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 sm:[padding-bottom:2rem]">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <MobileBottomNav
        canViewProjects={canViewProjects}
        canManageLager={canManageLager}
        canManageUsers={canManageUsers}
        canViewInstallerInbox={canViewInstallerInbox}
        signOut={signOut}
      />
    </div>
  );
}
