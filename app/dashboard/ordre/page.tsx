import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ChevronRight, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { createCustomerInline, createOrder } from "@/app/dashboard/ordre/actions";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    new?: string;
    error?: string;
    success?: string;
  };
};

type OrderRow = {
  id: string;
  title: string;
  description: string | null;
  type: "bolig" | "maritim" | "kompleks";
  status: "active" | "finished" | "archived" | "awaiting_installer" | "approved" | "rejected";
  customer_id: string;
  created_at: string;
  order_customers: { name: string } | null;
};

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Aktiv";
    case "finished":
      return "Ferdig";
    case "archived":
      return "Arkivert";
    case "awaiting_installer":
      return "Venter installatør";
    case "approved":
      return "Godkjent";
    case "rejected":
      return "Avvist";
    default:
      return status;
  }
}

export default async function OrdersPage({ searchParams }: PageProps) {
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
  const statusFilter = searchParams?.status ?? "active";
  const showForm = searchParams?.new === "1" && canManage;

  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, title, description, type, status, customer_id, created_at, order_customers(name)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });
  const rows = (ordersData ?? []) as unknown as OrderRow[];

  const filtered = rows.filter((row) => {
    if (statusFilter === "active") {
      if (row.status !== "active" && row.status !== "awaiting_installer") return false;
    } else if (statusFilter === "finished") {
      if (row.status !== "finished" && row.status !== "approved" && row.status !== "rejected") return false;
    } else if (statusFilter === "archived" && row.status !== "archived") {
      return false;
    }
    if (!q) return true;
    return (
      row.title.toLowerCase().includes(q) ||
      (row.description?.toLowerCase().includes(q) ?? false) ||
      (row.order_customers?.name?.toLowerCase().includes(q) ?? false)
    );
  });

  const { data: customersData } = await supabase
    .from("order_customers")
    .select("id, name")
    .eq("company_id", profile.company_id)
    .order("name", { ascending: true });
  const customers = (customersData ?? []) as { id: string; name: string }[];

  const { data: installersData } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("company_id", profile.company_id)
    .eq("role", "installator")
    .order("full_name", { ascending: true });
  const installers = (installersData ?? []) as { id: string; full_name: string | null; role: string }[];

  const { data: templatesData } = await supabase
    .from("risk_assessment_templates")
    .select("id, name")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });
  const templates = (templatesData ?? []) as { id: string; name: string }[];
  const activeCount = rows.filter((row) => row.status === "active" || row.status === "awaiting_installer").length;
  const finishedCount = rows.filter(
    (row) => row.status === "finished" || row.status === "approved" || row.status === "rejected",
  ).length;
  const archivedCount = rows.filter((row) => row.status === "archived").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Ordre</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{rows.length} ordre totalt</p>
        </div>
        {canManage && (
          <Link
            href={showForm ? "/dashboard/ordre" : "/dashboard/ordre?new=1"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
            Ny ordre
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

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <form method="get" className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
            {showForm && <input type="hidden" name="new" value="1" />}
            <NativeInput
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder="Søk på ordre eller kunde..."
              className="min-w-[12rem] flex-1"
            />
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="active">Aktive</option>
              <option value="finished">Ferdige</option>
              <option value="archived">Arkiv</option>
            </select>
            <SubmitButton variant="outline">Filtrer</SubmitButton>
          </form>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-16 text-center">
              <ClipboardList className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-sm text-muted-foreground">Ingen ordre matcher filteret.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {filtered.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/dashboard/ordre/${row.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{row.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.order_customers?.name ?? "Ukjent kunde"} · {statusLabel(row.status)} · {row.type}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Aktive</p>
              <p className="mt-1 text-xl font-semibold">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Ferdige</p>
              <p className="mt-1 text-xl font-semibold">{finishedCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Arkiv</p>
              <p className="mt-1 text-xl font-semibold">{archivedCount}</p>
            </div>
          </div>

          {showForm && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold">Ny ordre</h2>
              <form action={createOrder} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <NativeLabel htmlFor="order-title">Tittel</NativeLabel>
                    <NativeInput id="order-title" name="title" required autoFocus />
                  </div>
                  <div className="space-y-2">
                    <NativeLabel htmlFor="order-type">Type</NativeLabel>
                    <select
                      id="order-type"
                      name="type"
                      defaultValue="bolig"
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="bolig">Bolig</option>
                      <option value="maritim">Maritim</option>
                      <option value="kompleks">Kompleks</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <NativeLabel htmlFor="order-customer">Kunde</NativeLabel>
                    <select
                      id="order-customer"
                      name="customer_id"
                      required
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Velg kunde</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <NativeLabel htmlFor="order-installer">Installatør</NativeLabel>
                    <select
                      id="order-installer"
                      name="assigned_installer_id"
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Velg senere</option>
                      {installers.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.full_name?.trim() || "Uten navn"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <NativeLabel htmlFor="order-risk-template">Risikomal</NativeLabel>
                  <select
                    id="order-risk-template"
                    name="risk_template_id"
                    required
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Velg risikomal</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p className="text-xs text-destructive">
                      Ingen risikomaler funnet. Opprett mal under Innstillinger → Sjekklister.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <NativeLabel htmlFor="order-description">Hva gjelder ordren?</NativeLabel>
                  <textarea
                    id="order-description"
                    name="description"
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <SubmitButton>Opprett ordre</SubmitButton>
                  <Link href="/dashboard/ordre" className="text-sm text-muted-foreground hover:text-foreground">
                    Avbryt
                  </Link>
                </div>
              </form>

              <div className="mt-6 border-t pt-4">
                <h3 className="mb-2 text-sm font-semibold">Ny kunde (hurtig)</h3>
                <form action={createCustomerInline} className="grid gap-3 sm:grid-cols-2">
                  <NativeInput name="name" placeholder="Navn" required />
                  <NativeInput name="phone" placeholder="Mobil" />
                  <NativeInput name="email" type="email" placeholder="E-post" />
                  <NativeInput name="address" placeholder="Adresse" />
                  <div className="sm:col-span-2">
                    <SubmitButton variant="outline">Legg til kunde</SubmitButton>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
