import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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

  async function signOut() {
    "use server";
    const actionClient = await createClient();
    await actionClient.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link className="font-semibold" href="/dashboard">
              Ampex
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link className="rounded-md px-2 py-1 hover:bg-muted" href="/dashboard">
                Oversikt
              </Link>
              <Link
                className="rounded-md px-2 py-1 hover:bg-muted"
                href="/dashboard/settings/users"
              >
                Brukere
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Logg ut
            </Button>
          </form>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">{children}</div>
    </div>
  );
}
