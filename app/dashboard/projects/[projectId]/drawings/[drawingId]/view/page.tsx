import { redirect } from "next/navigation";
import { DrawingViewerCanvas } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/view/drawing-viewer-canvas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params:
    | Promise<{
        projectId: string;
        drawingId: string;
      }>
    | {
        projectId: string;
        drawingId: string;
      };
};

type ProjectRow = {
  id: string;
};

type DrawingRow = { id: string; name: string; file_path: string };

export default async function DrawingViewerPage({ params }: PageProps) {
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
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  const project = projectData as ProjectRow | null;
  if (!project) {
    redirect("/dashboard/projects");
  }

  const { data: drawingData } = await supabase
    .from("drawings")
    .select("id, name, file_path")
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
    <main className="h-[calc(100dvh-3.8rem)] p-2 sm:p-3">
      <section className="h-full min-h-[420px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 sm:min-h-[520px]">
        <DrawingViewerCanvas fileUrl={signed.signedUrl} filePath={drawing.file_path} drawingName={drawing.name} />
      </section>
    </main>
  );
}
