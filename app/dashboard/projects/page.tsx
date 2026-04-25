import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ChevronRight, FolderKanban } from "lucide-react";
import { createProject } from "@/app/dashboard/projects/actions";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

type ProjectsPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    new?: string;
    error?: string;
  };
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  planning:  "Planlegging",
  active:    "Aktiv",
  completed: "Ferdig",
};

const STATUS_COLOR: Record<string, string> = {
  planning:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  active:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
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

  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at, drawings(count)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });
  const projects = (projectsData ?? []).map((p) => {
    const raw = p as typeof p & { drawings?: { count: number }[] };
    return {
      ...raw,
      drawingCount: raw.drawings?.[0]?.count ?? 0,
    };
  }) as (ProjectRow & { drawingCount: number })[];

  const q            = searchParams?.q?.trim().toLowerCase() ?? "";
  const statusFilter = searchParams?.status ?? "all";
  const showForm     = searchParams?.new === "1";
  const canManage    = isAdminRole(profile.role);

  const filtered = (projects as (ProjectRow & { drawingCount: number })[]).filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Prosjekter</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {projects.length} prosjekt{projects.length === 1 ? "" : "er"}
          </p>
        </div>
        {canManage && (
          <Link
            href={showForm ? "/dashboard/projects" : "/dashboard/projects?new=1"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
            Nytt
          </Link>
        )}
      </div>

      {/* ── Error feedback ── */}
      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}

      {/* ── Create form (collapsible) ── */}
      {canManage && showForm && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Nytt prosjekt</h2>
          <form action={createProject} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <NativeLabel htmlFor="name">Prosjektnavn *</NativeLabel>
                <NativeInput
                  id="name"
                  name="name"
                  required
                  placeholder="Sykehjem Nordfløy"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="status">Status</NativeLabel>
                <select
                  id="status"
                  name="status"
                  defaultValue="planning"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="planning">Planlegging</option>
                  <option value="active">Aktiv</option>
                  <option value="completed">Ferdig</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="description">Beskrivelse</NativeLabel>
              <textarea
                id="description"
                name="description"
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Kort beskrivelse (valgfritt)"
              />
            </div>
            <div className="flex items-center gap-3">
              <SubmitButton>Opprett prosjekt</SubmitButton>
              <Link
                href="/dashboard/projects"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Avbryt
              </Link>
            </div>
          </form>
        </div>
      )}

      {/* ── Search + filter ── */}
      <form
        method="get"
        className="flex flex-wrap gap-2"
      >
        {showForm && <input type="hidden" name="new" value="1" />}
        <NativeInput
          name="q"
          defaultValue={searchParams?.q ?? ""}
          placeholder="Søk i prosjekter..."
          className="flex-1 min-w-[160px]"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Alle statuser</option>
          <option value="planning">Planlegging</option>
          <option value="active">Aktiv</option>
          <option value="completed">Ferdig</option>
        </select>
        <SubmitButton variant="outline" className="shrink-0">Søk</SubmitButton>
      </form>

      {/* ── Project list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-16 text-center">
          <FolderKanban className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">
            {q || statusFilter !== "all" ? "Ingen prosjekter matcher søket." : "Ingen prosjekter ennå."}
          </p>
          {canManage && !showForm && (
            <Link
              href="/dashboard/projects?new=1"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              <Plus className="size-3.5" />
              Opprett det første
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {filtered.map((project) => (
            <li key={project.id}>
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{project.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {project.description ? (
                      <span className="truncate">{project.description}</span>
                    ) : null}
                    {project.drawingCount > 0 && (
                      <span className={project.description ? "ml-2" : ""}>
                        {project.drawingCount} tegning{project.drawingCount === 1 ? "" : "er"}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_COLOR[project.status] ?? STATUS_COLOR.planning
                  }`}
                >
                  {STATUS_LABEL[project.status] ?? project.status}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
