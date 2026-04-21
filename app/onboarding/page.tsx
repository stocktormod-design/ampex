import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { company_id?: string | null } | null;

  if (profile?.company_id) {
    redirect("/dashboard");
  }

  async function createCompany(formData: FormData) {
    "use server";

    const companyName = String(formData.get("name") ?? "");
    const orgNumber = String(formData.get("org_number") ?? "");

    const actionClient = await createClient();
    const {
      data: { user: actionUser },
    } = await actionClient.auth.getUser();

    if (!actionUser) {
      redirect("/auth/login");
    }

    const adminClient = createAdminClient();

    const { data: companyData, error: companyError } = await adminClient
      .from("companies")
      .insert({
        name: companyName,
        org_number: orgNumber,
      })
      .select("id")
      .single();
    const company = companyData as { id: string };

    if (companyError) {
      redirect(`/onboarding?error=${encodeURIComponent(companyError.message)}`);
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        company_id: company.id,
        role: "owner",
      })
      .eq("id", actionUser.id);

    if (profileError) {
      redirect(`/onboarding?error=${encodeURIComponent(profileError.message)}`);
    }

    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Velkommen til Ampex</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCompany} className="space-y-4">
            <div className="space-y-2">
              <NativeLabel htmlFor="name">Firmanavn</NativeLabel>
              <NativeInput id="name" name="name" required autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="org_number">Organisasjonsnummer</NativeLabel>
              <NativeInput
                id="org_number"
                name="org_number"
                pattern="[0-9]{9}"
                required
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            {searchParams?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{searchParams.error}</AlertDescription>
              </Alert>
            ) : null}
            <SubmitButton className="w-full">Opprett firma</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
