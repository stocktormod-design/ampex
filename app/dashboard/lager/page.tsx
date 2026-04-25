import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ChevronRight, Package } from "lucide-react";
import { createWarehouse } from "@/app/dashboard/lager/actions";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type LagerPageProps = {
  searchParams?: { new?: string; error?: string };
};

export default async function LagerPage({ searchParams }: LagerPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { company_id: string | null; role: string } | null;

  if (!profile?.company_id) redirect("/onboarding");
  if (!isAdminRole(profile.role)) redirect("/dashboard/projects");

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name, location, created_at, warehouse_items(count)")
    .eq("company_id", profile.company_id)
    .order("name", { ascending: true });

  const rows = (warehouses ?? []).map((w) => {
    const raw = w as typeof w & { warehouse_items?: { count: number }[] };
    return {
      id: raw.id as string,
      name: raw.name as string,
      location: raw.location as string | null,
      itemCount: raw.warehouse_items?.[0]?.count ?? 0,
    };
  });

  const showForm = searchParams?.new === "1";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Lager</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {rows.length} lager{rows.length === 1 ? "" : " totalt"}
          </p>
        </div>
        <Link
          href={showForm ? "/dashboard/lager" : "/dashboard/lager?new=1"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
        >
          <Plus className="size-4" aria-hidden />
          Nytt
        </Link>
      </div>

      {/* ── Error ── */}
      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}

      {/* ── Create form (collapsible) ── */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Nytt lager</h2>
          <form action={createWarehouse} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <NativeLabel htmlFor="name">Navn *</NativeLabel>
                <NativeInput
                  id="name"
                  name="name"
                  required
                  placeholder="Båtlager"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="location">Plassering</NativeLabel>
                <NativeInput id="location" name="location" placeholder="Kaia 4" autoComplete="off" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SubmitButton>Opprett lager</SubmitButton>
              <Link
                href="/dashboard/lager"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Avbryt
              </Link>
            </div>
          </form>
        </div>
      )}

      {/* ── Warehouse list ── */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-16 text-center">
          <Package className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">Ingen lagre ennå.</p>
          {!showForm && (
            <Link
              href="/dashboard/lager?new=1"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              <Plus className="size-3.5" />
              Opprett det første
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {rows.map((w) => (
            <li key={w.id}>
              <Link
                href={`/dashboard/lager/${w.id}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Package className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{w.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {w.location ? <span>{w.location} · </span> : null}
                    {w.itemCount} vare{w.itemCount === 1 ? "" : "r"}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
