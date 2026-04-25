"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

type CompanyProfile = { company_id: string | null; role: string };

async function requireMember() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as CompanyProfile | null;
  if (!profile?.company_id) redirect("/onboarding");

  return { supabase, userId: user.id, companyId: profile.company_id, role: profile.role };
}

async function requireAdmin() {
  const ctx = await requireMember();
  if (!isAdminRole(ctx.role)) redirect("/dashboard");
  return { ...ctx, adminClient: createAdminClient() };
}

async function ensureBucket(adminClient: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await adminClient.storage.listBuckets();
  const exists = (buckets ?? []).some((b: { id: string }) => b.id === "protocols");
  if (!exists) {
    await adminClient.storage.createBucket("protocols", { public: false });
  }
}

// ── Categories ────────────────────────────────────────────────────

export async function createCategory(formData: FormData) {
  const { companyId, userId, adminClient } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/dashboard/protokoller?error=Kategorinavn+er+påkrevd");

  const { error } = await adminClient.from("protocol_categories").insert({
    company_id: companyId,
    name,
    created_by: userId,
  });

  if (error) {
    if (error.code === "23505") {
      redirect(`/dashboard/protokoller?error=${encodeURIComponent("Kategorinavnet er allerede i bruk")}`);
    }
    redirect(`/dashboard/protokoller?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/protokoller");
  redirect("/dashboard/protokoller?success=category-created");
}

export async function deleteCategory(formData: FormData) {
  const { companyId, adminClient } = await requireAdmin();
  const categoryId = String(formData.get("category_id") ?? "").trim();
  if (!categoryId) redirect("/dashboard/protokoller?error=Mangler+kategori");

  const { error } = await adminClient
    .from("protocol_categories")
    .delete()
    .eq("id", categoryId)
    .eq("company_id", companyId);

  if (error) redirect(`/dashboard/protokoller?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/dashboard/protokoller");
  redirect("/dashboard/protokoller");
}

// ── Protocols ─────────────────────────────────────────────────────

export async function uploadProtocol(formData: FormData) {
  const { companyId, userId, adminClient } = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim() || null;
  const fileInput = formData.get("pdf_file");

  if (!name) redirect("/dashboard/protokoller?error=Navn+er+påkrevd");
  if (!(fileInput instanceof File) || fileInput.size === 0) {
    redirect("/dashboard/protokoller?error=Velg+en+PDF-fil");
  }
  if (fileInput.size > MAX_PDF_BYTES) {
    redirect("/dashboard/protokoller?error=Filen+er+for+stor+%28maks+20+MB%29");
  }
  if (fileInput.type !== "application/pdf" && !fileInput.name.toLowerCase().endsWith(".pdf")) {
    redirect("/dashboard/protokoller?error=Kun+PDF-filer+er+tillatt");
  }

  await ensureBucket(adminClient);

  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  const filePath = `${companyId}/${Date.now()}-${safeName}-${crypto.randomUUID()}.pdf`;

  const bytes = new Uint8Array(await fileInput.arrayBuffer());
  const { error: uploadError } = await adminClient.storage
    .from("protocols")
    .upload(filePath, bytes, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    redirect(`/dashboard/protokoller?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { data, error: insertError } = await adminClient
    .from("protocols")
    .insert({
      company_id: companyId,
      category_id: categoryId,
      name,
      description: description || null,
      file_path: filePath,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError) {
    await adminClient.storage.from("protocols").remove([filePath]);
    redirect(`/dashboard/protokoller?error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath("/dashboard/protokoller");
  redirect(`/dashboard/protokoller/${(data as { id: string }).id}?success=uploaded`);
}

export async function deleteProtocol(formData: FormData) {
  const { companyId, adminClient } = await requireAdmin();
  const protocolId = String(formData.get("protocol_id") ?? "").trim();
  if (!protocolId) redirect("/dashboard/protokoller?error=Mangler+protokoll");

  const { data: protocol } = await adminClient
    .from("protocols")
    .select("id, file_path")
    .eq("id", protocolId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!protocol) redirect("/dashboard/protokoller?error=Protokoll+ikke+funnet");

  const { error } = await adminClient
    .from("protocols")
    .delete()
    .eq("id", protocolId)
    .eq("company_id", companyId);

  if (error) redirect(`/dashboard/protokoller?error=${encodeURIComponent(error.message)}`);

  const row = protocol as { id: string; file_path: string };
  await adminClient.storage.from("protocols").remove([row.file_path]);

  revalidatePath("/dashboard/protokoller");
  redirect("/dashboard/protokoller");
}

// ── Acknowledgements ──────────────────────────────────────────────

export async function acknowledgeProtocol(formData: FormData) {
  const { supabase, userId } = await requireMember();
  const protocolId = String(formData.get("protocol_id") ?? "").trim();
  if (!protocolId) return;

  await supabase.from("protocol_acknowledgements").insert({
    protocol_id: protocolId,
    user_id: userId,
  });

  revalidatePath(`/dashboard/protokoller/${protocolId}`);
  redirect(`/dashboard/protokoller/${protocolId}?ack=1`);
}

// ── Signed URL ────────────────────────────────────────────────────

export async function getProtocolUrl(filePath: string): Promise<string | null> {
  const adminClient = createAdminClient();
  const { data } = await adminClient.storage
    .from("protocols")
    .createSignedUrl(filePath, 60 * 60); // 1 hour
  return data?.signedUrl ?? null;
}
