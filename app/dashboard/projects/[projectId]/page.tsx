import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Pencil, FileText, Eye } from "lucide-react";
import {
  convertProjectImagesToPdf,
  deleteDraftDrawing,
  uploadDrawingPdf,
} from "@/app/dashboard/projects/actions";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }> | { projectId: string };
  searchParams?: {
    q?: string;
    view?: string;
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
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
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
    .select("id, name, description, status")
    .eq("id", projectId)
    .maybeSingle();
  const project = projectData as ProjectRow | null;
  if (!project) redirect("/dashboard/projects");

  const { data: drawingsData } = await supabase
    .from("drawings")
    .select("id, name, revision, file_path, is_published, published_at, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });
  const drawings = (drawingsData ?? []) as DrawingRow[];

  const q            = searchParams?.q?.trim().toLowerCase() ?? "";
  const requestedView = searchParams?.view ?? "all";
  const view         = isAdmin ? requestedView : "published";
  const showUpload   = searchParams?.new === "1" && isAdmin;

  const visible = drawings.filter((row) => {
    if (view === "draft"     && row.is_published)  return false;
    if (view === "published" && !row.is_published) return false;
    if (!isAdmin && !row.is_published)             return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      (row.revision?.toLowerCase().includes(q) ?? false)
    );
  });

  const uploadAction = uploadDrawingPdf.bind(null, project.id);

  return (
    <div className="space-y-6">
      {/* ── Back + header ── */}
      <div>
        <Link
          href="/dashboard/projects"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Prosjekter
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
            {project.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          {isAdmin && (
            <Link
              href={showUpload ? `/dashboard/projects/${projectId}` : `/dashboard/projects/${projectId}?new=1`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden />
              Last opp
            </Link>
          )}
        </div>
      </div>

      {/* ── Feedback ── */}
      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}
      {searchParams?.success && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {searchParams.success.startsWith("converted-")
            ? `Konverterte ${searchParams.success.replace("converted-", "")} filer til PDF.`
            : "Endringen ble lagret."}
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
            <div className="flex items-center gap-3">
              <SubmitButton>Last opp og publiser</SubmitButton>
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

      {/* ── Search + view filter (admin only) ── */}
      {(drawings.length > 0 || q) && (
        <form method="get" className="flex flex-wrap gap-2">
          {showUpload && <input type="hidden" name="new" value="1" />}
          <NativeInput
            name="q"
            defaultValue={searchParams?.q ?? ""}
            placeholder="Søk i tegninger..."
            className="flex-1 min-w-[160px]"
          />
          {isAdmin && (
            <select
              name="view"
              defaultValue={view}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Alle</option>
              <option value="published">Publisert</option>
              <option value="draft">Utkast</option>
            </select>
          )}
          <SubmitButton variant="outline" className="shrink-0">Søk</SubmitButton>
        </form>
      )}

      {/* ── Drawings list ── */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-16 text-center">
          <FileText className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">
            {q ? "Ingen tegninger matcher søket." : "Ingen tegninger ennå."}
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
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {visible.map((row) => (
            <li key={row.id}>
              <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{row.name}</p>
                    {!row.is_published && (
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Utkast
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.revision ? `Rev. ${row.revision} · ` : ""}
                    {fmtDate(row.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link
                    href={`/dashboard/projects/${project.id}/drawings/${row.id}`}
                    title="Åpne i editor"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Editor</span>
                  </Link>
                  <Link
                    href={`/dashboard/projects/${project.id}/drawings/${row.id}/view`}
                    title="Vis tegning"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <Eye className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Vis</span>
                  </Link>
                  {isAdmin && !row.is_published && (
                    <form action={deleteDraftDrawing}>
                      <input type="hidden" name="drawing_id" value={row.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-destructive/30 bg-background px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        Slett
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
