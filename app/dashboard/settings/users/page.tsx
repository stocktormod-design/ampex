import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createUser } from "@/app/dashboard/settings/users/actions";
import { DeleteUserForm } from "@/app/dashboard/settings/users/delete-user-form";
import { UserEditRow } from "@/app/dashboard/settings/users/user-edit-row";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams?: { new?: string; error?: string; success?: string };
};

type CompanyProfile = {
  company_id: string | null;
  role: string;
  companies?: { name: string } | null;
};

type CompanyUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role, companies(name)")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as CompanyProfile | null;
  if (!profile?.company_id) redirect("/onboarding");
  if (!["owner", "admin"].includes(profile.role)) redirect("/dashboard/projects");

  const companyName =
    profile.companies && "name" in profile.companies
      ? (profile.companies as { name: string }).name
      : null;

  const { data: usersData } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });
  const users = (usersData ?? []) as CompanyUser[];

  function mayDelete(target: CompanyUser): boolean {
    if (target.id === user!.id) return false;
    if (target.role === "owner") return false;
    if (profile!.role === "owner") return true;
    if (profile!.role === "admin") return target.role === "montor" || target.role === "apprentice";
    return false;
  }

  const showForm = searchParams?.new === "1";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Team</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {companyName ?? "Firma"} · {users.length} bruker{users.length === 1 ? "" : "e"}
          </p>
        </div>
        <Link
          href={showForm ? "/dashboard/settings/users" : "/dashboard/settings/users?new=1"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
        >
          <Plus className="size-4" aria-hidden />
          Ny bruker
        </Link>
      </div>

      {/* ── Create form (collapsible) ── */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Ny bruker</h2>
          <form action={createUser} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <NativeLabel htmlFor="full_name">Fullt navn *</NativeLabel>
                <NativeInput id="full_name" name="full_name" required autoComplete="name" autoFocus />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="phone">Telefon</NativeLabel>
                <NativeInput id="phone" name="phone" type="tel" autoComplete="tel" />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="email">E-post *</NativeLabel>
                <NativeInput id="email" name="email" type="email" required autoComplete="off" />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="password">Passord *</NativeLabel>
                <NativeInput
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
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
                <option value="installator">Installatør</option>
                <option value="admin">Admin</option>
                {profile.role === "owner" && <option value="owner">Owner</option>}
              </select>
            </div>

            {searchParams?.error && (
              <Alert variant="destructive">
                <AlertDescription>{searchParams.error}</AlertDescription>
              </Alert>
            )}
            {searchParams?.success === "1" && (
              <Alert>
                <AlertDescription>Bruker ble opprettet.</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-3">
              <SubmitButton>Opprett bruker</SubmitButton>
              <Link
                href="/dashboard/settings/users"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Avbryt
              </Link>
            </div>
          </form>
        </div>
      )}

      {/* ── Feedback (outside form) ── */}
      {searchParams?.success === "deleted" && !showForm && (
        <Alert>
          <AlertDescription>Brukeren ble slettet.</AlertDescription>
        </Alert>
      )}
      {searchParams?.success === "updated" && !showForm && (
        <Alert>
          <AlertDescription>Bruker oppdatert.</AlertDescription>
        </Alert>
      )}

      {/* ── Users list ── */}
      {users.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Ingen brukere ennå.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {users.map((u) => (
            <UserEditRow
              key={u.id}
              user={u}
              currentUserId={user.id}
              currentUserRole={profile.role}
              deleteSlot={
                <DeleteUserForm
                  userId={u.id}
                  displayName={u.full_name?.trim() || "Uten navn"}
                  disabled={!mayDelete(u)}
                />
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
