import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as {
    company_id: string | null;
    full_name: string | null;
    role: string;
  } | null;

  if (!profile?.company_id) {
    redirect("/onboarding");
  }

  const name = profile.full_name?.trim() || "der";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hei, {name}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Velkommen til dashbordet. Her samles prosjekter, tegninger og lager etter hvert som modulene
          blir klare.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Neste steg</CardTitle>
            <CardDescription>Inviter teamet eller utforsk innstillinger.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {profile.role === "owner" || profile.role === "admin" ? (
              <>
                <Link
                  href="/dashboard/lager"
                  className={cn(buttonVariants({ variant: "default" }), "inline-flex")}
                >
                  Lager
                </Link>
                <Link
                  href="/dashboard/settings/users"
                  className={cn(buttonVariants({ variant: "secondary" }), "inline-flex")}
                >
                  Administrer brukere
                </Link>
              </>
            ) : null}
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}>
              Til forsiden
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>MVP: autentisering og firma er på plass.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Rolle: {roleLabel(profile.role)}</li>
              <li>Firma koblet til profil</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
