import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNavLinks } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";

type ProfileWithCompany = {
  company_id: string | null;
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
    .select("company_id, companies(name)")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as ProfileWithCompany;
  const companyName =
    profile?.companies && typeof profile.companies === "object" && "name" in profile.companies
      ? (profile.companies as { name: string }).name
      : null;

  async function signOut() {
    "use server";
    const actionClient = await createClient();
    await actionClient.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 to-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <Link href="/dashboard" className="flex flex-col">
              <span className="text-base font-semibold tracking-tight">AMPEX</span>
              {companyName ? (
                <span className="text-xs text-muted-foreground">{companyName}</span>
              ) : (
                <span className="text-xs text-muted-foreground">Dashbord</span>
              )}
            </Link>
            <DashboardNavLinks />
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="hidden max-w-[200px] truncate text-xs text-muted-foreground sm:inline">
              {user.email}
            </span>
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit">
                Logg ut
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-8">{children}</div>
    </div>
  );
}
