"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const PROJECT_STATUS = new Set(["planning", "active", "completed"]);
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png"]);
const OVERLAY_TOOL_TYPES = new Set(["detector", "point", "line", "rect", "text"]);
const OVERLAY_VISIBILITY = new Set(["all", "admins"]);
const MAX_OVERLAY_PHOTO_BYTES = 2 * 1024 * 1024;

type CompanyProfile = {
  company_id: string | null;
  role: string;
};

type AdminContext = {
  userId: string;
  companyId: string;
  adminClient: ReturnType<typeof createAdminClient>;
};

type DrawingOwnedRow = {
  id: string;
  project_id: string;
  file_path: string;
  is_published: boolean;
  projects: { company_id: string }[] | null;
};

function sanitizeFileName(value: string): string {
  const base = value.trim().toLowerCase().replace(/\.(pdf|jpe?g|png)$/i, "");
  const clean = base.replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return clean || "tegning";
}

function getExtension(filePath: string): string {
  const lower = filePath.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx === -1 ? "" : lower.slice(idx + 1);
}

function isImageExtension(ext: string): boolean {
  return ext === "jpg" || ext === "jpeg" || ext === "png";
}

async function maybeUpscaleImage(file: File, ext: string) {
  if (!isImageExtension(ext)) {
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type || (ext === "png" ? "image/png" : "image/jpeg"),
      finalExt: ext,
      wasUpscaled: false,
    };
  }

  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input);
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error("Kunne ikke lese bildet");
  }

  const targetWidth = Math.min(width * 2, 8000);
  const targetHeight = Math.min(height * 2, 8000);

  let pipeline = image.resize(targetWidth, targetHeight, {
    fit: "inside",
    kernel: sharp.kernel.lanczos3,
    withoutEnlargement: false,
  });

  if (ext === "png") {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline = pipeline.jpeg({ quality: 95, mozjpeg: true });
  }

  const out = await pipeline.toBuffer();
  return {
    bytes: new Uint8Array(out),
    contentType: ext === "png" ? "image/png" : "image/jpeg",
    finalExt: ext === "png" ? "png" : "jpg",
    wasUpscaled: true,
  };
}

function projectPath(projectId: string): string {
  return `/dashboard/projects/${projectId}`;
}

function redirectProjectError(projectId: string, message: string): never {
  redirect(`${projectPath(projectId)}?error=${encodeURIComponent(message)}`);
}

async function requireAdminContext(): Promise<AdminContext> {
  const actionClient = await createClient();
  const {
    data: { user },
  } = await actionClient.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const { data: profileData } = await actionClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as CompanyProfile | null;
  if (!profile?.company_id || !isAdminRole(profile.role)) {
    redirect("/dashboard/projects?error=Du+har+ikke+tilgang");
  }

  return {
    userId: user.id,
    companyId: profile.company_id,
    adminClient: createAdminClient(),
  };
}

async function ensureProjectInCompany(adminClient: ReturnType<typeof createAdminClient>, projectId: string, companyId: string) {
  const { data, error } = await adminClient
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (!data) {
    return { ok: false as const, error: "Prosjekt ikke funnet" };
  }
  return { ok: true as const };
}

function rowToOwned(data: unknown): DrawingOwnedRow {
  return data as DrawingOwnedRow;
}

export async function updateProjectStatus(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!projectId || !PROJECT_STATUS.has(status)) {
    redirect("/dashboard/projects?error=Ugyldig+statusendring");
  }

  const { companyId, adminClient } = await requireAdminContext();
  const projectCheck = await ensureProjectInCompany(adminClient, projectId, companyId);
  if (!projectCheck.ok) {
    redirectProjectError(projectId, projectCheck.error);
  }

  const { error } = await adminClient
    .from("projects")
    .update({ status })
    .eq("id", projectId);

  if (error) {
    redirectProjectError(projectId, error.message);
  }

  revalidatePath(projectPath(projectId));
  revalidatePath("/dashboard/projects");
  redirect(`${projectPath(projectId)}?success=status-updated`);
}

