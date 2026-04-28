import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ErpProvider, InvoiceBasisPayload, IntegrationProvider, SyncResult } from "../types";
import { fikenAdapter } from "../adapters/fikenAdapter";
import { tripletexAdapter } from "../adapters/tripletexAdapter";

const ADAPTERS: Record<ErpProvider, IntegrationProvider> = {
  fiken: fikenAdapter,
  tripletex: tripletexAdapter,
};

/**
 * Sender fakturagrunnlag til selskapets aktive ERP-integrasjon.
 * Kalles kun fra server actions — aldri direkte fra klient.
 * Credentials leses fra Vault via auth_secret_ref.
 */
export async function syncInvoiceBasis(
  companyId: string,
  payload: InvoiceBasisPayload,
  integrationId?: string,
): Promise<SyncResult> {
  const admin = createAdminClient();

  const query = admin
    .from("company_integrations")
    .select("id, provider, auth_secret_ref, status")
    .eq("company_id", companyId)
    .eq("status", "active");

  const { data: integration, error } = integrationId
    ? await query.eq("id", integrationId).maybeSingle()
    : await query.maybeSingle();

  if (error || !integration) {
    return {
      ok: false,
      error: "Ingen aktiv ERP-integrasjon funnet for dette selskapet.",
      retryable: false,
    };
  }

  if (!integration.auth_secret_ref) {
    return {
      ok: false,
      error: "Integrasjonen mangler credentials (auth_secret_ref er null).",
      retryable: false,
    };
  }

  // Hent dekrypterte credentials fra Vault (kun tilgjengelig for service role).
  const { data: secretJson, error: vaultError } = await admin.rpc(
    "vault_get_integration_secret",
    { p_id: integration.auth_secret_ref },
  );

  if (vaultError || !secretJson) {
    return {
      ok: false,
      error: "Kunne ikke lese integrasjonscredentials fra Vault.",
      retryable: true,
    };
  }

  const credentials = JSON.parse(secretJson as string) as Record<string, string>;

  const provider = integration.provider as ErpProvider;
  const adapter = ADAPTERS[provider];

  if (!adapter) {
    return {
      ok: false,
      error: `Ukjent ERP-leverandør: ${provider}`,
      retryable: false,
    };
  }

  return adapter.syncInvoiceBasis(payload, credentials);
}
