import type {
  ErpProvider,
  IntegrationAuthMeta,
  InvoiceBasisPayload,
  IntegrationProvider,
  SyncResult,
} from "../types";

// TODO: Implementer Tripletex API-integrasjon
// Dokumentasjon: https://tripletex.no/v2/swagger
// Nøkkelendepunkter:
//   PUT /invoice                → opprett faktura med linjer
//   PUT /customer               → opprett/finn kunde
// auth_meta forventer: { consumerToken: string, employeeToken: string }

export const tripletexAdapter: IntegrationProvider = {
  provider: "tripletex" satisfies ErpProvider,

  async syncInvoiceBasis(
    payload: InvoiceBasisPayload,
    authMeta: IntegrationAuthMeta,
  ): Promise<SyncResult> {
    // TODO: Implementer Tripletex API-kall. Params brukes ikke ennå (stub).
    void payload;
    void authMeta;
    return {
      ok: false,
      error: "Tripletex-integrasjon er ikke implementert ennå.",
      retryable: false,
    };
  },
};
