import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginPageProps = {
  searchParams?: {
    error?: string;
    next?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/dashboard");

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
    }

    redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Logg inn i Ampex</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <input type="hidden" name="next" defaultValue={searchParams?.next ?? "/dashboard"} />
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passord</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {searchParams?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{searchParams.error}</AlertDescription>
              </Alert>
            ) : null}
            <Button className="w-full" type="submit">
              Logg inn
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Har du ikke konto?{" "}
            <Link className="underline" href="/auth/register">
              Registrer firma
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