export async function updateProject(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!projectId || !name) redirect("/dashboard/projects?error=Mangler+data");

  const { companyId, adminClient } = await requireAdminContext();
  const projectCheck = await ensureProjectInCompany(adminClient, projectId, companyId);
  if (!projectCheck.ok) redirectProjectError(projectId, projectCheck.error);

  const { error } = await adminClient
    .from("projects")
    .update({ name, description: description || null })
    .eq("id", projectId);

  if (error) redirectProjectError(projectId, error.message);

  revalidatePath(projectPath(projectId));
  revalidatePath("/dashboard/projects");
  redirect(`${projectPath(projectId)}?success=project-updated`);
}

export async function createProject(formData: FormData) {
  const { userId, companyId, adminClient } = await requireAdminContext();

  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const requestedStatus = String(formData.get("status") ?? "planning").trim();
  const status = PROJECT_STATUS.has(requestedStatus) ? requestedStatus : "planning";

  if (!name) {
    redirect("/dashboard/projects?error=Prosjektnavn+er+påkrevd");
  }

  const { data, error } = await adminClient
    .from("projects")
    .insert({
      company_id: companyId,
      name,
      description: descriptionRaw || null,
      status,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/dashboard/projects?error=${encodeURIComponent(error?.message ?? "Kunne ikke opprette prosjekt")}`);
  }

  const projectId = (data as { id: string }).id;
  revalidatePath("/dashboard/projects");
  redirect(`${projectPath(projectId)}?success=project-created`);
}

export async function uploadDrawingPdf(projectId: string, formData: FormData) {
  const { userId, companyId, adminClient } = await requireAdminContext();
  const projectCheck = await ensureProjectInCompany(adminClient, projectId, companyId);
  if (!projectCheck.ok) {
    redirectProjectError(projectId, projectCheck.error);
  }

  const drawingNameInput = String(formData.get("name") ?? "").trim();
  const revisionInput = String(formData.get("revision") ?? "").trim();
  const fileInput = formData.get("pdf_file");

  if (!(fileInput instanceof File) || fileInput.size === 0) {
    redirectProjectError(projectId, "Velg en fil (PDF, JPEG eller PNG)");
  }
  if (fileInput.size > MAX_UPLOAD_BYTES) {
    redirectProjectError(projectId, "Filen er for stor. Maks størrelse er 25 MB.");
  }

  const lowerName = fileInput.name.toLowerCase();
  const ext = lowerName.includes(".") ? lowerName.split(".").pop() ?? "" : "";
  if (!ALLOWED_MIME.has(fileInput.type) && !ALLOWED_EXT.has(ext)) {
    redirectProjectError(projectId, "Kun PDF, JPEG eller PNG er tillatt");
  }

  const drawingName = drawingNameInput || lowerName.replace(/\.(pdf|jpe?g|png)$/i, "") || "Tegning";
  const safeBase = sanitizeFileName(fileInput.name);
  const finalExt = ALLOWED_EXT.has(ext) ? ext : fileInput.type === "application/pdf" ? "pdf" : fileInput.type === "image/png" ? "png" : "jpg";
  let uploadBlob: File | Blob = fileInput;
  let uploadExt = finalExt;
  let contentType = fileInput.type && ALLOWED_MIME.has(fileInput.type) ? fileInput.type : finalExt === "pdf" ? "application/pdf" : finalExt === "png" ? "image/png" : "image/jpeg";
  let upscaleSuffix = "";

  if (isImageExtension(finalExt)) {
    try {
      const upscaled = await maybeUpscaleImage(fileInput, finalExt);
      uploadBlob = new Blob([upscaled.bytes], { type: upscaled.contentType });
      uploadExt = upscaled.finalExt;
      contentType = upscaled.contentType;
      if (upscaled.wasUpscaled) {
        upscaleSuffix = "-upscaled";
      }
    } catch (e) {
      redirectProjectError(projectId, e instanceof Error ? e.message : "Kunne ikke prosessere bildet");
    }
  }

  const objectPath = `${companyId}/${projectId}/${Date.now()}-${safeBase}${upscaleSuffix}-${crypto.randomUUID()}.${uploadExt}`;

  const { error: uploadError } = await adminClient.storage.from("drawings").upload(objectPath, uploadBlob, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
    redirectProjectError(projectId, uploadError.message);
  }

  const { error: insertError } = await adminClient.from("drawings").insert({
    project_id: projectId,
    name: drawingName,
    file_path: objectPath,
    revision: revisionInput || null,
    uploaded_by: userId,
    is_published: true,
    published_at: new Date().toISOString(),
    published_by: userId,
  });

  if (insertError) {
    await adminClient.storage.from("drawings").remove([objectPath]);
    redirectProjectError(projectId, insertError.message);
  }

  revalidatePath(projectPath(projectId));
  redirect(`${projectPath(projectId)}?success=upload-ok`);
}

type PublishOverlayInput = {
  drawingId: string;
  toolType: string;
  layerName: string;
  layerColor: string;
  visibilityScope: string;
  payload: unknown;
};

function parseImageDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-z0-9+/=]+)$/i);
  if (!m) {
    return null;
  }
  const mime = m[1].toLowerCase();
  const base64 = m[2];
  const bytes = Buffer.from(base64, "base64");
  if (!bytes || bytes.length === 0) return null;
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { mime, bytes, ext };
}

async function normalizeOverlayPayload(
  adminClient: ReturnType<typeof createAdminClient>,
  companyId: string,
  drawingId: string,
  toolType: string,
  payload: unknown,
) {
  const normalized = JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>;
  if (toolType !== "detector") {
    return { ok: true as const, payload: normalized };
  }

  const checklist = (normalized.checklist ?? {}) as Record<string, unknown>;
  const photoDataUrl = typeof checklist.photoDataUrl === "string" ? checklist.photoDataUrl : null;
  if (!photoDataUrl) {
    return { ok: true as const, payload: normalized };
  }

  const parsed = parseImageDataUrl(photoDataUrl);
  if (!parsed) {
    return { ok: false as const, error: "Ugyldig bildevedlegg på detektor" };
  }
  if (parsed.bytes.length > MAX_OVERLAY_PHOTO_BYTES) {
    return { ok: false as const, error: "Bildevedlegg er for stort. Maks 2 MB." };
  }

  const objectPath = `${companyId}/drawing-overlays/${drawingId}/${crypto.randomUUID()}.${parsed.ext}`;
  const { error: uploadErr } = await adminClient.storage.from("pin-photos").upload(objectPath, parsed.bytes, {
    contentType: parsed.mime,
    upsert: false,
  });
  if (uploadErr) {
    return { ok: false as const, error: uploadErr.message };
  }

  checklist.photoPath = objectPath;
  checklist.photoDataUrl = null;
  normalized.checklist = checklist;
  return { ok: true as const, payload: normalized };
}

export async function publishOverlayItem(input: PublishOverlayInput) {
  const { userId, companyId, adminClient } = await requireAdminContext();
  const drawingId = String(input.drawingId ?? "").trim();
  const toolType = String(input.toolType ?? "").trim();
  const layerName = String(input.layerName ?? "").trim() || "Lag";
  const layerColor = String(input.layerColor ?? "").trim() || "#ef4444";
  const visibilityScope = String(input.visibilityScope ?? "all").trim();
  const payload = input.payload;

  if (!drawingId) {
    return { ok: false as const, error: "Mangler tegning" };
  }
  if (!OVERLAY_TOOL_TYPES.has(toolType)) {
    return { ok: false as const, error: "Ugyldig verktøytype" };
  }
  if (!OVERLAY_VISIBILITY.has(visibilityScope)) {
    return { ok: false as const, error: "Ugyldig synlighetsvalg" };
  }
  if (!payload || typeof payload !== "object") {
    return { ok: false as const, error: "Ugyldig overlay-data" };
  }

  const { data: drawingData, error: drawingErr } = await adminClient
    .from("drawings")
    .select("id, project_id, projects!inner(company_id)")
    .eq("id", drawingId)
    .maybeSingle();
  if (drawingErr || !drawingData) {
    return { ok: false as const, error: drawingErr?.message ?? "Tegning ikke funnet" };
  }

  const drawing = drawingData as { id: string; project_id: string; projects: { company_id: string }[] | null };
  const ownerCompanyId = drawing.projects?.[0]?.company_id ?? null;
  if (ownerCompanyId !== companyId) {
    return { ok: false as const, error: "Tegningen tilhører ikke firmaet" };
  }

  const normalized = await normalizeOverlayPayload(adminClient, companyId, drawingId, toolType, payload);
  if (!normalized.ok) {
    return { ok: false as const, error: normalized.error };
  }

  const { data, error } = await adminClient
    .from("drawing_overlays")
    .insert({
      drawing_id: drawingId,
      created_by: userId,
      tool_type: toolType,
      layer_name: layerName,
      layer_color: layerColor,
      payload: normalized.payload,
      is_published: true,
      visibility_scope: visibilityScope,
      published_at: new Date().toISOString(),
      published_by: userId,
    })
    .select("id, drawing_id, created_by, tool_type, layer_name, layer_color, payload, visibility_scope")
    .single();

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "Kunne ikke publisere overlay" };
  }

  revalidatePath(`/dashboard/projects/${drawing.project_id}/drawings/${drawingId}`);
  return { ok: true as const, data };
}

async function getOwnedDrawing(adminClient: ReturnType<typeof createAdminClient>, drawingId: string, companyId: string) {
  const { data, error } = await adminClient
    .from("drawings")
    .select("id, project_id, file_path, is_published, projects!inner(company_id)")
    .eq("id", drawingId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message };
  }
  if (!data) {
    return { ok: false as const, error: "Tegning ikke funnet" };
  }

  const row = rowToOwned(data);
  const ownerCompanyId = row.projects?.[0]?.company_id ?? null;
  if (ownerCompanyId !== companyId) {
    return { ok: false as const, error: "Tegning tilhører ikke firmaet" };
  }

  return { ok: true as const, row };
}

async function convertImageDrawingToPdf(
  adminClient: ReturnType<typeof createAdminClient>,
  row: { id: string; file_path: string },
) {
  const ext = getExtension(row.file_path);
  if (!isImageExtension(ext)) {
    return { converted: false as const };
  }

  const { data: fileData, error: dlError } = await adminClient.storage.from("drawings").download(row.file_path);
  if (dlError || !fileData) {
    throw new Error(dlError?.message ?? "Kunne ikke hente tegning fra storage");
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  const pdfDoc = await PDFDocument.create();
  const embedded = ext === "png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  const page = pdfDoc.addPage([embedded.width, embedded.height]);
  page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  const pdfBytes = await pdfDoc.save();

  const base = row.file_path.replace(/\.(png|jpg|jpeg)$/i, "");
  const pdfPath = `${base}.pdf`;
  const { error: uploadError } = await adminClient.storage.from("drawings").upload(pdfPath, pdfBytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: updateError } = await adminClient.from("drawings").update({ file_path: pdfPath }).eq("id", row.id);
  if (updateError) {
    await adminClient.storage.from("drawings").remove([pdfPath]);
    throw new Error(updateError.message);
  }

  await adminClient.storage.from("drawings").remove([row.file_path]);
  return { converted: true as const };
}

export async function publishDrawing(formData: FormData) {
  const drawingId = String(formData.get("drawing_id") ?? "").trim();
  if (!drawingId) {
    redirect("/dashboard/projects?error=Mangler+tegning");
  }

  const { userId, companyId, adminClient } = await requireAdminContext();
  const owned = await getOwnedDrawing(adminClient, drawingId, companyId);
  if (!owned.ok) {
    redirect(`/dashboard/projects?error=${encodeURIComponent(owned.error)}`);
  }

  const projectId = owned.row.project_id;
  const { error } = await adminClient
    .from("drawings")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      published_by: userId,
    })
    .eq("id", drawingId);

  if (error) {
    redirectProjectError(projectId, error.message);
  }

  revalidatePath(projectPath(projectId));
  redirect(`${projectPath(projectId)}?success=published`);
}

export async function unpublishDrawing(formData: FormData) {
  const drawingId = String(formData.get("drawing_id") ?? "").trim();
  if (!drawingId) {
    redirect("/dashboard/projects?error=Mangler+tegning");
  }

  const { companyId, adminClient } = await requireAdminContext();
  const owned = await getOwnedDrawing(adminClient, drawingId, companyId);
  if (!owned.ok) {
    redirect(`/dashboard/projects?error=${encodeURIComponent(owned.error)}`);
  }

  const projectId = owned.row.project_id;
  const { error } = await adminClient
    .from("drawings")
    .update({
      is_published: false,
      published_at: null,
      published_by: null,
    })
    .eq("id", drawingId);

  if (error) {
    redirectProjectError(projectId, error.message);
  }

  revalidatePath(projectPath(projectId));
  redirect(`${projectPath(projectId)}?success=unpublished`);
}

export async function deleteDraftDrawing(formData: FormData) {
  const drawingId = String(formData.get("drawing_id") ?? "").trim();
  if (!drawingId) {
    redirect("/dashboard/projects?error=Mangler+tegning");
  }

  const { companyId, adminClient } = await requireAdminContext();
  const owned = await getOwnedDrawing(adminClient, drawingId, companyId);
  if (!owned.ok) {
    redirect(`/dashboard/projects?error=${encodeURIComponent(owned.error)}`);
  }

  const { row } = owned;
  if (row.is_published) {
    redirectProjectError(row.project_id, "Publiserte tegninger kan ikke slettes her");
  }

  const { error: deleteError } = await adminClient
    .from("drawings")
    .delete()
    .eq("id", drawingId)
    .eq("project_id", row.project_id);

  if (deleteError) {
    redirectProjectError(row.project_id, deleteError.message);
  }

  await adminClient.storage.from("drawings").remove([row.file_path]);
  revalidatePath(projectPath(row.project_id));
  redirect(`${projectPath(row.project_id)}?success=draft-deleted`);
}

export async function convertProjectImagesToPdf(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "").trim();
  if (!projectId) {
    redirect("/dashboard/projects?error=Mangler+prosjekt");
  }

  const { companyId, adminClient } = await requireAdminContext();
  const projectCheck = await ensureProjectInCompany(adminClient, projectId, companyId);
  if (!projectCheck.ok) {
    redirectProjectError(projectId, projectCheck.error);
  }

  const { data: rows, error } = await adminClient
    .from("drawings")
    .select("id, file_path")
    .eq("project_id", projectId);
  if (error) {
    redirectProjectError(projectId, error.message);
  }

  let convertedCount = 0;
  for (const row of (rows ?? []) as { id: string; file_path: string }[]) {
    const result = await convertImageDrawingToPdf(adminClient, row);
    if (result.converted) convertedCount += 1;
  }

  revalidatePath(projectPath(projectId));
  redirect(`${projectPath(projectId)}?success=converted-${convertedCount}`);
}

/**
 * Begrens hvem som ser publiserte tegninger på prosjektet.
 * Ingen avkryssing = tom liste i DB = alle med prosjekttilgang (can_access_project) beholder tilgang.
 */
export async function setProjectBlueprintAccess(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "").trim();
  if (!projectId) {
    redirect("/dashboard/projects?error=Mangler+prosjekt");
  }

  const { companyId, adminClient } = await requireAdminContext();
  const projectCheck = await ensureProjectInCompany(adminClient, projectId, companyId);
  if (!projectCheck.ok) {
    redirectProjectError(projectId, projectCheck.error);
  }

  const requested = formData
    .getAll("blueprint_user_id")
    .map((v) => String(v).trim())
    .filter((id) => id.length > 0);

  const unique = Array.from(new Set(requested));
  let validIds: string[] = [];
  if (unique.length > 0) {
    const { data: validRows, error: validErr } = await adminClient
      .from("profiles")
      .select("id")
      .eq("company_id", companyId)
      .in("id", unique);
    if (validErr) {
      redirectProjectError(projectId, validErr.message);
    }
    validIds = (validRows ?? []).map((r) => (r as { id: string }).id);
  }

  const { error: delErr } = await adminClient.from("project_blueprint_access").delete().eq("project_id", projectId);
  if (delErr) {
    redirectProjectError(projectId, delErr.message);
  }

  if (validIds.length > 0) {
    const { error: insErr } = await adminClient.from("project_blueprint_access").insert(
      validIds.map((user_id) => ({ project_id: projectId, user_id })),
    );
    if (insErr) {
      redirectProjectError(projectId, insErr.message);
    }
  }

  revalidatePath(projectPath(projectId));
  redirect(`${projectPath(projectId)}?success=blueprint-access`);
}
