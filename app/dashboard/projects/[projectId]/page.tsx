import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Pencil, FileText, Eye, ChevronLeft, Send, Archive, ArchiveRestore } from "lucide-react";
import {
  archiveDrawing,
  convertProjectImagesToPdf,
  deleteDraftDrawing,
  publishDrawing,
  setProjectBlueprintAccess,
  unarchiveDrawing,
  updateProjectStatus,
  uploadDrawingPdf,
} from "@/app/dashboard/projects/actions";
import { DrawingFireReportMenu } from "@/app/dashboard/projects/[projectId]/drawing-fire-report-menu";
import { DrawingRevisionGroup } from "@/app/dashboard/projects/[projectId]/drawing-revision-group";
import { DrawingSettingsDialog } from "@/app/dashboard/projects/[projectId]/drawing-settings-dialog";
import { DrawingSearchFilterForm } from "@/app/dashboard/projects/[projectId]/drawing-search-filter-form";
import { UploadVisibilityPicker } from "@/app/dashboard/projects/[projectId]/upload-visibility-picker";
import { ProjectEditHeader } from "@/app/dashboard/projects/[projectId]/project-edit-header";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, roleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }> | { projectId: string };
  searchParams?: {
    q?: string;
    disc?: string;
    new?: string;
    error?: string;
    success?: string;
  };
};

type DrawingRow = {
  id: string;
  name: string;
  revision: string | null;
  file_path: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  drawing_status: string;
  pipeline: string;
  is_archived: boolean;
  revision_group_id: string | null;
  disciplines: string[];
  visible_to_user_ids: string[] | null;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  planning: "Planlegging",
  active: "Aktiv",
  completed: "Ferdig",
};

const STATUS_COLOR: Record<string, string> = {
  planning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const DISCIPLINE_OPTIONS = [
  { id: "fire", label: "Brann" },
  { id: "power", label: "Sterkstrøm" },
  { id: "low_voltage", label: "Svakstrøm" },
] as const;

const DISCIPLINE_STYLE: Record<string, string> = {
  fire: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  power: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  low_voltage: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function DisciplineChip({ id }: { id: string }) {
  const opt = DISCIPLINE_OPTIONS.find((o) => o.id === id);
  if (!opt) return null;
  const style = DISCIPLINE_STYLE[id] ?? "";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}>
      {opt.label}
    </span>
  );
}

