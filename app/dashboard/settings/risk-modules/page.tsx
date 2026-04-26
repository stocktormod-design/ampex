import { redirect } from "next/navigation";
import { Plus, Trash2, ClipboardList, Sparkles, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createModule,
  updateModuleName,
  deleteModule,
  addModuleItem,
  updateModuleItem,
  toggleItemRequired,
  deleteModuleItem,
  seedDefaultModules,
  createTemplate,
  updateTemplateName,
  duplicateTemplate,
  deleteTemplate,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { error?: string; template?: string };
};

type ModuleItem = { id: string; text: string; is_required: boolean; sort_order: number };
type Module = {
  id: string;
  name: string;
  sort_order: number;
  risk_assessment_module_items: ModuleItem[];
};
type Template = { id: string; name: string };

const fieldCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/60";

export default async function RiskModulesPage({ searchParams }: PageProps) {
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
  if (!["owner", "admin", "installator"].includes(profile.role)) redirect("/dashboard");

  const { data: templatesData } = await supabase
    .from("risk_assessment_templates")
    .select("id, name")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });
  const templates = (templatesData ?? []) as Template[];
  const selectedTemplateId = searchParams?.template?.trim() ?? "";
  const activeTemplate =
    templates.find((t) => t.id === selectedTemplateId) ??
    templates[0] ??
    null;

  const modulesQuery = supabase
    .from("risk_assessment_modules")
    .select("id, name, sort_order, risk_assessment_module_items(id, text, is_required, sort_order)")
    .eq("company_id", profile.company_id)
    .order("sort_order", { ascending: true });
  const { data: modulesData } = activeTemplate
    ? await modulesQuery.eq("template_id", activeTemplate.id)
    : await modulesQuery.limit(0);

  const modules = (modulesData ?? []) as Module[];
  const totalItems = modules.reduce((s, m) => s + (m.risk_assessment_module_items?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Risikomaler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opprett gjenbrukbare maler med seksjoner og sjekkpunkter for ordre.
            {modules.length > 0 && activeTemplate && (
              <span className="ml-1.5 tabular-nums">
                {modules.length} seksjon{modules.length !== 1 ? "er" : ""},{" "}
                {totalItems} punkt{totalItems !== 1 ? "er" : ""} totalt.
              </span>
            )}
          </p>
        </div>

        {activeTemplate && (
          <form action={seedDefaultModules}>
            <input type="hidden" name="template_id" value={activeTemplate.id} />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
              title="Legg til norsk standard sjekkliste (NEK 400 / FSE)"
            >
              <Sparkles className="size-3.5" />
              Last inn standard
            </button>
          </form>
        )}
      </div>

      {searchParams?.error && (
        <Alert variant="destructive">
          <AlertDescription>{searchParams.error}</AlertDescription>
        </Alert>
      )}

      {/* ── Template list / selector ── */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Maler</h2>
          <form action={createTemplate} className="flex items-center gap-2">
            <input
              name="name"
              required
              autoComplete="off"
              placeholder='Ny mal, f.eks. "Maritim risikovurdering"'
              className={`${fieldCls} h-8 min-w-[13rem] py-1 text-xs`}
            />
            <SubmitButton className="h-8 px-3 text-xs">Opprett mal</SubmitButton>
          </form>
        </div>

        <div className="flex flex-wrap gap-2">
          {templates.map((tpl) => {
            const active = activeTemplate?.id === tpl.id;
            return (
              <a
                key={tpl.id}
                href={`/dashboard/settings/risk-modules?template=${tpl.id}`}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-foreground text-background"
                    : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tpl.name}
              </a>
            );
          })}
        </div>
        {templates.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Ingen maler ennå. Opprett første mal for å begynne.
          </p>
        )}

        {activeTemplate && (
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <form action={updateTemplateName} className="flex min-w-[14rem] flex-1 items-center gap-2">
                <input type="hidden" name="template_id" value={activeTemplate.id} />
                <input
                  name="name"
                  defaultValue={activeTemplate.name}
                  required
                  className={`${fieldCls} h-8 py-1 text-xs`}
                />
                <SubmitButton variant="outline" className="h-8 px-2.5 text-xs">
                  Lagre
                </SubmitButton>
              </form>
              <form action={duplicateTemplate}>
                <input type="hidden" name="template_id" value={activeTemplate.id} />
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
                >
                  <Copy className="size-3.5" />
                  Dupliser
                </button>
              </form>
              {templates.length > 1 && (
                <form action={deleteTemplate}>
                  <input type="hidden" name="template_id" value={activeTemplate.id} />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                    Slett mal
                  </button>
                </form>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Denne malen brukes i alle valgte ordre.
            </p>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {activeTemplate && modules.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 px-6 py-14 text-center">
          <ClipboardList className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-sm font-semibold">Ingen seksjoner i denne malen ennå</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start med standardinnhold, eller legg til seksjoner manuelt.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <form action={seedDefaultModules}>
              <input type="hidden" name="template_id" value={activeTemplate.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/85"
              >
                <Sparkles className="size-4" />
                Last inn norsk standardsjekkliste
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Section cards ── */}
      {activeTemplate && modules.map((mod) => {
        const items = [...(mod.risk_assessment_module_items ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        const requiredCount = items.filter((i) => i.is_required).length;

        return (
          <div key={mod.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Module header */}
            <div className="flex items-center gap-2 border-b border-border bg-muted/25 px-4 py-3">
              <form action={updateModuleName} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="module_id" value={mod.id} />
                <input
                  name="name"
                  defaultValue={mod.name}
                  required
                  placeholder="Modulnavn…"
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none hover:border-input focus:border-input focus-visible:ring-2 focus-visible:ring-ring"
                />
                <SubmitButton variant="outline" className="h-7 shrink-0 px-2.5 text-xs">
                  Lagre
                </SubmitButton>
              </form>

              <div className="flex shrink-0 items-center gap-1.5 pl-1 text-xs text-muted-foreground">
                      <span>{items.length} punkt{items.length !== 1 ? "er" : ""}</span>
                {requiredCount > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          ⚠ {requiredCount} OBL.
                        </span>
                )}
              </div>

              <form action={deleteModule}>
                <input type="hidden" name="module_id" value={mod.id} />
                <button
                  type="submit"
                  title="Slett modul"
                  className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </form>
            </div>

            {/* Items */}
            {items.length === 0 && (
              <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                Ingen sjekkpunkter ennå — legg til nedenfor.
              </p>
            )}

            {items.length > 0 && (
              <ul className="divide-y divide-border/50">
                {items.map((item) => (
                  <li key={item.id}>
                    {/*
                      One <form> per item. formAction overrides on specific buttons:
                       • Badge (Obl/Valg) → toggleItemRequired
                       • Delete (Trash)   → deleteModuleItem
                       • Lagre (default)  → updateModuleItem
                    */}
                    <form
                      action={updateModuleItem}
                      className="group flex items-center gap-2 px-4 py-2"
                    >
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="current_required" value={item.is_required ? "1" : "0"} />

                      {/* Required / optional badge */}
                      <button
                        type="submit"
                        formAction={toggleItemRequired}
                        formNoValidate
                        title={
                          item.is_required
                            ? "Obligatorisk – klikk for å gjøre valgfri"
                            : "Valgfri – klikk for å gjøre obligatorisk"
                        }
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                          item.is_required
                            ? "bg-foreground text-background hover:bg-foreground/75"
                            : "border border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {item.is_required ? "⚠ OBL." : "Valg"}
                      </button>

                      {/* Editable text — always in an input, styled borderless until focused */}
                      <input
                        name="text"
                        defaultValue={item.text}
                        required
                        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition-colors hover:border-input focus:border-input focus-visible:ring-2 focus-visible:ring-ring"
                      />

                      {/* Save — visible only when form has focus (CSS group-focus-within) */}
                      <button
                        type="submit"
                        className="h-7 shrink-0 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-focus-within:opacity-100"
                      >
                        Lagre
                      </button>

                      {/* Delete */}
                      <button
                        type="submit"
                        formAction={deleteModuleItem}
                        formNoValidate
                        title="Slett punkt"
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/30 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            {/* Add item row */}
            <div className="border-t border-border/50 bg-muted/10 px-4 py-3">
              <form action={addModuleItem} className="flex items-center gap-2">
                <input type="hidden" name="module_id" value={mod.id} />
                <input type="hidden" name="template_id" value={activeTemplate.id} />
                <Plus className="size-4 shrink-0 text-muted-foreground/40" />
                <input
                  name="text"
                  required
                  autoComplete="off"
                  placeholder="Legg til sjekkpunkt…"
                  className={`${fieldCls} py-1.5`}
                />
                <label className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    name="is_required"
                    value="1"
                    className="size-3.5 accent-foreground"
                  />
                  OBL.
                </label>
                <SubmitButton variant="outline" className="h-8 shrink-0 px-3 text-xs">
                  Legg til
                </SubmitButton>
              </form>
            </div>
          </div>
        );
      })}

      {/* ── Add new section ── */}
      {activeTemplate && (
        <div className="rounded-xl border border-dashed border-border px-4 py-4">
          <form action={createModule} className="flex items-center gap-2">
            <input type="hidden" name="template_id" value={activeTemplate.id} />
            <Plus className="size-4 shrink-0 text-muted-foreground/40" />
            <input
              name="name"
              required
              autoComplete="off"
              placeholder='Ny seksjon i mal, f.eks. "Forberedelser"'
              className={`${fieldCls} py-1.5`}
            />
            <SubmitButton className="h-8 shrink-0 px-4 text-sm">
              Ny seksjon i mal
            </SubmitButton>
          </form>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">OBL.</span> = obligatorisk — må krysses av
        før risikovurderingen kan markeres fullført.{" "}
        <span className="font-semibold text-foreground">Valg</span> = valgfri — kan merkes N/A.
      </p>
    </div>
  );
}
