import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { deleteDraftDrawing, publishDrawing, unpublishDrawing, uploadDrawingPdf } from "@/app/dashboard/projects/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    error?: string;
    success?: string;
  };
};

type ProfileRow = {
  company_id: string | null;
  role: string;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
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

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("nb-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { projectId } = params instanceof Promise ? await params : params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as ProfileRow | null;

  if (!profile?.company_id) {
    redirect("/onboarding");
  }

  const isAdmin = isAdminRole(profile.role);

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at")
    .eq("id", projectId)
    .maybeSingle();
  const project = projectData as ProjectRow | null;
  if (!project) {
    redirect("/dashboard/projects");
  }

  const { data: drawingsData } = await supabase
    .from("drawings")
    .select("id, name, revision, file_path, is_published, published_at, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false });
  const drawings = (drawingsData ?? []) as DrawingRow[];

  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const requestedView = (searchParams?.view ?? "all").trim();
  const view = isAdmin ? requestedView : "published";

  const visibleRows = drawings.filter((row) => {
    if (view === "draft" && row.is_published) return false;
    if (view === "published" && !row.is_published) return false;
    if (!isAdmin && !row.is_published) return false;
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      row.file_path.toLowerCase().includes(q) ||
      (row.revision?.toLowerCase().includes(q) ?? false)
    );
  });

  const signedUrlPairs = await Promise.all(
    visibleRows.map(async (row) => {
      const { data } = await supabase.storage.from("drawings").createSignedUrl(row.file_path, 60 * 30);
      return [row.id, data?.signedUrl ?? null] as const;
    }),
  );
  const signedUrlMap = new Map<string, string | null>(signedUrlPairs);

  const uploadAction = uploadDrawingPdf.bind(null, project.id);

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-2">
        <Link href="/dashboard/projects" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          ← Tilbake til prosjekter
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {project.description?.trim() || "Ingen beskrivelse"}
        </p>
      </div>

      {searchParams?.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.success ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Endringen ble lagret.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Last opp PDF-tegning</CardTitle>
            <CardDescription>
              {isAdmin ? "Ny tegning lagres som utkast til den publiseres." : "Kun admin kan laste opp tegninger."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <form action={uploadAction} className="space-y-4">
                <div className="space-y-2">
                  <NativeLabel htmlFor="drawing-name">Navn</NativeLabel>
                  <NativeInput id="drawing-name" name="name" placeholder="A1 Plan 1. etasje" autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <NativeLabel htmlFor="drawing-revision">Revisjon</NativeLabel>
                  <NativeInput id="drawing-revision" name="revision" placeholder="Rev B" autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <NativeLabel htmlFor="pdf-file">PDF-fil</NativeLabel>
                  <input
                    id="pdf-file"
                    name="pdf_file"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                  />
                  <p className="text-xs text-muted-foreground">Maks 25 MB.</p>
                </div>
                <SubmitButton className="w-full">Last opp utkast</SubmitButton>
              </form>
            ) : (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Du kan se publiserte tegninger og filtrere listen.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Tegninger</CardTitle>
            <CardDescription>{visibleRows.length} treff</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 sm:grid-cols-[1fr_170px_auto]" method="get">
              <NativeInput name="q" defaultValue={searchParams?.q ?? ""} placeholder="Søk i navn/revisjon..." />
              <select
                name="view"
                defaultValue={isAdmin ? requestedView : "published"}
                disabled={!isAdmin}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <option value="all">Alle</option>
                <option value="draft">Utkast</option>
                <option value="published">Publisert</option>
              </select>
              <SubmitButton variant="outline">Filtrer</SubmitButton>
            </form>

            {visibleRows.length === 0 ? (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                Ingen tegninger matcher filteret.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {visibleRows.map((row) => (
                  <li key={row.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.revision?.trim() ? `Revisjon ${row.revision}` : "Ingen revisjon"} · Opprettet{" "}
                          {fmtDate(row.created_at)}
                        </p>
                        {row.is_published ? (
                          <p className="text-xs text-muted-foreground">Publisert {fmtDate(row.published_at)}</p>
                        ) : (
                          <p className="text-xs text-amber-700">Utkast (ikke publisert)</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {signedUrlMap.get(row.id) ? (
                          <a
                            href={signedUrlMap.get(row.id) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
                          >
                            <FileText className="size-3.5" aria-hidden />
                            Åpne PDF
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Kunne ikke lage visningslenke</span>
                        )}

                        {isAdmin ? (
                          <>
                            <form action={publishDrawing}>
                              <input type="hidden" name="drawing_id" value={row.id} />
                              <button
                                type="submit"
                                disabled={row.is_published}
                                className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                              >
                                Publiser
                              </button>
                            </form>
                            <form action={unpublishDrawing}>
                              <input type="hidden" name="drawing_id" value={row.id} />
                              <button
                                type="submit"
                                disabled={!row.is_published}
                                className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
                              >
                                Avpubliser
                              </button>
                            </form>
                            <form action={deleteDraftDrawing}>
                              <input type="hidden" name="drawing_id" value={row.id} />
                              <button
                                type="submit"
                                disabled={row.is_published}
                                className="rounded-md border border-destructive/40 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              >
                                Slett utkast
                              </button>
                            </form>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
