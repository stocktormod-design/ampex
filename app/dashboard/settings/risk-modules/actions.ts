"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BASE = "/dashboard/settings/risk-modules";

async function requirePrivilegedContext() {
  const actionClient = await createClient();
  const {
    data: { user },
  } = await actionClient.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await actionClient
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { company_id: string | null; role: string } | null;

  if (!profile?.company_id || !["owner", "admin", "installator"].includes(profile.role)) {
    redirect("/dashboard?error=Ingen+tilgang");
  }

  return { companyId: profile.company_id, userId: user.id, adminClient: createAdminClient() };
}

export async function createModule(formData: FormData) {
  const { companyId, userId, adminClient } = await requirePrivilegedContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`${BASE}?error=Navn+er+påkrevd`);

  const { data: maxRow } = await adminClient
    .from("risk_assessment_modules")
    .select("sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await adminClient.from("risk_assessment_modules").insert({
    company_id: companyId,
    name,
    sort_order: nextOrder,
    created_by: userId,
  });
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}

export async function updateModuleName(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const moduleId = String(formData.get("module_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!moduleId || !name) redirect(`${BASE}?error=Ugyldig+forespørsel`);

  const { error } = await adminClient
    .from("risk_assessment_modules")
    .update({ name })
    .eq("id", moduleId)
    .eq("company_id", companyId);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}

export async function deleteModule(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const moduleId = String(formData.get("module_id") ?? "").trim();
  if (!moduleId) redirect(`${BASE}?error=Ugyldig+modul`);

  const { error } = await adminClient
    .from("risk_assessment_modules")
    .delete()
    .eq("id", moduleId)
    .eq("company_id", companyId);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}

export async function addModuleItem(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const moduleId = String(formData.get("module_id") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const isRequired = formData.get("is_required") === "1";
  if (!moduleId || !text) redirect(`${BASE}?error=Tekst+er+påkrevd`);

  const { data: moduleData } = await adminClient
    .from("risk_assessment_modules")
    .select("id")
    .eq("id", moduleId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!moduleData) redirect(`${BASE}?error=Modul+ikke+funnet`);

  const { data: maxRow } = await adminClient
    .from("risk_assessment_module_items")
    .select("sort_order")
    .eq("module_id", moduleId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await adminClient.from("risk_assessment_module_items").insert({
    module_id: moduleId,
    text,
    is_required: isRequired,
    sort_order: nextOrder,
  });
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}

export async function toggleItemRequired(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const itemId = String(formData.get("item_id") ?? "").trim();
  const currentRequired = formData.get("current_required") === "1";
  if (!itemId) redirect(`${BASE}?error=Ugyldig+punkt`);

  const { data: itemData } = await adminClient
    .from("risk_assessment_module_items")
    .select("id, risk_assessment_modules!inner(company_id)")
    .eq("id", itemId)
    .maybeSingle();
  const item = itemData as { id: string; risk_assessment_modules: { company_id: string }[] } | null;
  if (!item || (item.risk_assessment_modules as unknown as { company_id: string }[])[0]?.company_id !== companyId) {
    redirect(`${BASE}?error=Punkt+ikke+funnet`);
  }

  const { error } = await adminClient
    .from("risk_assessment_module_items")
    .update({ is_required: !currentRequired })
    .eq("id", itemId);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}

export async function deleteModuleItem(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const itemId = String(formData.get("item_id") ?? "").trim();
  if (!itemId) redirect(`${BASE}?error=Ugyldig+punkt`);

  const { data: itemData } = await adminClient
    .from("risk_assessment_module_items")
    .select("id, risk_assessment_modules!inner(company_id)")
    .eq("id", itemId)
    .maybeSingle();
  const item = itemData as { id: string; risk_assessment_modules: { company_id: string }[] } | null;
  if (!item || (item.risk_assessment_modules as unknown as { company_id: string }[])[0]?.company_id !== companyId) {
    redirect(`${BASE}?error=Punkt+ikke+funnet`);
  }

  const { error } = await adminClient
    .from("risk_assessment_module_items")
    .delete()
    .eq("id", itemId);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}
