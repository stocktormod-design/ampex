import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as CompanyProfile | null;

  if (!profile?.company_id) {
    redirect("/onboarding");
  }

  if (!["owner", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

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
      const message =
        error instanceof Error ? error.message : "Ukjent feil ved opprettelse av bruker";
      redirect(`/dashboard/settings/users?error=${encodeURIComponent(message)}`);
    }
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Brukeradministrasjon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Owner og admin kan opprette brukere i eget firma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opprett ny bruker</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createUser} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Navn</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passord</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="role">Rolle</Label>
              <select
                id="role"
                name="role"
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm"
                defaultValue="worker"
              >
                <option value="worker">Worker</option>
                <option value="admin">Admin</option>
                {profile.role === "owner" ? <option value="owner">Owner</option> : null}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Opprett bruker</Button>
            </div>
          </form>

          <p className="mt-4 text-xs text-muted-foreground">
            Dev-test: Opprett bruker med navn <strong>Tormod</strong> og ønsket passord her.
          </p>

          {searchParams?.error ? (
            <Alert className="mt-4" variant="destructive">
              <AlertDescription>{searchParams.error}</AlertDescription>
            </Alert>
          ) : null}
          {searchParams?.success ? (
            <Alert className="mt-4">
              <AlertDescription>Bruker ble opprettet.</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brukere i firmaet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((companyUser) => (
            <div
              key={companyUser.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <div>
                <p className="font-medium">{companyUser.full_name || "Uten navn"}</p>
                <p className="text-muted-foreground">{companyUser.phone || "Ingen telefon"}</p>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium uppercase">
                {companyUser.role}
              </span>
            </div>
          ))}
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen brukere funnet.</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
