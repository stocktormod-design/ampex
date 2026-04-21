import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Innlogget bruker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Navn: {profile?.full_name ?? "Ikke satt"}</p>
          <p>Rolle: {profile?.role ?? "Ikke satt"}</p>
        </CardContent>
      </Card>
    </main>
  );
}
