import Link from "next/link";
import { Users, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = user?.user_metadata as { full_name?: string } | undefined;
  const displayName =
    (meta?.full_name && String(meta.full_name).trim()) ||
    user?.email?.split("@")[0] ||
    "Bruker";

  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, role, companies(name)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const profile = profileData as {
    full_name?: string | null;
    role?: string | null;
    companies?: { name: string } | null;
  } | null;

  const resolvedName =
    (profile?.full_name && profile.full_name.trim()) || displayName;
  const companyName =
    profile?.companies && typeof profile.companies === "object" && "name" in profile.companies
      ? (profile.companies as { name: string }).name
      : null;
  const roleLabel = profile?.role ?? "—";
  const initials = resolvedName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Oversikt</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Velkommen tilbake. Her starter arbeidet i AMPEX.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit capitalize">
          {roleLabel}
        </Badge>
      </div>

      <Card className="overflow-hidden border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-xl">Hei, {resolvedName}</CardTitle>
            <CardDescription className="mt-1 truncate">
              {user?.email}
              {companyName ? ` · ${companyName}` : ""}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 border-t bg-muted/20 pt-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Navn i profil
            </p>
            <p className="mt-0.5 font-medium">
              {profile?.full_name?.trim() ? profile.full_name : "Ikke satt"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rolle
            </p>
            <p className="mt-0.5 font-medium capitalize">{roleLabel}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Snarveier
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/dashboard/settings/users"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-auto justify-start gap-3 px-4 py-4 text-left font-normal",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="size-5 text-foreground" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">Brukere</span>
              <span className="text-xs text-muted-foreground">
                Opprett og administrer teamet
              </span>
            </span>
          </Link>
          <div
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-auto cursor-default justify-start gap-3 px-4 py-4 text-left font-normal opacity-70",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <LayoutDashboard className="size-5 text-foreground" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">Prosjekter</span>
              <span className="text-xs text-muted-foreground">Kommer i neste steg</span>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
