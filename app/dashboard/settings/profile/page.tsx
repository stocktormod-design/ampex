import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/roles";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfile } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { error?: string; success?: string };
};

export default async function ProfilePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, phone, role, companies(name)")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as {
    full_name: string | null;
    phone: string | null;
    role: string;
    companies: { name: string } | null;
  } | null;

  if (!profile) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Min profil</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {profile.companies?.name ?? "—"} · {roleLabel(profile.role)}
        </p>
      </div>

      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}
      {searchParams?.success === "1" && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Profil oppdatert.
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Kontaktinformasjon</h2>
        <form action={updateProfile} className="space-y-4">
          <div className="space-y-2">
            <NativeLabel htmlFor="email">E-post</NativeLabel>
            <NativeInput
              id="email"
              value={user.email ?? ""}
              disabled
              className="opacity-60"
            />
            <p className="text-xs text-muted-foreground">E-postadressen kan ikke endres her.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <NativeLabel htmlFor="full_name">Fullt navn *</NativeLabel>
              <NativeInput
                id="full_name"
                name="full_name"
                required
                defaultValue={profile.full_name ?? ""}
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="phone">Telefon</NativeLabel>
              <NativeInput
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ""}
                autoComplete="tel"
                placeholder="+47 000 00 000"
              />
            </div>
          </div>
          <SubmitButton>Lagre endringer</SubmitButton>
        </form>
      </div>
    </div>
  );
}
