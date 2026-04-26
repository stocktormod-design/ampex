"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BASE = "/dashboard/settings/risk-modules";

function baseWithTemplate(templateId: string): string {
  return `${BASE}?template=${encodeURIComponent(templateId)}`;
}

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

async function verifyItemOwnership(
  adminClient: ReturnType<typeof createAdminClient>,
  itemId: string,
  companyId: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("risk_assessment_module_items")
    .select("id, risk_assessment_modules!inner(company_id)")
    .eq("id", itemId)
    .maybeSingle();
  const row = data as { id: string; risk_assessment_modules: { company_id: string }[] } | null;
  return (
    !!row &&
    (row.risk_assessment_modules as unknown as { company_id: string }[])[0]?.company_id === companyId
  );
}

export async function createModule(formData: FormData) {
  const { companyId, userId, adminClient } = await requirePrivilegedContext();
  const templateId = String(formData.get("template_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`${BASE}?error=Navn+er+påkrevd`);
  if (!templateId) redirect(`${BASE}?error=Velg+en+risikomal`);

  const { data: templateData } = await adminClient
    .from("risk_assessment_templates")
    .select("id")
    .eq("id", templateId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!templateData) redirect(`${BASE}?error=Risikomal+ikke+funnet`);

  const { data: maxRow } = await adminClient
    .from("risk_assessment_modules")
    .select("sort_order")
    .eq("company_id", companyId)
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await adminClient.from("risk_assessment_modules").insert({
    company_id: companyId,
    template_id: templateId,
    name,
    sort_order: nextOrder,
    created_by: userId,
  });
  if (error) redirect(`${baseWithTemplate(templateId)}&error=${encodeURIComponent(error.message)}`);
  redirect(baseWithTemplate(templateId));
}

export async function updateModuleName(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const moduleId = String(formData.get("module_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!moduleId || !name) redirect(`${BASE}?error=Modulnavn+er+påkrevd`);

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
  const templateId = String(formData.get("template_id") ?? "").trim();
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
  if (templateId) redirect(baseWithTemplate(templateId));
  redirect(BASE);
}

export async function updateModuleItem(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const itemId = String(formData.get("item_id") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!itemId || !text) redirect(`${BASE}?error=Tekst+er+påkrevd`);

  const ok = await verifyItemOwnership(adminClient, itemId, companyId);
  if (!ok) redirect(`${BASE}?error=Punkt+ikke+funnet`);

  const { error } = await adminClient
    .from("risk_assessment_module_items")
    .update({ text })
    .eq("id", itemId);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}

export async function toggleItemRequired(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const itemId = String(formData.get("item_id") ?? "").trim();
  const currentRequired = formData.get("current_required") === "1";
  if (!itemId) redirect(`${BASE}?error=Ugyldig+punkt`);

  const ok = await verifyItemOwnership(adminClient, itemId, companyId);
  if (!ok) redirect(`${BASE}?error=Punkt+ikke+funnet`);

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

  const ok = await verifyItemOwnership(adminClient, itemId, companyId);
  if (!ok) redirect(`${BASE}?error=Punkt+ikke+funnet`);

  const { error } = await adminClient
    .from("risk_assessment_module_items")
    .delete()
    .eq("id", itemId);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}

// ─── Default Norwegian electrical safety checklist ────────────────────────────

type DefaultItem = { text: string; required: boolean };
type DefaultModule = { name: string; items: DefaultItem[] };

const DEFAULT_MODULES: DefaultModule[] = [
  {
    name: "Forberedelser og arbeidsklarering",
    items: [
      { text: "Arbeidstillatelse innhentet fra anleggseier / ansvarlig", required: true },
      { text: "Anlegget er spenningsfritt og sikret mot utilsiktet tilbakekobling", required: true },
      { text: "Spenningsfrihet målt og bekreftet med godkjent instrument (FSE § 10)", required: true },
      { text: "Jordforbindelsen og potensialutjevning er kontrollert", required: true },
      { text: "Nødvendig personlig verneutstyr (PVU) tilgjengelig og i orden", required: true },
      { text: "LOTO-prosedyre gjennomført og dokumentert (der aktuelt)", required: false },
      { text: "Koordinering med anleggseier / driftsansvarlig gjennomført", required: false },
      { text: "Beboere / brukere informert om arbeid og forventet strømpause", required: false },
      { text: "Arbeidsstedet ryddet og avsperret om nødvendig", required: false },
    ],
  },
  {
    name: "Elektrisk installasjon",
    items: [
      { text: "Kursfortegnelse kontrollert og stemmer med eksisterende anlegg (NEK 400-5-514)", required: true },
      { text: "Jordfeilbryter (RCD) montert der påkrevd / eksisterende kontrollert og godkjent", required: true },
      { text: "Kabeltype, dimensjon og føring er i henhold til beregning og NEK 400", required: true },
      { text: "Koblingsskjema tilgjengelig og oppdatert", required: false },
      { text: "Overspenningsvern vurdert (NEK 400-4-443)", required: false },
      { text: "Beregnet belastning / effektbehov kontrollert mot eksisterende kurs", required: false },
      { text: "EMC-krav vurdert der aktuelt (skjerming, separat kabelføring)", required: false },
    ],
  },
  {
    name: "Brannsikkerhet og arbeidsmiljø",
    items: [
      { text: "Branngjennomføringer tettet iht. brannklasse der kabel passerer branncellevegg", required: true },
      { text: "Varmt arbeid: branntillatelse innhentet, brannslukkingsapparat tilgjengelig", required: false },
      { text: "Kabelkanaler og koblingsbokser lukket og sikret mot varmgang", required: false },
      { text: "Verneutstyr mot lysbue (ARC-rated) vurdert og tilgjengelig (der aktuelt)", required: false },
      { text: "Støy og arbeidsmiljøkrav vurdert — hørselsvern tilgjengelig", required: false },
      { text: "Fall-sikring etablert ved arbeid i høyden", required: false },
    ],
  },
  {
    name: "Sluttsjekk og dokumentasjon",
    items: [
      { text: "Isolasjonsresistans målt og dokumentert — min. 1 MΩ pr. kurs (NEK 400-6-61)", required: true },
      { text: "Vern, sikringer og jordfeilbrytere testet og fungerer", required: true },
      { text: "Kursfortegnelse oppdatert med nye / endrede kretser", required: true },
      { text: "Samsvarserklæring fylt ut og levert anleggseier (FEL § 12)", required: true },
      { text: "Systemet testet under drift og verifisert operativt (der mulig og forsvarlig)", required: false },
      { text: "Som-bygget-tegninger (as-built) oppdatert / oppdatering formelt avtalt", required: false },
      { text: "All teknisk dokumentasjon overlevert anleggseier / driftsansvarlig", required: false },
      { text: "Arbeidsstedet ryddet og etterlatt i god stand", required: false },
    ],
  },
];

export async function seedDefaultModules(formData: FormData) {
  const { companyId, userId, adminClient } = await requirePrivilegedContext();
  const templateId = String(formData.get("template_id") ?? "").trim();
  if (!templateId) {
    redirect(`${BASE}?error=Velg+en+risikomal+før+du+legger+inn+standard`);
  }

  const { data: templateData } = await adminClient
    .from("risk_assessment_templates")
    .select("id")
    .eq("id", templateId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!templateData) redirect(`${BASE}?error=Risikomal+ikke+funnet`);

  const { data: existingRows } = await adminClient
    .from("risk_assessment_modules")
    .select("sort_order")
    .eq("company_id", companyId)
    .eq("template_id", templateId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextModuleOrder = ((existingRows as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  for (const mod of DEFAULT_MODULES) {
    const { data: createdMod, error: modErr } = await adminClient
      .from("risk_assessment_modules")
      .insert({
        company_id: companyId,
        template_id: templateId,
        name: mod.name,
        sort_order: nextModuleOrder,
        created_by: userId,
      })
      .select("id")
      .single();

    if (modErr || !createdMod) {
      redirect(`${baseWithTemplate(templateId)}&error=${encodeURIComponent(modErr?.message ?? "Feil ved oppretting av modul")}`);
    }

    const moduleId = (createdMod as { id: string }).id;
    const itemRows = mod.items.map((item, idx) => ({
      module_id: moduleId,
      text: item.text,
      is_required: item.required,
      sort_order: idx,
    }));

    const { error: itemErr } = await adminClient.from("risk_assessment_module_items").insert(itemRows);
    if (itemErr) {
      redirect(`${baseWithTemplate(templateId)}&error=${encodeURIComponent(itemErr.message)}`);
    }

    nextModuleOrder++;
  }

  redirect(baseWithTemplate(templateId));
}

export async function createTemplate(formData: FormData) {
  const { companyId, userId, adminClient } = await requirePrivilegedContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`${BASE}?error=Navn+paa+mal+er+paakrevd`);

  const { data, error } = await adminClient
    .from("risk_assessment_templates")
    .insert({ company_id: companyId, name, created_by: userId })
    .select("id")
    .single();
  if (error || !data) redirect(`${BASE}?error=${encodeURIComponent(error?.message ?? "Kunne+ikke+opprette+mal")}`);
  redirect(baseWithTemplate((data as { id: string }).id));
}

export async function updateTemplateName(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const templateId = String(formData.get("template_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!templateId || !name) redirect(`${BASE}?error=Mangler+maldata`);

  const { error } = await adminClient
    .from("risk_assessment_templates")
    .update({ name })
    .eq("id", templateId)
    .eq("company_id", companyId);
  if (error) redirect(`${baseWithTemplate(templateId)}&error=${encodeURIComponent(error.message)}`);
  redirect(baseWithTemplate(templateId));
}

export async function duplicateTemplate(formData: FormData) {
  const { companyId, userId, adminClient } = await requirePrivilegedContext();
  const sourceTemplateId = String(formData.get("template_id") ?? "").trim();
  if (!sourceTemplateId) redirect(`${BASE}?error=Ugyldig+mal`);

  const { data: sourceTemplate } = await adminClient
    .from("risk_assessment_templates")
    .select("id, name")
    .eq("id", sourceTemplateId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!sourceTemplate) redirect(`${BASE}?error=Mal+ikke+funnet`);

  const { data: createdTemplate, error: createTemplateErr } = await adminClient
    .from("risk_assessment_templates")
    .insert({
      company_id: companyId,
      name: `${(sourceTemplate as { name: string }).name} (kopi)`,
      created_by: userId,
    })
    .select("id")
    .single();
  if (createTemplateErr || !createdTemplate) {
    redirect(`${BASE}?error=${encodeURIComponent(createTemplateErr?.message ?? "Kunne+ikke+kopiere+mal")}`);
  }
  const newTemplateId = (createdTemplate as { id: string }).id;

  const { data: modulesData, error: modulesErr } = await adminClient
    .from("risk_assessment_modules")
    .select("id, name, sort_order, risk_assessment_module_items(id, text, is_required, sort_order)")
    .eq("company_id", companyId)
    .eq("template_id", sourceTemplateId)
    .order("sort_order", { ascending: true });
  if (modulesErr) redirect(`${baseWithTemplate(newTemplateId)}&error=${encodeURIComponent(modulesErr.message)}`);

  const modules = (modulesData ?? []) as {
    id: string;
    name: string;
    sort_order: number;
    risk_assessment_module_items: { id: string; text: string; is_required: boolean; sort_order: number }[];
  }[];

  for (const mod of modules) {
    const { data: createdModule, error: createModErr } = await adminClient
      .from("risk_assessment_modules")
      .insert({
        company_id: companyId,
        template_id: newTemplateId,
        name: mod.name,
        sort_order: mod.sort_order,
        created_by: userId,
      })
      .select("id")
      .single();
    if (createModErr || !createdModule) {
      redirect(`${baseWithTemplate(newTemplateId)}&error=${encodeURIComponent(createModErr?.message ?? "Kunne+ikke+kopiere+seksjon")}`);
    }
    const newModuleId = (createdModule as { id: string }).id;
    const rows = (mod.risk_assessment_module_items ?? []).map((item) => ({
      module_id: newModuleId,
      text: item.text,
      is_required: item.is_required,
      sort_order: item.sort_order,
    }));
    if (rows.length > 0) {
      const { error: insertItemsErr } = await adminClient.from("risk_assessment_module_items").insert(rows);
      if (insertItemsErr) redirect(`${baseWithTemplate(newTemplateId)}&error=${encodeURIComponent(insertItemsErr.message)}`);
    }
  }

  redirect(baseWithTemplate(newTemplateId));
}

export async function deleteTemplate(formData: FormData) {
  const { companyId, adminClient } = await requirePrivilegedContext();
  const templateId = String(formData.get("template_id") ?? "").trim();
  if (!templateId) redirect(`${BASE}?error=Ugyldig+mal`);

  const { count } = await adminClient
    .from("risk_assessment_templates")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  if ((count ?? 0) <= 1) {
    redirect(`${baseWithTemplate(templateId)}&error=Du+maa+beholde+minst+en+risikomal`);
  }

  const { error } = await adminClient
    .from("risk_assessment_templates")
    .delete()
    .eq("id", templateId)
    .eq("company_id", companyId);
  if (error) redirect(`${baseWithTemplate(templateId)}&error=${encodeURIComponent(error.message)}`);
  redirect(BASE);
}
