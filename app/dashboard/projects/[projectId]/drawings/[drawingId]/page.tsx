import Link from "next/link";
import { redirect } from "next/navigation";
import { PaintCanvas } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-canvas";
import { PaintToolbar } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-toolbar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string; drawingId: string }> | { projectId: string; drawingId: string };
};

type ProjectRow = {
  id: string;
  name: string;
};

type DrawingRow = {
  id: string;
  name: string;
  revision: string | null;
  file_path: string;
  is_published: boolean;
};

export default async function DrawingPaintViewPage({ params }: PageProps) {
  const { projectId, drawingId } = params instanceof Promise ? await params : params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  const project = projectData as ProjectRow | null;
  if (!project) {
    redirect("/dashboard/projects");
  }

  const { data: drawingData } = await supabase
    .from("drawings")
    .select("id, name, revision, file_path, is_published")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .maybeSingle();
  const drawing = drawingData as DrawingRow | null;
  if (!drawing) {
    redirect(`/dashboard/projects/${projectId}`);
  }

  const { data: signed } = await supabase.storage.from("drawings").createSignedUrl(drawing.file_path, 60 * 30);
  if (!signed?.signedUrl) {
    redirect(`/dashboard/projects/${projectId}?error=Kunne+ikke+laste+tegning`);
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Tilbake til tegningsliste
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Paint view · {project.name}
            {drawing.revision?.trim() ? ` · Rev ${drawing.revision}` : ""}
          </h1>
        </div>
        <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
          {drawing.is_published ? "Publisert" : "Utkast"}
        </span>
      </div>

      <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-lg border bg-background lg:flex-row">
        <PaintCanvas fileUrl={signed.signedUrl} filePath={drawing.file_path} drawingName={drawing.name} />
        <PaintToolbar />
      </div>
    </main>
  );
}
