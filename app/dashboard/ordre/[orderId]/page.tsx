import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ExternalLink, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/roles";
import {
  addOrderHour,
  addOrderMaterial,
  addOrderPhoto,
  deleteOrderPhoto,
  installerDecideOrder,
  saveDocumentationSection,
  submitOrderForInstaller,
  updateOrderStatus,
} from "@/app/dashboard/ordre/actions";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { OrderCsvExport } from "@/components/order-csv-export";
import { HourTimer } from "@/app/dashboard/ordre/[orderId]/hour-timer";
import { RiskAssessmentForm, type RiskModule } from "@/app/dashboard/ordre/[orderId]/risk-assessment-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orderId: string }> | { orderId: string };
  searchParams?: { tab?: string; error?: string; success?: string };
};

type OrderType = "bolig" | "maritim" | "kompleks";
type TabId = "overview" | "risk" | "hours" | "materials" | "documentation" | "bilder";

const DOC_SECTIONS: Record<OrderType, { key: string; label: string }[]> = {
  bolig: [
    { key: "sjekkliste-bolig", label: "Sjekkliste bolig" },
    { key: "samsvar-bolig", label: "Samsvarserklæring bolig" },
  ],
  maritim: [
    { key: "sjekkliste-maritim", label: "Sjekkliste maritim" },
    { key: "samsvar-maritim", label: "Samsvarserklæring maritim" },
    { key: "sikkerhet-maritim", label: "Sikkerhetslogg maritim" },
  ],
  kompleks: [
    { key: "sjekkliste-kompleks", label: "Sjekkliste kompleks" },
    { key: "samsvar-kompleks", label: "Samsvarserklæring kompleks" },
    { key: "sluttrapport-kompleks", label: "Sluttrapport kompleks" },
  ],
};

const PHOTO_TYPE_LABEL: Record<string, string> = {
  before: "Før",
  after: "Etter",
  general: "Generelt",
};

