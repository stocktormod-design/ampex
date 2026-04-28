import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/roles";
import { SubmitButton } from "@/components/ui/submit-button";
import { IntegrationSetupForm } from "./integration-setup-form";
import {
  upsertIntegration,
  queueManualSync,
  createPurchaseOrder,
  markPurchaseOrderSent,
} from "./actions";
import type { IntegrationStatusRow, SyncJobRow, SyncJobStatus } from "@/lib/integrations/types";
import { ReceiptImportPanel } from "./receipt-import-panel";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { error?: string; success?: string };
};

function providerLabel(p: string) {
  return p === "fiken" ? "Fiken" : p === "tripletex" ? "Tripletex" : p;
}

function statusLabel(s: SyncJobStatus | string): string {
  switch (s) {
    case "queued":      return "I kø";
    case "processing":  return "Behandler";
    case "completed":   return "Fullført";
    case "failed":      return "Feilet";
    case "retry_wait":  return "Venter på retry";
    case "pending":     return "I kø";
    case "running":     return "Behandler";
    default:            return s;
  }
}

function statusColor(s: string): string {
  if (s === "completed") return "text-green-600 dark:text-green-400";
  if (s === "failed")    return "text-destructive";
  return "text-muted-foreground";
}

function purchaseStatusLabel(status: string): string {
  switch (status) {
    case "draft": return "Utkast";
    case "sent": return "Sendt";
    case "confirmed": return "Bekreftet";
    case "received": return "Mottatt";
    case "cancelled": return "Kansellert";
    default: return status;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RegnskapPage({ searchParams }: PageProps) {
  // ── Auth + admin-sjekk ─────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.company_id || !isAdminRole(profile.role)) {
    redirect("/dashboard");
  }

  const companyId = profile.company_id as string;
  const admin = createAdminClient();

  // ── Datauthenting ──────────────────────────────────────────────────────
  const [{ data: rawIntegrations }, { data: rawJobs }, { data: rawCatalog }, { data: rawPurchaseOrders }] = await Promise.all([
    admin
      .from("company_integrations")
      .select(
        "id, provider, status, auth_meta, auth_secret_ref, last_sync_at, last_sync_status, last_sync_error, created_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    admin
      .from("erp_sync_jobs")
      .select(
        "id, status, created_at, retry_count, max_retries, last_error, next_retry_at, order_id, orders(title)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("warehouse_items")
      .select("id, name, unit, quantity, warehouses(name, company_id)")
      .eq("warehouses.company_id", companyId)
      .order("name", { ascending: true })
      .limit(60),
    admin
      .from("purchase_orders")
      .select("id, supplier_name, status, notes, sent_at, created_at, purchase_order_lines(item_name, quantity, unit)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Supabase infererer join-koloner som array; cast via unknown er nødvendig her.
  const integrations = (rawIntegrations ?? []) as unknown as IntegrationStatusRow[];
  const jobs = (rawJobs ?? []) as unknown as SyncJobRow[];
  const catalogItems = (rawCatalog ?? []) as unknown as {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    warehouses: { name: string; company_id: string }[] | null;
  }[];
  const purchaseOrders = (rawPurchaseOrders ?? []) as unknown as {
    id: string;
    supplier_name: string;
    status: string;
    notes: string | null;
    sent_at: string | null;
    created_at: string;
    purchase_order_lines: { item_name: string; quantity: number; unit: string }[] | null;
  }[];
  const activeIntegration = integrations.find((i) => i.status === "active") ?? integrations[0] ?? null;

  const currentSlug =
    activeIntegration?.provider === "fiken"
      ? (activeIntegration.auth_meta as Record<string, string>).companySlug ?? null
      : null;

  return (
    <div className="space-y-6">
      {/* ── Topptekst ── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Regnskap</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          ERP-integrasjon og fakturagrunnlag
        </p>
      </div>

      {/* ── Tilbakemelding fra actions ── */}
      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {decodeURIComponent(searchParams.error)}
        </p>
      )}
      {searchParams?.success && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {decodeURIComponent(searchParams.success)}
        </p>
      )}

      {/* ── Integrasjonsstatus ── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Integrasjonsstatus</h2>

        {activeIntegration ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {providerLabel(activeIntegration.provider)}
                  <span
                    className={`ml-2 text-xs font-normal ${
                      activeIntegration.status === "active"
                        ? "text-green-600 dark:text-green-400"
                        : "text-destructive"
                    }`}
                  >
                    {activeIntegration.status === "active"
                      ? "● Aktiv"
                      : activeIntegration.status === "inactive"
                        ? "● Inaktiv"
                        : "● Feil"}
                  </span>
                </p>

                {activeIntegration.last_sync_at ? (
                  <p className="text-xs text-muted-foreground">
                    Siste synk: {formatDate(activeIntegration.last_sync_at)}
                    {activeIntegration.last_sync_status && (
                      <span
                        className={`ml-1.5 ${statusColor(activeIntegration.last_sync_status)}`}
                      >
                        · {statusLabel(activeIntegration.last_sync_status)}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Ingen synk gjennomført ennå.</p>
                )}

                {activeIntegration.last_sync_error && (
                  <p className="max-w-sm text-xs text-destructive">
                    {activeIntegration.last_sync_error}
                  </p>
                )}
              </div>

              {/* Manuell synk-knapp */}
              <form action={queueManualSync} className="shrink-0">
                <input type="hidden" name="integration_id" value={activeIntegration.id} />
                <SubmitButton size="sm" variant="outline">
                  Kø manuell synk
                </SubmitButton>
              </form>
            </div>

            {/* Andre konfigurerte integrasjoner (inaktive) */}
            {integrations.length > 1 && (
              <div className="border-t border-border/60 pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Øvrige leverandører
                </p>
                <div className="space-y-1">
                  {integrations
                    .filter((i) => i.id !== activeIntegration.id)
                    .map((i) => (
                      <p key={i.id} className="text-xs text-muted-foreground">
                        {providerLabel(i.provider)} ·{" "}
                        {i.status === "inactive" ? "Inaktiv" : "Feil"}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ingen ERP-integrasjon konfigurert ennå. Fyll inn skjemaet nedenfor for å komme i gang.
          </p>
        )}
      </div>

      {/* ── Rediger integrasjon ── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold">
          {activeIntegration ? "Rediger integrasjon" : "Konfigurer integrasjon"}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Velg leverandør og fyll inn tilgangsinformasjon.
          API-nøkler lagres kryptert i Supabase Vault — aldri i klartekst.
        </p>

        <IntegrationSetupForm
          action={upsertIntegration}
          currentProvider={
            (activeIntegration?.provider ?? null) as
              | "fiken"
              | "tripletex"
              | null
          }
          currentSlug={currentSlug}
        />
      </div>

      {/* ── Nylige synkjobber ── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Nylige synkjobber</h2>

        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen synkjobber ennå.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-start justify-between gap-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {job.orders?.title ??
                      (job.order_id
                        ? `Ordre ${job.order_id.slice(0, 8)}…`
                        : "Generell synk")}
                  </p>
                  {job.last_error && (
                    <p className="mt-0.5 truncate text-xs text-destructive">
                      {job.last_error}
                    </p>
                  )}
                  {job.next_retry_at && job.status === "retry_wait" && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Neste forsøk: {formatDate(job.next_retry_at)}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-medium ${statusColor(job.status)}`}>
                    {statusLabel(job.status)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(job.created_at)}
                  </p>
                  {job.retry_count > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {job.retry_count}/{job.max_retries} forsøk
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Varebestilling v1 ── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold">Varebestilling</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Bestill varer fra lokal katalog nå. Ekstern leverandørkatalog (API) kan kobles på samme flyt senere.
        </p>

        <form action={createPurchaseOrder} className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="supplier_name" className="text-xs font-medium text-muted-foreground">Leverandør</label>
            <input
              id="supplier_name"
              name="supplier_name"
              defaultValue="Ahlsell"
              placeholder="f.eks. Ahlsell, Onninen, Solar"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="warehouse_item_id" className="text-xs font-medium text-muted-foreground">Produkt</label>
            <select
              id="warehouse_item_id"
              name="warehouse_item_id"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
              defaultValue=""
            >
              <option value="" disabled>Velg produkt fra katalog</option>
              {catalogItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit}) · På lager: {item.quantity}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="quantity" className="text-xs font-medium text-muted-foreground">Antall</label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="f.eks. 10"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <label htmlFor="notes" className="text-xs font-medium text-muted-foreground">Kommentar (valgfritt)</label>
            <input
              id="notes"
              name="notes"
              placeholder="Leveringsinfo, hastegrad, referanse osv."
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-end">
            <SubmitButton>Opprett bestilling</SubmitButton>
          </div>
        </form>
      </div>

      <ReceiptImportPanel defaultSupplierName="Elektroimportøren" />

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">Nylige varebestillinger</h2>
        {purchaseOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen bestillinger ennå.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {purchaseOrders.map((order) => (
              <div key={order.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {order.supplier_name} · {purchaseStatusLabel(order.status)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {(order.purchase_order_lines ?? []).map((line) => `${line.item_name} (${line.quantity} ${line.unit})`).join(", ") || "Ingen linjer"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Opprettet {formatDate(order.created_at)}
                    {order.sent_at ? ` · Sendt ${formatDate(order.sent_at)}` : ""}
                  </p>
                </div>
                {order.status === "draft" && (
                  <form action={markPurchaseOrderSent}>
                    <input type="hidden" name="purchase_order_id" value={order.id} />
                    <SubmitButton size="sm" variant="outline">Marker som sendt</SubmitButton>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
