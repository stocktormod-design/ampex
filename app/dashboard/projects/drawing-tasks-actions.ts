"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DrawingTaskRow = {
  id: string;
  drawing_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function drawingEditorPath(projectId: string, drawingId: string) {
  return `/dashboard/projects/${projectId}/drawings/${drawingId}`;
}

export async function createDrawingTask(
  projectId: string,
  drawingId: string,
  title: string,
  description?: string | null,
): Promise<{ ok: true; task: DrawingTaskRow } | { ok: false; error: string }> {
  const t = title.trim();
  if (!t) return { ok: false, error: "Tittel kan ikke være tom" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: maxRow } = await supabase
    .from("drawing_tasks")
    .select("sort_order")
    .eq("drawing_id", drawingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("drawing_tasks")
    .insert({
      drawing_id: drawingId,
      title: t,
      description: description?.trim() || null,
      sort_order: nextOrder,
      created_by: user.id,
    })
    .select("id, drawing_id, title, description, sort_order, completed_at, created_by, created_at, updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Kunne ikke opprette oppgave" };
  }
  revalidatePath(drawingEditorPath(projectId, drawingId));
  return { ok: true, task: data as DrawingTaskRow };
}

export async function setDrawingTaskCompleted(
  projectId: string,
  drawingId: string,
  taskId: string,
  completed: boolean,
): Promise<{ ok: true; task: DrawingTaskRow } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drawing_tasks")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("drawing_id", drawingId)
    .select("id, drawing_id, title, description, sort_order, completed_at, created_by, created_at, updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Kunne ikke oppdatere oppgave" };
  }
  revalidatePath(drawingEditorPath(projectId, drawingId));
  return { ok: true, task: data as DrawingTaskRow };
}

export async function deleteDrawingTask(
  projectId: string,
  drawingId: string,
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("drawing_tasks").delete().eq("id", taskId).eq("drawing_id", drawingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(drawingEditorPath(projectId, drawingId));
  return { ok: true };
}
