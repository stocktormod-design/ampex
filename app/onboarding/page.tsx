import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

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

    const { data: company, error: companyError } = await actionClient
      .from("companies")
      .insert({
        name: companyName,
        org_number: orgNumber,
      })
      .select("id")
      .single();

    if (companyError) {
      redirect(`/onboarding?error=${encodeURIComponent(companyError.message)}`);
    }

    const { error: profileError } = await actionClient
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
              <Label htmlFor="name">Firmanavn</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org_number">Organisasjonsnummer</Label>
              <Input id="org_number" name="org_number" pattern="[0-9]{9}" required />
            </div>
            {searchParams?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{searchParams.error}</AlertDescription>
              </Alert>
            ) : null}
            <Button className="w-full" type="submit">
              Opprett firma
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
