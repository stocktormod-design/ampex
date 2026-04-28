import type {
  ErpProvider,
  IntegrationAuthMeta,
  InvoiceBasisPayload,
  IntegrationProvider,
  SyncResult,
} from "../types";

// TODO: Implementer Fiken API-integrasjon
// Dokumentasjon: https://api.fiken.no/api/v2/docs/
// Nøkkelendepunkter:
//   POST /companies/{companySlug}/invoices/drafts  → opprett fakturakladd
//   POST /companies/{companySlug}/contacts         → opprett/finn kunde
// auth_meta forventer: { companySlug: string, accessToken: string }

export const fikenAdapter: IntegrationProvider = {
  provider: "fiken" satisfies ErpProvider,

  async syncInvoiceBasis(
    payload: InvoiceBasisPayload,
    authMeta: IntegrationAuthMeta,
  ): Promise<SyncResult> {
    // TODO: Implementer Fiken API-kall. Params brukes ikke ennå (stub).
    void payload;
    void authMeta;
    return {
      ok: false,
      error: "Fiken-integrasjon er ikke implementert ennå.",
      retryable: false,
    };
  },
};
