import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { createCustomer, updateCustomer } from "@/app/dashboard/kunder/actions";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { q?: string; new?: string; error?: string; success?: string };
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { company_id: string | null; role: string } | null;
  if (!profile?.company_id) redirect("/onboarding");

  const canManage = isAdminRole(profile.role);
  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const showForm = searchParams?.new === "1" && canManage;

  const { data: customersData } = await supabase
    .from("order_customers")
    .select("id, name, phone, email, address, maps_query, created_at")
    .eq("company_id", profile.company_id)
    .order("name", { ascending: true });
  const rows = (customersData ?? []) as {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    maps_query: string | null;
    created_at: string;
  }[];

  const filtered = rows.filter((row) => {
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      (row.phone?.toLowerCase().includes(q) ?? false) ||
      (row.email?.toLowerCase().includes(q) ?? false) ||
      (row.address?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Kunder</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{rows.length} kunder</p>
        </div>
        {canManage && (
          <Link
            href={showForm ? "/dashboard/kunder" : "/dashboard/kunder?new=1"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
            Ny kunde
          </Link>
        )}
      </div>

      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}
      {searchParams?.success && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Endringen ble lagret.
        </p>
      )}

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Ny kunde</h2>
          <form action={createCustomer} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <NativeLabel htmlFor="customer-name">Navn</NativeLabel>
              <NativeInput id="customer-name" name="name" required autoFocus />
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="customer-phone">Mobilnummer</NativeLabel>
              <NativeInput id="customer-phone" name="phone" />
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="customer-email">E-post</NativeLabel>
              <NativeInput id="customer-email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="customer-address">Adresse</NativeLabel>
              <NativeInput id="customer-address" name="address" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Opprett kunde</SubmitButton>
            </div>
          </form>
        </div>
      )}

      <form method="get" className="flex gap-2">
        {showForm && <input type="hidden" name="new" value="1" />}
        <NativeInput
          name="q"
          defaultValue={searchParams?.q ?? ""}
          placeholder="Søk kunde..."
          className="flex-1"
        />
        <SubmitButton variant="outline">Søk</SubmitButton>
      </form>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">Ingen kunder matcher søket.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <form action={updateCustomer} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="customer_id" value={row.id} />
                <div className="space-y-1">
                  <NativeLabel>Navn</NativeLabel>
                  <NativeInput name="name" defaultValue={row.name} required />
                </div>
                <div className="space-y-1">
                  <NativeLabel>Mobil</NativeLabel>
                  <NativeInput name="phone" defaultValue={row.phone ?? ""} />
                </div>
                <div className="space-y-1">
                  <NativeLabel>E-post</NativeLabel>
                  <NativeInput name="email" type="email" defaultValue={row.email ?? ""} />
                </div>
                <div className="space-y-1">
                  <NativeLabel>Adresse</NativeLabel>
                  <NativeInput name="address" defaultValue={row.address ?? ""} />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between gap-2">
                  <SubmitButton variant="outline">Lagre kunde</SubmitButton>
                  {row.maps_query ? (
                    <a
                      href={row.maps_query}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Åpne i Google Maps
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Ingen navigasjonslenke</span>
                  )}
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
