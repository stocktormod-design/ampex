import { redirect } from "next/navigation";
import { PaintWorkbench } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-workbench";
import type {
  CompanyMember,
  DrawingActivityEntry,
  PublishedOverlay,
} from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";
import type { DrawingTaskRow } from "@/app/dashboard/projects/drawing-tasks-actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const adminClient = createAdminClient();
  const [overlaysResult, profileResult, membersResult, tasksResult, activityResult] = await Promise.all([
    supabase
      .from("drawing_overlays")
      .select("id, drawing_id, created_by, tool_type, layer_name, layer_color, payload, visible_to_user_ids")
      .eq("drawing_id", drawing.id)
      .eq("is_published", true)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle(),
    adminClient.from("profiles").select("id, full_name, company_id").order("full_name", { ascending: true }),
    supabase
      .from("drawing_tasks")
      .select("id, drawing_id, title, description, sort_order, completed_at, created_by, created_at, updated_at")
      .eq("drawing_id", drawing.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("drawing_activity_log")
      .select("id, drawing_id, actor_id, action, overlay_id, tool_type, summary, meta, created_at")
      .eq("drawing_id", drawing.id)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const { data: overlaysData } = overlaysResult;
  const companyId = (profileResult.data as { company_id: string | null } | null)?.company_id ?? null;

  const allMembers = ((membersResult.data ?? []) as { id: string; full_name: string | null; company_id?: string | null }[]);
  const companyMembers: CompanyMember[] = companyId
    ? allMembers
        .filter((m) => (m as { company_id?: string | null }).company_id === companyId)
        .map((m) => ({ id: m.id, fullName: m.full_name }))
    : [];

  const initialTasks = ((tasksResult.data ?? []) as DrawingTaskRow[]) ?? [];

  type ActivityDbRow = {
    id: string;
    drawing_id: string;
    actor_id: string | null;
    action: string;
    overlay_id: string | null;
    tool_type: string | null;
    summary: string;
    meta: unknown;
    created_at: string;
  };
  const activityRows = (activityResult.data ?? []) as ActivityDbRow[];
  const actorIds = Array.from(
    new Set(activityRows.map((r) => r.actor_id).filter((x): x is string => Boolean(x))),
  );
  let actorNameById: Record<string, string | null> = {};
  if (actorIds.length > 0) {
    const { data: actorProfiles } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    actorNameById = Object.fromEntries((actorProfiles ?? []).map((a) => [a.id, a.full_name as string | null]));
  }
  const initialActivity: DrawingActivityEntry[] = activityRows.map((r) => ({
    id: r.id,
    drawingId: r.drawing_id,
    actorId: r.actor_id ?? "",
    actorName: r.actor_id ? (actorNameById[r.actor_id] ?? null) : null,
    action: r.action as DrawingActivityEntry["action"],
    overlayId: r.overlay_id,
    toolType: r.tool_type,
    summary: r.summary,
    meta: (r.meta && typeof r.meta === "object" ? r.meta : {}) as DrawingActivityEntry["meta"],
    createdAt: r.created_at,
  }));

  const initialPublished = ((overlaysData ?? []) as {
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
    <main className="h-full">
      <PaintWorkbench
        projectId={project.id}
        projectName={project.name}
        fileUrl={signed.signedUrl}
        filePath={drawing.file_path}
        drawingName={drawing.name}
        drawingId={drawing.id}
        currentUserId={user.id}
        initialPublished={initialPublished}
        initialTasks={initialTasks}
        initialActivity={initialActivity}
        companyMembers={companyMembers}
      />
    </main>
  );
}
