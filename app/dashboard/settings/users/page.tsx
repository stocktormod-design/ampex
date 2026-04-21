import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

type UsersPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

type CompanyProfile = {
  company_id: string | null;
  role: "owner" | "admin" | "worker";
};

type CompanyUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "owner" | "admin" | "worker";
  created_at: string;
};

function roleBadgeVariant(role: string) {
  if (role === "owner") return "default" as const;
  if (role === "admin") return "secondary" as const;
  return "outline" as const;
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

  async function createUser(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("full_name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const requestedRole = String(formData.get("role") ?? "worker") as
      | "owner"
      | "admin"
      | "worker";

    const actionClient = await createClient();
    const {
      data: { user: currentUser },
    } = await actionClient.auth.getUser();

    if (!currentUser) {
      redirect("/auth/login");
    }

    const { data: currentProfileData } = await actionClient
      .from("profiles")
      .select("company_id, role")
      .eq("id", currentUser.id)
      .maybeSingle();
    const currentProfile = currentProfileData as CompanyProfile | null;

    if (!currentProfile?.company_id || !["owner", "admin"].includes(currentProfile.role)) {
      redirect("/dashboard/settings/users?error=Du+har+ikke+tilgang+til+denne+handlingen");
    }

    if (requestedRole === "owner" && currentProfile.role !== "owner") {
      redirect("/dashboard/settings/users?error=Kun+owner+kan+opprette+ny+owner");
    }

    try {
      const adminClient = createAdminClient();
      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone,
        },
      });

      if (createError || !createdUser.user) {
        redirect(
          `/dashboard/settings/users?error=${encodeURIComponent(
            createError?.message ?? "Klarte ikke opprette bruker",
          )}`,
        );
      }

      const { error: updateProfileError } = await adminClient
        .from("profiles")
        .update({
          company_id: currentProfile.company_id,
          role: requestedRole,
          full_name: fullName,
          phone: phone || null,
        })
        .eq("id", createdUser.user.id);

      if (updateProfileError) {
        redirect(
          `/dashboard/settings/users?error=${encodeURIComponent(updateProfileError.message)}`,
        );
      }

      redirect("/dashboard/settings/users?success=1");
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Ukjent feil ved opprettelse av bruker";
      redirect(`/dashboard/settings/users?error=${encodeURIComponent(message)}`);
    }
  }

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
              Owner og admin kan legge til nye brukere i{" "}
              <span className="font-medium text-foreground">{companyName ?? "firmaet"}</span>.
              Nye brukere kan logge inn med e-post og passord du setter her.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="size-5 text-muted-foreground" aria-hidden />
              <CardTitle className="text-lg">Ny bruker</CardTitle>
            </div>
            <CardDescription>Fyll ut skjemaet og send invitasjonen videre på e-post.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createUser} className="space-y-4">
              <div className="space-y-2">
                <NativeLabel htmlFor="full_name">Fullt navn</NativeLabel>
                <NativeInput
                  id="full_name"
                  name="full_name"
                  required
                  placeholder="Ola Nordmann"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="phone">Telefon</NativeLabel>
                <NativeInput id="phone" name="phone" type="tel" placeholder="+47 …" autoComplete="tel" />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="email">E-post</NativeLabel>
                <NativeInput
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="navn@firma.no"
                  autoComplete="off"
                />
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
                <p className="text-xs text-muted-foreground">
                  Må oppfylle passordkrav i Supabase (ofte minst 6 tegn).
                </p>
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="role">Rolle</NativeLabel>
                <select
                  id="role"
                  name="role"
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue="worker"
                >
                  <option value="worker">Montør / worker</option>
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

              <SubmitButton className="w-full sm:w-auto">Opprett bruker</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="border shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg">Team</CardTitle>
              <CardDescription>{users.length} bruker{users.length === 1 ? "" : "e"}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y border-t">
              <div className="grid grid-cols-[1fr_auto] gap-2 bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Navn</span>
                <span className="text-right">Rolle</span>
              </div>
              {users.map((companyUser) => (
                <div
                  key={companyUser.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {companyUser.full_name?.trim() || "Uten navn"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {companyUser.phone?.trim() || "—"}
                    </p>
                  </div>
                  <Badge variant={roleBadgeVariant(companyUser.role)} className="capitalize">
                    {companyUser.role}
                  </Badge>
                </div>
              ))}
            </div>
            {users.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Ingen brukere i lista ennå.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
