import { redirect } from "next/navigation";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NativeInput } from "@/components/ui/native-input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createModule,
  updateModuleName,
  deleteModule,
  addModuleItem,
  toggleItemRequired,
  deleteModuleItem,
} from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { error?: string; success?: string };
};

type ModuleItem = {
  id: string;
  text: string;
  is_required: boolean;
  sort_order: number;
};

type Module = {
  id: string;
  name: string;
  sort_order: number;
  risk_assessment_module_items: ModuleItem[];
};

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

  const { data: modulesData } = await supabase
    .from("risk_assessment_modules")
    .select("id, name, sort_order, risk_assessment_module_items(id, text, is_required, sort_order)")
    .eq("company_id", profile.company_id)
    .order("sort_order", { ascending: true });

  const modules = (modulesData ?? []) as Module[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Risikovurderingsmoduler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lag moduler med sjekkpunkter som brukes i risikovurderingen på ordre.
          </p>
        </div>
      </div>

      {searchParams?.error && (
        <Alert variant="destructive">
          <AlertDescription>{searchParams.error}</AlertDescription>
        </Alert>
      )}

      {/* Add module form */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Legg til ny modul</h2>
        <form action={createModule} className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="new-module-name">
              Modulnavn
            </label>
            <NativeInput
              id="new-module-name"
              name="name"
              placeholder='F.eks. "Forberedelser" eller "Brannsikkerhet"'
              required
              autoComplete="off"
            />
          </div>
          <SubmitButton>
            <Plus className="mr-1.5 size-4" />
            Legg til modul
          </SubmitButton>
        </form>
      </div>

      {/* Modules list */}
      {modules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <ClipboardList className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Ingen moduler ennå</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Opprett moduler med sjekkpunkter ovenfor. Disse vises i risikovurderingen på alle ordre.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((mod) => {
            const items = [...(mod.risk_assessment_module_items ?? [])].sort(
              (a, b) => a.sort_order - b.sort_order,
            );
            return (
              <div key={mod.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {/* Module header */}
                <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
                  <form action={updateModuleName} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="module_id" value={mod.id} />
                    <input
                      name="name"
                      defaultValue={mod.name}
                      required
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <SubmitButton variant="outline" className="h-8 px-3 text-xs">
                      Lagre
                    </SubmitButton>
                  </form>
                  <form action={deleteModule}>
                    <input type="hidden" name="module_id" value={mod.id} />
                    <button
                      type="submit"
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Slett modul"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>

                {/* Items list */}
                {items.length > 0 && (
                  <ul className="divide-y divide-border/60">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                        {/* Required toggle */}
                        <form action={toggleItemRequired} className="shrink-0 pt-0.5">
                          <input type="hidden" name="item_id" value={item.id} />
                          <input
                            type="hidden"
                            name="current_required"
                            value={item.is_required ? "1" : "0"}
                          />
                          <button
                            type="submit"
                            title={item.is_required ? "Klikk for å gjøre valgfri" : "Klikk for å gjøre obligatorisk"}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                              item.is_required
                                ? "bg-foreground text-background hover:bg-foreground/80"
                                : "border border-border bg-background text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {item.is_required ? "Obl." : "Valg."}
                          </button>
                        </form>
                        <span className="flex-1 text-sm leading-snug">{item.text}</span>
                        <form action={deleteModuleItem} className="shrink-0">
                          <input type="hidden" name="item_id" value={item.id} />
                          <button
                            type="submit"
                            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Slett punkt"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add item form */}
                <div className="border-t border-border/60 bg-muted/10 px-4 py-3">
                  <form action={addModuleItem} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="module_id" value={mod.id} />
                    <div className="flex-1 space-y-1" style={{ minWidth: "14rem" }}>
                      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Nytt sjekkpunkt
                      </label>
                      <NativeInput
                        name="text"
                        placeholder="Beskriv sjekkpunktet…"
                        required
                        autoComplete="off"
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 pb-1 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        name="is_required"
                        value="1"
                        className="size-4 rounded border-input accent-foreground"
                      />
                      Obligatorisk
                    </label>
                    <SubmitButton variant="outline" className="pb-1">
                      <Plus className="mr-1 size-3.5" />
                      Legg til
                    </SubmitButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Modulene vises automatisk i risikovurderingen på alle ordre. Obligatoriske sjekkpunkter må
        krysses av før risikovurderingen kan markeres som fullført.
      </p>
    </div>
  );
}