/** Grupper offisielle tegninger som revisjoner av samme plan (nyeste først i hver gruppe). */
function groupOfficialByRevision(official: DrawingRow[]): { head: DrawingRow; older: DrawingRow[] }[] {
  const byKey = new Map<string, DrawingRow[]>();
  for (const d of official) {
    const key = d.revision_group_id ?? `__name__${d.name.toLowerCase().trim()}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(d);
  }
  const groups: { head: DrawingRow; older: DrawingRow[] }[] = [];
  for (const [, list] of Array.from(byKey.entries())) {
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.published_at ?? a.created_at).getTime();
      const tb = new Date(b.published_at ?? b.created_at).getTime();
      return tb - ta;
    });
    const head = sorted[0];
    if (head) groups.push({ head, older: sorted.slice(1) });
  }
  groups.sort((a, b) => {
    const ta = new Date(a.head.published_at ?? a.head.created_at).getTime();
    const tb = new Date(b.head.published_at ?? b.head.created_at).getTime();
    return tb - ta;
  });
  return groups;
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { projectId } = params instanceof Promise ? await params : params;
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

  const isAdmin = isAdminRole(profile.role);

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at")
    .eq("id", projectId)
    .maybeSingle();
  const project = projectData as ProjectRow | null;
  if (!project) redirect("/dashboard/projects");

  const [drawingsRes, blueprintProfilesRes, blueprintAccessRes, blockedRpc] = await Promise.all([
    supabase
      .from("drawings")
      .select(
        "id, name, revision, file_path, is_published, published_at, created_at, drawing_status, pipeline, is_archived, revision_group_id, disciplines, visible_to_user_ids",
      )
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    isAdmin
      ? supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("company_id", profile.company_id)
          .order("full_name", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; role: string }[] }),
    isAdmin
      ? supabase.from("project_blueprint_access").select("user_id").eq("project_id", projectId)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    !isAdmin
      ? supabase.rpc("is_blueprint_access_blocked", { target_project_id: projectId })
      : Promise.resolve({ data: false }),
  ]);

  const drawings = (drawingsRes.data ?? []) as DrawingRow[];
  const companyProfiles = (blueprintProfilesRes.data ?? []) as { id: string; full_name: string | null; role: string }[];
  const blueprintAllowedIds = new Set((blueprintAccessRes.data ?? []).map((r) => r.user_id));
  const blueprintAccessBlocked = blockedRpc.data === true;

  const q    = searchParams?.q?.trim().toLowerCase() ?? "";
  const disc = searchParams?.disc?.trim() ?? "";
  const showUpload = searchParams?.new === "1" && isAdmin;

  function matchesFilter(row: DrawingRow): boolean {
    if (disc && (!row.disciplines || !row.disciplines.includes(disc))) return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      (row.revision?.toLowerCase().includes(q) ?? false)
    );
  }

  const official         = drawings.filter((d) => d.pipeline === "official" && !d.is_archived && matchesFilter(d));
  const drafts           = drawings.filter((d) => d.pipeline === "draft"    && !d.is_archived && matchesFilter(d));
  const archivedOfficial = drawings.filter((d) => d.is_archived && d.pipeline === "official"  && matchesFilter(d));
  const archivedDraft    = drawings.filter((d) => d.is_archived && d.pipeline === "draft"     && matchesFilter(d));

  const revisionGroups = groupOfficialByRevision(official);

  const officialCount = drawings.filter((d) => d.pipeline === "official" && !d.is_archived).length;
  const draftCount    = drawings.filter((d) => d.pipeline === "draft"    && !d.is_archived).length;
  const archivedCount = drawings.filter((d) => d.is_archived).length;

  const uploadAction       = uploadDrawingPdf.bind(null, project.id);
  const updateStatusAction = updateProjectStatus;

  const successMsg = (() => {
    if (!searchParams?.success) return null;
    if (searchParams.success === "status-updated")   return "Status oppdatert.";
    if (searchParams.success === "project-updated")  return "Prosjekt oppdatert.";
    if (searchParams.success === "upload-ok")        return "Tegning lastet opp som utkast. Publiser den for å gjøre den synlig.";
    if (searchParams.success === "published")        return "Tegning publisert.";
    if (searchParams.success === "unpublished")      return "Tegning satt tilbake til utkast.";
    if (searchParams.success === "draft-deleted")    return "Utkast slettet.";
    if (searchParams.success === "archived")                return "Tegning arkivert.";
    if (searchParams.success === "unarchived-official")    return "Tegning gjenopprettet som offisiell.";
    if (searchParams.success === "unarchived-draft")       return "Tegning gjenopprettet som utkast.";
    if (searchParams.success === "blueprint-access") return "Tegningstilgang er oppdatert.";
    if (searchParams.success === "drawing-settings") return "Tegningsinnstillinger er lagret.";
    if (searchParams.success.startsWith("converted-")) {
      return `Konverterte ${searchParams.success.replace("converted-", "")} filer til PDF.`;
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb + header ── */}
      <div>
        <Link
          href="/dashboard/projects"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Prosjekter
        </Link>
        {isAdmin ? (
          <ProjectEditHeader
            projectId={project.id}
            name={project.name}
            description={project.description}
            statusBadge={
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_COLOR[project.status] ?? STATUS_COLOR.planning
                }`}
              >
                {STATUS_LABEL[project.status] ?? project.status}
              </span>
            }
            meta={
              <p className="text-xs text-muted-foreground">
                Opprettet {fmtDate(project.created_at)}
                {drawings.length > 0 && (
                  <>
                    {" · "}
                    {officialCount} offisiell{draftCount > 0 ? `, ${draftCount} utkast` : ""}
                    {archivedCount > 0 ? `, ${archivedCount} arkivert` : ""}
                  </>
                )}
              </p>
            }
            actionButton={
              <Link
                href={showUpload ? `/dashboard/projects/${projectId}` : `/dashboard/projects/${projectId}?new=1`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
              >
                <Plus className="size-4" aria-hidden />
                Last opp
              </Link>
            }
          />
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_COLOR[project.status] ?? STATUS_COLOR.planning
                  }`}
                >
                  {STATUS_LABEL[project.status] ?? project.status}
                </span>
              </div>
              {project.description && (
                <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Opprettet {fmtDate(project.created_at)}
                {drawings.length > 0 && (
                  <> · {officialCount} offisiell</>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tegningstilgang (admin) ── */}
      {isAdmin && companyProfiles.length > 0 && (
        <details className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <summary className="cursor-pointer list-none text-base font-semibold">
            Tegningstilgang
            <span className="ml-2 text-xs font-normal text-muted-foreground">(klikk for å utvide)</span>
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">
            Velg hvilke brukere som får se <span className="font-medium text-foreground">offisielle</span> tegninger på
            dette prosjektet. Administratorer ser alltid alt. La alle bokser stå <span className="font-medium text-foreground">av</span> for å
            tillate alle som allerede har prosjekttilgang.
          </p>
          <form action={setProjectBlueprintAccess} className="mt-4 space-y-3">
            <input type="hidden" name="project_id" value={project.id} />
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
              {companyProfiles.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="blueprint_user_id"
                      value={p.id}
                      defaultChecked={blueprintAllowedIds.has(p.id)}
                      className="size-4 rounded border-input"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{p.full_name?.trim() || "Uten navn"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{roleLabel(p.role)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <SubmitButton variant="outline">Lagre tegningstilgang</SubmitButton>
          </form>
        </details>
      )}

      {/* ── Status change (admin) ── */}
      {isAdmin && (
        <form action={updateStatusAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="project_id" value={project.id} />
          <span className="text-xs font-medium text-muted-foreground">Endre status:</span>
          {(["planning", "active", "completed"] as const).map((s) => (
            <button
              key={s}
              type="submit"
              name="status"
              value={s}
              disabled={project.status === s}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                project.status === s
                  ? `${STATUS_COLOR[s]} opacity-60 cursor-default`
                  : "border border-border bg-background hover:bg-muted"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </form>
      )}

      {/* ── Feedback ── */}
      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}
      {successMsg && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {successMsg}
        </p>
      )}

      {/* ── Upload form (collapsible) ── */}
      {showUpload && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Last opp tegning</h2>
          <form action={uploadAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <NativeLabel htmlFor="drawing-name">Navn</NativeLabel>
                <NativeInput
                  id="drawing-name"
                  name="name"
                  placeholder="A1 Plan 1. etasje"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="drawing-revision">Revisjon</NativeLabel>
                <NativeInput id="drawing-revision" name="revision" placeholder="Rev B" autoComplete="off" />
              </div>
            </div>

            {/* Disciplines */}
            <div className="space-y-2">
              <NativeLabel>Fagområde (valgfritt, flere kan velges)</NativeLabel>
              <div className="flex flex-wrap gap-3">
                {DISCIPLINE_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="disciplines"
                      value={opt.id}
                      className="size-4 rounded border-input"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <NativeLabel htmlFor="pdf-file">Fil (PDF, JPEG eller PNG — maks 25 MB)</NativeLabel>
              <input
                id="pdf-file"
                name="pdf_file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                required
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>

            {companyProfiles.length > 1 && (
              <UploadVisibilityPicker
                members={companyProfiles.map((p) => ({ id: p.id, fullName: p.full_name }))}
              />
            )}

            <div className="flex items-center gap-3">
              <SubmitButton>Last opp som utkast</SubmitButton>
              <Link
                href={`/dashboard/projects/${projectId}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Avbryt
              </Link>
            </div>
          </form>

          {/* Image conversion utility */}
          <form action={convertProjectImagesToPdf} className="mt-4 border-t pt-4">
            <input type="hidden" name="project_id" value={project.id} />
            <button
              type="submit"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Konverter alle JPG/PNG i prosjektet til PDF
            </button>
          </form>
        </div>
      )}

      {/* ── Search + discipline filter (fagområde sender skjema automatisk) ── */}
      {(drawings.length > 0 || q || disc) && (
        <DrawingSearchFilterForm
          key={`${disc}-${searchParams?.q ?? ""}-${showUpload ? "1" : "0"}`}
          showUpload={showUpload}
          defaultQ={searchParams?.q ?? ""}
          defaultDisc={disc}
          disciplineOptions={DISCIPLINE_OPTIONS}
        />
      )}

      {/* ── Empty state ── */}
      {drawings.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-16 text-center">
          <FileText className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">
            {blueprintAccessBlocked
              ? "Du har ikke tilgang til tegninger på dette prosjektet. Be en administrator legge deg til under «Tegningstilgang»."
              : "Ingen tegninger ennå."}
          </p>
          {isAdmin && !showUpload && (
            <Link
              href={`/dashboard/projects/${projectId}?new=1`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              <Plus className="size-3.5" />
              Last opp en tegning
            </Link>
          )}
        </div>
      )}

      {/* ── Official revisions (gruppert: nyeste rad + eldre under pil) ── */}
      {(drawings.length > 0 || q || disc) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Gjeldende revisjoner
            </h2>
            {revisionGroups.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {revisionGroups.length}
              </span>
            )}
          </div>
          {revisionGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {q || disc ? "Ingen treff." : "Ingen offisielle revisjoner ennå."}
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {revisionGroups.map(({ head, older }) => (
                <DrawingRevisionGroup
                  key={head.id}
                  projectId={project.id}
                  head={head}
                  older={older}
                  isAdmin={isAdmin}
                  showCurrentBadge={older.length > 0}
                  disciplineChips={(row) => (row.disciplines ?? []).map((d) => <DisciplineChip key={`${row.id}-${d}`} id={d} />)}
                  headActions={
                    <>
                      <Link
                        href={`/dashboard/projects/${project.id}/drawings/${head.id}`}
                        title="Åpne i editor"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        <span className="hidden sm:inline">Editor</span>
                      </Link>
                      <Link
                        href={`/dashboard/projects/${project.id}/drawings/${head.id}/view`}
                        title="Vis tegning"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        <Eye className="size-3.5" aria-hidden />
                        <span className="hidden sm:inline">Vis</span>
                      </Link>
                      {head.disciplines?.includes("fire") ? (
                        <DrawingFireReportMenu projectId={project.id} drawingId={head.id} />
                      ) : null}
                      {isAdmin ? (
                        <DrawingSettingsDialog
                          projectId={project.id}
                          drawingId={head.id}
                          drawingName={head.name}
                          members={companyProfiles.map((p) => ({ id: p.id, fullName: p.full_name }))}
                          initialDisciplines={head.disciplines ?? []}
                          initialVisibleToUserIds={head.visible_to_user_ids ?? null}
                        />
                      ) : null}
                      {isAdmin ? (
                        <form action={archiveDrawing}>
                          <input type="hidden" name="drawing_id" value={head.id} />
                          <button
                            type="submit"
                            title="Arkiver tegning"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Archive className="size-3.5" aria-hidden />
                            <span className="hidden sm:inline">Arkiver</span>
                          </button>
                        </form>
                      ) : null}
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Drafts section (admin only) ── */}
      {isAdmin && drawings.some((d) => d.pipeline === "draft" && !d.is_archived) && (
        <DrawingSection
          title="Utkast"
          titleNote="Ikke synlig for montører"
          drawings={drafts}
          emptyMessage={q || disc ? "Ingen utkast matcher søket." : ""}
          renderActions={(row) => (
            <>
              <form action={publishDrawing}>
                <input type="hidden" name="drawing_id" value={row.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Send className="size-3.5" aria-hidden />
                  <span>Publiser</span>
                </button>
              </form>
              <Link
                href={`/dashboard/projects/${project.id}/drawings/${row.id}`}
                title="Åpne i editor"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Pencil className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Editor</span>
              </Link>
              {isAdmin ? (
                <DrawingSettingsDialog
                  projectId={project.id}
                  drawingId={row.id}
                  drawingName={row.name}
                  members={companyProfiles.map((p) => ({ id: p.id, fullName: p.full_name }))}
                  initialDisciplines={row.disciplines ?? []}
                  initialVisibleToUserIds={row.visible_to_user_ids ?? null}
                />
              ) : null}
              {row.disciplines?.includes("fire") ? (
                <DrawingFireReportMenu projectId={project.id} drawingId={row.id} />
              ) : null}
              <form action={deleteDraftDrawing}>
                <input type="hidden" name="drawing_id" value={row.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-destructive/30 bg-background px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  Slett
                </button>
              </form>
            </>
          )}
          renderBadge={() => null}
        />
      )}

      {/* ── Archived section (admin only, collapsed) ── */}
      {isAdmin && drawings.some((d) => d.is_archived) && (
        <details className="rounded-xl border border-border bg-card shadow-sm">
          <summary className="cursor-pointer list-none px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Arkivert</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {archivedCount}
              </span>
              <span className="text-xs text-muted-foreground">(klikk for å utvide)</span>
            </div>
          </summary>
          <div className="border-t border-border divide-y divide-border">
            {/* Subsection A: Official archived */}
            {(archivedOfficial.length > 0 || (q || disc) && drawings.some((d) => d.is_archived && d.pipeline === "official")) && (
              <div className="px-5 py-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Offisielle (arkiverte revisjoner)
                </p>
                {archivedOfficial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen arkiverte offisielle tegninger matcher søket.</p>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                    {archivedOfficial.map((row) => (
                      <DrawingListItem
                        key={row.id}
                        row={row}
                        badge={null}
                        actions={
                          <ArchivedActions row={row} projectId={project.id} />
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
            {/* Subsection B: Draft archived */}
            {(archivedDraft.length > 0 || (q || disc) && drawings.some((d) => d.is_archived && d.pipeline === "draft")) && (
              <div className="px-5 py-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Utkast (arkiverte)
                </p>
                {archivedDraft.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen arkiverte utkast matcher søket.</p>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                    {archivedDraft.map((row) => (
                      <DrawingListItem
                        key={row.id}
                        row={row}
                        badge={null}
                        actions={
                          <ArchivedActions row={row} projectId={project.id} />
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
            {archivedOfficial.length === 0 && archivedDraft.length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Ingen arkiverte tegninger matcher søket.</p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function ArchivedActions({ row, projectId }: { row: DrawingRow; projectId: string }) {
  return (
    <>
      <form action={unarchiveDrawing}>
        <input type="hidden" name="drawing_id" value={row.id} />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          <ArchiveRestore className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Gjenopprett</span>
        </button>
      </form>
      <Link
        href={`/dashboard/projects/${projectId}/drawings/${row.id}/view`}
        title="Vis tegning"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
      >
        <Eye className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Vis</span>
      </Link>
    </>
  );
}

function DrawingListItem({
  row,
  badge,
  actions,
}: {
  row: DrawingRow;
  badge: React.ReactNode;
  actions: React.ReactNode;
}) {
  function fmtDate(value: string | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }

  return (
    <li>
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium text-foreground">{row.name}</p>
            {badge}
            {(row.disciplines ?? []).map((d) => (
              <DisciplineChip key={d} id={d} />
            ))}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.revision ? `Rev. ${row.revision} · ` : ""}
            {fmtDate(row.created_at)}
            {row.pipeline === "official" && row.published_at && row.published_at !== row.created_at && (
              <> · Publisert {fmtDate(row.published_at)}</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      </div>
    </li>
  );
}

function DrawingSection({
  title,
  titleNote,
  drawings,
  emptyMessage,
  renderActions,
  renderBadge,
}: {
  title: string;
  titleNote?: string;
  drawings: DrawingRow[];
  emptyMessage: string;
  renderActions: (row: DrawingRow) => React.ReactNode;
  renderBadge: (row: DrawingRow) => React.ReactNode;
}) {
  if (drawings.length === 0 && !emptyMessage) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h2>
        {drawings.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {drawings.length}
          </span>
        )}
        {titleNote && (
          <span className="text-xs text-muted-foreground">· {titleNote}</span>
        )}
      </div>
      {drawings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {drawings.map((row) => (
            <DrawingListItem
              key={row.id}
              row={row}
              badge={renderBadge(row)}
              actions={renderActions(row)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
