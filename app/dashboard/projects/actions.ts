"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const PROJECT_STATUS = new Set(["planning", "active", "completed"]);

type CompanyProfile = {
  company_id: string | null;
  role: string;
};

type AdminContext = {
  userId: string;
  companyId: string;
  adminClient: ReturnType<typeof createAdminClient>;
};

function sanitizeFileName(value: string): string {
  const base = value.trim().toLowerCase().replace(/\.pdf$/i, "");
  const clean = base.replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return clean || "tegning";
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
    redirectProjectError(projectId, "Velg en PDF-fil");
  }
  if (fileInput.size > MAX_PDF_BYTES) {
    redirectProjectError(projectId, "PDF er for stor. Maks størrelse er 25 MB.");
  }

  const lowerName = fileInput.name.toLowerCase();
  if (fileInput.type !== "application/pdf" && !lowerName.endsWith(".pdf")) {
    redirectProjectError(projectId, "Kun PDF-filer er tillatt");
  }

  const drawingName = drawingNameInput || lowerName.replace(/\.pdf$/i, "") || "Tegning";
  const safeBase = sanitizeFileName(fileInput.name);
  const objectPath = `${companyId}/${projectId}/${Date.now()}-${safeBase}-${crypto.randomUUID()}.pdf`;

  const { error: uploadError } = await adminClient.storage.from("drawings").upload(objectPath, fileInput, {
    contentType: "application/pdf",
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
    is_published: false,
    published_at: null,
    published_by: null,
  });

  if (insertError) {
    await adminClient.storage.from("drawings").remove([objectPath]);
    redirectProjectError(projectId, insertError.message);
  }

  revalidatePath(projectPath(projectId));
  redirect(`${projectPath(projectId)}?success=upload-ok`);
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

  const row = data as {
    id: string;
    project_id: string;
    file_path: string;
    is_published: boolean;
    projects: { company_id: string }[] | null;
  };
  const ownerCompanyId = row.projects?.[0]?.company_id ?? null;
  if (ownerCompanyId !== companyId) {
    return { ok: false as const, error: "Tegning tilhører ikke firmaet" };
  }

  return { ok: true as const, row };
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