const PHOTO_TYPE_COLOR: Record<string, string> = {
  before: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  after: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  general: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function orderStatusLabel(status: string) {
  switch (status) {
    case "active": return "Aktiv";
    case "finished": return "Ferdig";
    case "archived": return "Arkivert";
    case "awaiting_installer": return "Venter installatør";
    case "approved": return "Godkjent";
    case "rejected": return "Avvist";
    default: return status;
  }
}

function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}t ${m > 0 ? `${m}m` : ""}`.trim() : `${m}m`;
}

export default async function OrderDetailPage({ params, searchParams }: PageProps) {
  const { orderId } = params instanceof Promise ? await params : params;

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { company_id: string | null; role: string } | null;
  if (!profile?.company_id) redirect("/onboarding");

  const { data: orderData } = await supabase
    .from("orders")
    .select("id, company_id, title, description, type, status, assigned_installer_id, risk_template_id, risk_assessment_templates(name), order_customers(id, name, phone, email, address, maps_query)")
    .eq("id", orderId)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  const order = orderData as {
    id: string;
    company_id: string;
    title: string;
    description: string | null;
    type: OrderType;
    status: string;
    assigned_installer_id: string | null;
    risk_template_id: string | null;
    risk_assessment_templates: { name: string }[] | { name: string } | null;
    order_customers: {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      address: string | null;
      maps_query: string | null;
    } | null;
  } | null;
  if (!order) redirect("/dashboard/ordre");

  const { data: riskData } = await supabase
    .from("order_risk_assessments")
    .select("payload, is_completed, completed_at")
    .eq("order_id", order.id)
    .maybeSingle();
  const risk = riskData as { payload: Record<string, unknown>; is_completed: boolean; completed_at: string | null } | null;
  const riskDone = Boolean(risk?.is_completed);

  const { data: docsData } = await supabase
    .from("order_documentation")
    .select("id, section_key, payload, is_completed")
    .eq("order_id", order.id)
    .order("section_key", { ascending: true });
  const docs = (docsData ?? []) as { id: string; section_key: string; payload: Record<string, unknown>; is_completed: boolean }[];

  const { data: hoursData } = await supabase
    .from("order_hours")
    .select("id, work_date, minutes, note, profiles(full_name)")
    .eq("order_id", order.id)
    .order("work_date", { ascending: false });
  const hours = ((hoursData ?? []) as unknown as {
    id: string;
    work_date: string;
    minutes: number;
    note: string | null;
    profiles: { full_name: string | null }[] | null;
  }[]).map((row) => ({ ...row, profiles: row.profiles?.[0] ?? null }));

  const { data: materialsData } = await supabase
    .from("order_materials")
    .select("id, name, unit, quantity, note")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });
  const materials = (materialsData ?? []) as { id: string; name: string; unit: string; quantity: number; note: string | null }[];

  const { data: installersData } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", profile.company_id)
    .eq("role", "installator")
    .order("full_name", { ascending: true });
  const installers = (installersData ?? []) as { id: string; full_name: string | null }[];

  const { data: inboxData } = await supabase
    .from("installer_inbox_items")
    .select("id, installer_user_id, status, submitted_at, decision_at, decision_note")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });
  const inboxRows = (inboxData ?? []) as {
    id: string;
    installer_user_id: string;
    status: "pending" | "approved" | "rejected";
    submitted_at: string;
    decision_at: string | null;
    decision_note: string | null;
  }[];
  const pendingInbox = inboxRows.find((r) => r.status === "pending") ?? null;

  // Risk assessment modules
  const { data: modulesRaw } = await supabase
    .from("risk_assessment_modules")
    .select("id, name, sort_order, risk_assessment_module_items(id, text, is_required, sort_order)")
    .eq("company_id", profile.company_id)
    .eq("template_id", order.risk_template_id)
    .order("sort_order", { ascending: true });
  const riskModules: RiskModule[] = ((modulesRaw ?? []) as {
    id: string;
    name: string;
    sort_order: number;
    risk_assessment_module_items: { id: string; text: string; is_required: boolean; sort_order: number }[];
  }[]).map((m) => ({
    id: m.id,
    name: m.name,
    items: [...(m.risk_assessment_module_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  // Photos
  const { data: photosRaw } = await supabase
    .from("order_photos")
    .select("id, file_path, caption, photo_type, created_at, uploaded_by")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });
  const photoRows = (photosRaw ?? []) as {
    id: string;
    file_path: string;
    caption: string | null;
    photo_type: string;
    created_at: string;
    uploaded_by: string | null;
  }[];
  const photos = await Promise.all(
    photoRows.map(async (photo) => {
      const { data: urlData } = await adminClient.storage
        .from("order-photos")
        .createSignedUrl(photo.file_path, 60 * 60);
      return { ...photo, url: urlData?.signedUrl ?? null };
    }),
  );

  const requiredSections = DOC_SECTIONS[order.type];
  const completedSections = new Set(docs.filter((d) => d.is_completed).map((d) => d.section_key));
  const docsComplete = requiredSections.every((s) => completedSections.has(s.key));

  const requestedTab = (searchParams?.tab ?? "overview") as TabId;
  const activeTab: TabId = ["overview", "risk", "hours", "materials", "documentation", "bilder"].includes(requestedTab)
    ? requestedTab
    : "overview";

  const tabs: { id: TabId; label: string; locked?: boolean }[] = [
    { id: "overview", label: "Oversikt" },
    { id: "risk", label: "Risikovurdering" },
    { id: "hours", label: "Timer", locked: !riskDone },
    { id: "materials", label: "Materialer", locked: !riskDone },
    { id: "documentation", label: "Dokumentasjon", locked: !riskDone },
    { id: "bilder", label: `Bilder${photos.length > 0 ? ` (${photos.length})` : ""}` },
  ];

  const canManage = isAdminRole(profile.role);
  const canInstallerDecide = profile.role === "installator" || isAdminRole(profile.role);
  const isAssignedInstaller = pendingInbox?.installer_user_id === user.id;
  const canTakeDecision = Boolean(pendingInbox && canInstallerDecide && (isAssignedInstaller || isAdminRole(profile.role)));

  const totalMinutes = hours.reduce((sum, h) => sum + h.minutes, 0);
  const templateName = Array.isArray(order.risk_assessment_templates)
    ? (order.risk_assessment_templates[0]?.name ?? null)
    : (order.risk_assessment_templates?.name ?? null);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/ordre"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Ordre
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{order.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {orderStatusLabel(order.status)} · {order.type}
          {templateName ? ` · Mal: ${templateName}` : ""}
        </p>
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

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.locked ? "#" : `/dashboard/ordre/${order.id}?tab=${tab.id}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeTab === tab.id
                ? "bg-foreground text-background"
                : tab.locked
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "border border-border bg-background hover:bg-muted"
            }`}
            aria-disabled={tab.locked}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Om ordren</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {order.description?.trim() || "Ingen beskrivelse registrert."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Kunde</h2>
            <p className="mt-2 text-sm">{order.order_customers?.name ?? "Ukjent kunde"}</p>
            <p className="text-sm text-muted-foreground">{order.order_customers?.phone || "Ingen telefon"}</p>
            <p className="text-sm text-muted-foreground">{order.order_customers?.email || "Ingen e-post"}</p>
            <p className="text-sm text-muted-foreground">{order.order_customers?.address || "Ingen adresse"}</p>
            {order.order_customers?.maps_query && (
              <a
                href={order.order_customers.maps_query}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                Naviger med Google Maps
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>

          {(hours.length > 0 || materials.length > 0) && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Sammendrag</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {hours.length > 0 && (
                  <div className="rounded-lg bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Totalt registrert</p>
                    <p className="mt-0.5 text-2xl font-bold tabular-nums">{fmtMinutes(totalMinutes)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{hours.length} timeføring{hours.length !== 1 ? "er" : ""}</p>
                  </div>
                )}
                {materials.length > 0 && (
                  <div className="rounded-lg bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">Materialer</p>
                    <p className="mt-0.5 text-2xl font-bold tabular-nums">{materials.length}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">poster registrert</p>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <OrderCsvExport orderTitle={order.title} hours={hours} materials={materials} layout="stacked" />
              </div>
            </div>
          )}

          {canManage && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Status</h2>
              <form action={updateOrderStatus} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="order_id" value={order.id} />
                <select
                  name="status"
                  defaultValue={order.status}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="active">Aktiv</option>
                  <option value="finished">Ferdig</option>
                  <option value="archived">Arkivert</option>
                </select>
                <SubmitButton variant="outline">Oppdater status</SubmitButton>
              </form>
            </div>
          )}

          {canManage && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Send for installatør-signering</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kan sendes når risikovurdering og all påkrevd dokumentasjon er fullført.
              </p>
              <form action={submitOrderForInstaller} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="order_id" value={order.id} />
                <div className="space-y-1">
                  <NativeLabel htmlFor="installer-user">Installatør</NativeLabel>
                  <select
                    id="installer-user"
                    name="installer_user_id"
                    defaultValue={order.assigned_installer_id ?? ""}
                    className="h-10 min-w-[14rem] rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Velg installatør</option>
                    {installers.map((installer) => (
                      <option key={installer.id} value={installer.id}>
                        {installer.full_name?.trim() || "Uten navn"}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton disabled={!riskDone || !docsComplete || installers.length === 0}>
                  Send til installatør
                </SubmitButton>
              </form>
            </div>
          )}

          {canTakeDecision && pendingInbox && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">Installatør beslutning</h2>
              <form action={installerDecideOrder} className="mt-3 space-y-3">
                <input type="hidden" name="inbox_item_id" value={pendingInbox.id} />
                <textarea
                  name="decision_note"
                  rows={3}
                  placeholder="Kommentar (valgfritt)"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="decision"
                    value="approved"
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    Godkjenn
                  </button>
                  <button
                    type="submit"
                    name="decision"
                    value="rejected"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                  >
                    Avvis
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === "risk" && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Sikker Jobb Analyse — {order.type}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fullfør denne før timer, materialer og dokumentasjon kan registreres.
          </p>
          <div className="mt-5">
            <RiskAssessmentForm
              orderId={order.id}
              modules={riskModules}
              existingPayload={risk?.payload ?? null}
              isCompleted={riskDone}
            />
          </div>
        </div>
      )}

      {activeTab === "hours" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold">Timer</h2>
              {hours.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  Totalt: <strong>{fmtMinutes(totalMinutes)}</strong>
                </span>
              )}
              <OrderCsvExport orderTitle={order.title} hours={hours} materials={materials} layout="compact" />
            </div>
            <div className="mt-4 space-y-3">
              <HourTimer orderId={order.id} />
              <p className="text-xs text-muted-foreground">eller legg til manuelt:</p>
              <form action={addOrderHour} className="grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="order_id" value={order.id} />
                <NativeInput name="work_date" type="date" required />
                <NativeInput name="minutes" type="number" min={1} placeholder="Minutter" required />
                <NativeInput name="note" placeholder="Notat" />
                <div className="sm:col-span-3">
                  <SubmitButton disabled={!riskDone}>Legg til timer</SubmitButton>
                </div>
              </form>
            </div>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {hours.map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm sm:px-5">
                <p className="font-medium">{fmtMinutes(row.minutes)} · {row.work_date}</p>
                <p className="text-xs text-muted-foreground">
                  {row.profiles?.full_name?.trim() || "Ukjent bruker"}{row.note ? ` · ${row.note}` : ""}
                </p>
              </li>
            ))}
            {hours.length === 0 && (
              <li className="px-4 py-8 text-sm text-muted-foreground sm:px-5">Ingen timer registrert.</li>
            )}
          </ul>
        </div>
      )}

      {activeTab === "materials" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold">Materialer</h2>
              <OrderCsvExport orderTitle={order.title} hours={hours} materials={materials} layout="compact" />
            </div>
            <form action={addOrderMaterial} className="mt-3 grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="order_id" value={order.id} />
              <NativeInput name="name" placeholder="Materiale" required />
              <NativeInput name="quantity" type="number" min={0.01} step="0.01" placeholder="Antall" required />
              <NativeInput name="unit" placeholder="Enhet (stk/m)" defaultValue="stk" />
              <NativeInput name="note" placeholder="Notat" />
              <div className="sm:col-span-4">
                <SubmitButton disabled={!riskDone}>Legg til materiale</SubmitButton>
              </div>
            </form>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {materials.map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm sm:px-5">
                <p className="font-medium">{row.name} · {row.quantity} {row.unit}</p>
                <p className="text-xs text-muted-foreground">{row.note || "—"}</p>
              </li>
            ))}
            {materials.length === 0 && (
              <li className="px-4 py-8 text-sm text-muted-foreground sm:px-5">Ingen materialer registrert.</li>
            )}
          </ul>
        </div>
      )}

      {activeTab === "documentation" && (
        <div className="space-y-4">
          {requiredSections.map((section) => {
            const existing = docs.find((d) => d.section_key === section.key);
            return (
              <div key={section.key} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-base font-semibold">{section.label}</h2>
                <form action={saveDocumentationSection} className="mt-3 space-y-3">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="section_key" value={section.key} />
                  <textarea
                    name="payload_json"
                    rows={6}
                    defaultValue={JSON.stringify(existing?.payload ?? { notes: "" }, null, 2)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      name="complete"
                      value="0"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      Lagre utkast
                    </button>
                    <button
                      type="submit"
                      name="complete"
                      value="1"
                      className="rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/85"
                      disabled={!riskDone}
                    >
                      Marker fullført
                    </button>
                    {existing?.is_completed && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">Fullført</span>
                    )}
                  </div>
                </form>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "bilder" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Last opp bilde</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              JPEG, PNG eller WebP · maks 10 MB
            </p>
            <form action={addOrderPhoto} className="mt-4 grid gap-3 sm:grid-cols-3" encType="multipart/form-data">
              <input type="hidden" name="order_id" value={order.id} />
              <div className="sm:col-span-3">
                <input
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  required
                  className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
                />
              </div>
              <div className="space-y-1">
                <NativeLabel htmlFor="photo-type">Type</NativeLabel>
                <select
                  id="photo-type"
                  name="photo_type"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="before">Før-bilde</option>
                  <option value="after">Etter-bilde</option>
                  <option value="general">Generelt</option>
                </select>
              </div>
              <div className="space-y-1">
                <NativeLabel htmlFor="photo-caption">Bildetekst (valgfritt)</NativeLabel>
                <NativeInput id="photo-caption" name="caption" placeholder="Kort beskrivelse…" />
              </div>
              <div className="flex items-end">
                <SubmitButton>Last opp</SubmitButton>
              </div>
            </form>
          </div>

          {photos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">Ingen bilder lastet opp ennå.</p>
              <p className="mt-1 text-xs text-muted-foreground">Last opp før- og etter-bilder av jobben.</p>
            </div>
          ) : (
            <>
              {(["before", "after", "general"] as const).map((type) => {
                const group = photos.filter((p) => p.photo_type === type);
                if (group.length === 0) return null;
                return (
                  <div key={type}>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{PHOTO_TYPE_LABEL[type]}-bilder</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {group.map((photo) => (
                        <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                          {photo.url ? (
                            <a href={photo.url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={photo.url}
                                alt={photo.caption ?? `${PHOTO_TYPE_LABEL[type]}-bilde`}
                                className="aspect-square w-full object-cover transition-opacity group-hover:opacity-90"
                              />
                            </a>
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center bg-muted">
                              <span className="text-xs text-muted-foreground">Ikke tilgjengelig</span>
                            </div>
                          )}
                          <div className="p-2">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PHOTO_TYPE_COLOR[photo.photo_type]}`}
                            >
                              {PHOTO_TYPE_LABEL[photo.photo_type]}
                            </span>
                            {photo.caption && (
                              <p className="mt-1 text-xs text-muted-foreground">{photo.caption}</p>
                            )}
                          </div>
                          {(canManage || photo.uploaded_by === user.id) && (
                            <form
                              action={deleteOrderPhoto}
                              className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <input type="hidden" name="photo_id" value={photo.id} />
                              <input type="hidden" name="order_id" value={order.id} />
                              <button
                                type="submit"
                                className="flex size-7 items-center justify-center rounded-lg bg-background/80 text-destructive shadow backdrop-blur-sm hover:bg-background"
                                title="Slett bilde"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
