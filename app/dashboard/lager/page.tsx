import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { createWarehouse } from "@/app/dashboard/lager/actions";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type LagerPageProps = {
  searchParams?: { error?: string };
};

export default async function LagerPage({ searchParams }: LagerPageProps) {
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
  const profile = profileData as { company_id: string | null; role: string } | null;

  if (!profile?.company_id) {
    redirect("/onboarding");
  }

  if (!isAdminRole(profile.role)) {
    redirect("/dashboard");
  }

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name, location, created_at")
    .eq("company_id", profile.company_id)
    .order("name", { ascending: true });

  const rows = (warehouses ?? []) as {
    id: string;
    name: string;
    location: string | null;
    created_at: string;
  }[];

  return (
    <main className="space-y-8">
      <div className="flex gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Package className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lager</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Admin oppretter lagre (f.eks. båtlager). I hvert lager registreres varer med strekkode
            (skann eller skriv), og kan redigeres manuelt uten kamera.
          </p>
        </div>
      </div>

      {searchParams?.error ? (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Dine lagre</CardTitle>
            <CardDescription>
              {rows.length} lager{rows.length === 1 ? "" : " totalt"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ingen lagre ennå. Opprett det første i skjemaet under (eller til høyre på store
                skjermer).
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {rows.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/dashboard/lager/${w.id}`}
                      className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="font-medium">{w.name}</span>
                      {w.location ? (
                        <span className="text-xs text-muted-foreground">{w.location}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Nytt lager</CardTitle>
            <CardDescription>F.eks. «Båtlager», «Kontor», «Bil 12».</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createWarehouse} className="space-y-4">
              <div className="space-y-2">
                <NativeLabel htmlFor="name">Navn</NativeLabel>
                <NativeInput id="name" name="name" required placeholder="Båtlager" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="location">Plassering (valgfritt)</NativeLabel>
                <NativeInput id="location" name="location" placeholder="Kaia 4" autoComplete="off" />
              </div>
              <SubmitButton className="w-full">Opprett lager</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
