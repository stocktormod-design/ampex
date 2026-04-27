import { redirect } from "next/navigation";
import { DrawingViewerCanvas } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/view/drawing-viewer-canvas";
import type { PublishedOverlay } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";
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

type ProjectRow = { id: string };
type DrawingRow = { id: string; name: string; file_path: string };

export default async function DrawingViewerPage({ params }: PageProps) {
  const { projectId, drawingId } = params instanceof Promise ? await params : params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: projectData } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  const project = projectData as ProjectRow | null;
  if (!project) redirect("/dashboard/projects");

  const { data: drawingData } = await supabase
    .from("drawings")
    .select("id, name, file_path")
    .eq("id", drawingId)
    .eq("project_id", projectId)
    .maybeSingle();
  const drawing = drawingData as DrawingRow | null;
  if (!drawing) redirect(`/dashboard/projects/${projectId}`);

  const [signedRes, overlaysRes] = await Promise.all([
    supabase.storage.from("drawings").createSignedUrl(drawing.file_path, 60 * 30),
    supabase
      .from("drawing_overlays")
      .select("id, drawing_id, created_by, tool_type, layer_name, layer_color, payload, visible_to_user_ids")
      .eq("drawing_id", drawing.id)
      .eq("is_published", true)
      .order("created_at", { ascending: true }),
  ]);

  if (!signedRes.data?.signedUrl) {
    redirect(`/dashboard/projects/${projectId}?error=Kunne+ikke+laste+tegning`);
  }

  const overlays: PublishedOverlay[] = ((overlaysRes.data ?? []) as {
    id: string;
    drawing_id: string;
    created_by: string;
    tool_type: "detector" | "point" | "line" | "rect" | "text";
    layer_name: string;
    layer_color: string;
    payload: unknown;
    visible_to_user_ids: string[] | null;
  }[]).map((row) => ({
    id: row.id,
    drawingId: row.drawing_id,
    createdBy: row.created_by,
    toolType: row.tool_type,
    layerName: row.layer_name,
    layerColor: row.layer_color,
    payload: row.payload as PublishedOverlay["payload"],
    visibleToUserIds: row.visible_to_user_ids,
  }));

  return (
    <main className="h-full p-2 sm:p-3">
      <section className="h-full min-h-[420px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 sm:min-h-[520px]">
        <DrawingViewerCanvas
          fileUrl={signedRes.data.signedUrl}
          filePath={drawing.file_path}
          drawingName={drawing.name}
          overlays={overlays}
        />
      </section>
    </main>
  );
}
