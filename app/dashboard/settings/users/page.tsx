import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createUser } from "@/app/dashboard/settings/users/actions";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/roles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams?: { error?: string; success?: string };
};

type CompanyProfile = {
  company_id: string | null;
  role: string;
};

type CompanyUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

function roleClass(role: string) {
  if (role === "owner") return "bg-primary/15 text-primary";
  if (role === "admin") return "bg-secondary text-secondary-foreground";
  if (role === "apprentice") return "border border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
  return "border border-border bg-muted/50 text-muted-foreground";
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role, companies(name)")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as (CompanyProfile & { companies?: { name: string } | null }) | null;

  if (!profile?.company_id) {
    redirect("/onboarding");
  }

  if (!["owner", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const companyName =
    profile.companies && typeof profile.companies === "object" && "name" in profile.companies
      ? (profile.companies as { name: string }).name
      : null;

  const { data: usersData } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });
  const users = (usersData ?? []) as CompanyUser[];

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Brukere</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Owner og admin kan legge til brukere i{" "}
              <span className="font-medium text-foreground">{companyName ?? "firmaet"}</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Ny bruker</CardTitle>
            <CardDescription>E-post og passord som den nye brukeren logger inn med.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createUser} className="space-y-4">
              <div className="space-y-2">
                <NativeLabel htmlFor="full_name">Fullt navn</NativeLabel>
                <NativeInput id="full_name" name="full_name" required autoComplete="name" />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="phone">Telefon</NativeLabel>
                <NativeInput id="phone" name="phone" type="tel" autoComplete="tel" />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="email">E-post</NativeLabel>
                <NativeInput id="email" name="email" type="email" required autoComplete="off" />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="password">Passord</NativeLabel>
                <NativeInput
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="role">Rolle</NativeLabel>
                <select
                  id="role"
                  name="role"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue="montor"
                >
                  <option value="montor">Montør</option>
                  <option value="apprentice">Lærling</option>
                  <option value="admin">Admin</option>
                  {profile.role === "owner" ? <option value="owner">Owner</option> : null}
                </select>
              </div>
              {searchParams?.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{searchParams.error}</AlertDescription>
                </Alert>
              ) : null}
              {searchParams?.success ? (
                <Alert>
                  <AlertDescription>Bruker ble opprettet.</AlertDescription>
                </Alert>
              ) : null}
              <SubmitButton>Opprett bruker</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="border shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Team</CardTitle>
            <CardDescription>
              {users.length} bruker{users.length === 1 ? "" : "e"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y border-t">
              <div className="grid grid-cols-[1fr_auto] gap-2 bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Navn</span>
                <span className="text-right">Rolle</span>
              </div>
              {users.map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.full_name?.trim() || "Uten navn"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.phone?.trim() || "—"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleClass(u.role)}`}
                  >
                    {roleLabel(u.role)}
                  </span>
                </div>
              ))}
            </div>
            {users.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Ingen brukere ennå.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
