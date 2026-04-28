"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/roles";
import type { ErpProvider } from "@/lib/integrations/types";

const VALID_PROVIDERS: ErpProvider[] = ["fiken", "tripletex"];

// ── Kontekstvalidering ─────────────────────────────────────────────────────

async function requireAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.company_id) redirect("/onboarding");
  if (!isAdminRole(profile.role)) {
    redirect("/dashboard?error=Ingen+tilgang+til+regnskap");
  }

  return { userId: user.id, companyId: profile.company_id as string };
}

// ── Opprett / oppdater ERP-integrasjon ────────────────────────────────────

export async function upsertIntegration(formData: FormData): Promise<void> {
  const { userId, companyId } = await requireAdminContext();

  const provider = formData.get("provider") as string | null;
  if (!provider || !(VALID_PROVIDERS as string[]).includes(provider)) {
    redirect("/dashboard/regnskap?error=Ugyldig+ERP-leverand%C3%B8r");
  }
  const erpProvider = provider as ErpProvider;

  // ── Bygg credentials (sensitiv del → Vault) og metadata (offentlig del) ──
  let credentials: Record<string, string> = {};
  let authMeta: Record<string, string> = {};

  if (erpProvider === "fiken") {
    const accessToken = (formData.get("accessToken") as string | null)?.trim();
    const companySlug = (formData.get("companySlug") as string | null)?.trim();
    if (!accessToken || !companySlug) {
      redirect("/dashboard/regnskap?error=Fiken+krever+bedriftsslug+og+API-n%C3%B8kkel");
    }
    credentials = { accessToken };
    authMeta = { companySlug }; // slug er ikke sensitiv
  } else if (erpProvider === "tripletex") {
    const consumerToken = (formData.get("consumerToken") as string | null)?.trim();
    const employeeToken = (formData.get("employeeToken") as string | null)?.trim();
    if (!consumerToken || !employeeToken) {
      redirect("/dashboard/regnskap?error=Tripletex+krever+consumer+og+employee+token");
    }
    credentials = { consumerToken, employeeToken };
    authMeta = {};
  }

  const admin = createAdminClient();

  // ── Lagre credentials i Vault, hent tilbake secret-ID ─────────────────
  const { data: secretId, error: vaultError } = await admin.rpc(
    "vault_upsert_integration_secret",
    {
      p_company_id: companyId,
      p_provider: erpProvider,
      p_secret_json: JSON.stringify(credentials),
    },
  );

  if (vaultError || !secretId) {
    redirect(
      `/dashboard/regnskap?error=Vault-feil%3A+${encodeURIComponent(vaultError?.message ?? "ukjent")}`,
    );
  }

  // ── Sjekk om integrasjon allerede finnes ──────────────────────────────
  const { data: existing } = await admin
    .from("company_integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("provider", erpProvider)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("company_integrations")
      .update({
        status: "active",
        auth_meta: authMeta,
        auth_secret_ref: secretId as string,
      })
      .eq("id", existing.id);

    if (error) {
      redirect(
        `/dashboard/regnskap?error=Lagringsfeil%3A+${encodeURIComponent(error.message)}`,
      );
    }
  } else {
    const { error } = await admin.from("company_integrations").insert({
      company_id: companyId,
      provider: erpProvider,
      status: "active",
      auth_meta: authMeta,
      auth_secret_ref: secretId as string,
      created_by: userId,
    });

    if (error) {
      redirect(
        `/dashboard/regnskap?error=Lagringsfeil%3A+${encodeURIComponent(error.message)}`,
      );
    }
  }

  revalidatePath("/dashboard/regnskap");
  redirect("/dashboard/regnskap?success=Integrasjon+lagret");
}

// ── Kø manuell synkjobb ───────────────────────────────────────────────────

export async function queueManualSync(formData: FormData): Promise<void> {
  const { companyId } = await requireAdminContext();

  const orderId = (formData.get("order_id") as string | null)?.trim() || null;
  const integrationId = (formData.get("integration_id") as string | null)?.trim();
  const returnToRaw = (formData.get("return_to") as string | null)?.trim();
  const returnTo =
    returnToRaw && returnToRaw.startsWith("/dashboard/")
      ? returnToRaw
      : "/dashboard/regnskap";

  if (!integrationId) {
    redirect(`${returnTo}?error=Mangler+integrasjons-ID`);
  }

  // Verifiser at integrasjonen tilhører firmaet og er aktiv.
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from("company_integrations")
    .select("id, provider, status")
    .eq("id", integrationId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (!integration) {
    redirect(`${returnTo}?error=Ingen+aktiv+integrasjon+funnet`);
  }

  // Unngå duplikate aktive jobber for samme ordre/integrasjon.
  if (orderId) {
    const { data: existingJob } = await admin
      .from("erp_sync_jobs")
      .select("id")
      .eq("company_id", companyId)
      .eq("integration_id", integration.id)
      .eq("order_id", orderId)
      .in("status", ["queued", "processing", "retry_wait"])
      .maybeSingle();

    if (existingJob) {
      redirect(`${returnTo}?success=Synkjobb+finnes+allerede+i+k%C3%B8`);
    }
  }

  const { error } = await admin.from("erp_sync_jobs").insert({
    company_id: companyId,
    integration_id: integration.id,
    provider: integration.provider,
    order_id: orderId,
    status: "queued",
    retry_count: 0,
    max_retries: 3,
  });

  if (error) {
    redirect(
      `${returnTo}?error=Kø-feil%3A+${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/dashboard/regnskap");
  if (orderId) {
    revalidatePath(`/dashboard/ordre/${orderId}`);
  }
  redirect(`${returnTo}?success=Synkjobb+lagt+i+k%C3%B8`);
}
