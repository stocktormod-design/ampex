// Provider-uavhengig domenekontrakt for ERP-integrasjon.
// Ingen adapter-kode her — kun typer og interface.

export type ErpProvider = "fiken" | "tripletex";

export type IntegrationStatus = "active" | "inactive" | "error";

// Utvidet statussett: 'queued'/'processing'/'retry_wait' er nye verdier fra v2-migrasjonen.
// 'pending'/'running' beholdes for bakoverkompatibilitet med eksisterende rader.
export type SyncJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "retry_wait"
  | "pending"
  | "running";

export type LastSyncStatus = "completed" | "failed" | "partial";

// ── Credentials per leverandør ────────────────────────────────────────────
// Disse lagres kryptert i Vault — aldri i klartekst i databasen.

export type FikenCredentials = {
  accessToken: string;
};

export type TripletexCredentials = {
  consumerToken: string;
  employeeToken: string;
};

export type ErpCredentials =
  | ({ provider: "fiken" } & FikenCredentials)
  | ({ provider: "tripletex" } & TripletexCredentials);

// ── Auth-metadata (ikke-sensitiv del) ────────────────────────────────────
// Lagres i klartekst i company_integrations.auth_meta.
// Secrets lagres i Vault og refereres via auth_secret_ref.

export type FikenAuthMeta = {
  companySlug: string;
};

export type TripletexAuthMeta = Record<string, never>; // ingen offentlig metadata for Tripletex

export type IntegrationAuthMeta = FikenAuthMeta | TripletexAuthMeta | Record<string, string>;

// ── Fakturagrunnlag-payload ────────────────────────────────────────────────
// Ordre er alltid source of truth; dette er den normaliserte eksportformen.

export type InvoiceBasisCustomer = {
  localId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export type InvoiceBasisHourLine = {
  localId: string;
  workerName: string;
  workDate: string; // ISO-8601 date string
  minutes: number;
  note: string | null;
};

export type InvoiceBasisMaterialLine = {
  localId: string;
  name: string;
  unit: string;
  quantity: number;
  note: string | null;
};

export type InvoiceBasisPayload = {
  orderId: string;
  orderTitle: string;
  orderType: "bolig" | "maritim" | "kompleks";
  customer: InvoiceBasisCustomer;
  hours: InvoiceBasisHourLine[];
  materials: InvoiceBasisMaterialLine[];
};

// ── Synkresultat ───────────────────────────────────────────────────────────

export type SyncResult =
  | { ok: true; providerId: string }
  | { ok: false; error: string; retryable: boolean };

// ── Visningstyper for Regnskap-siden ──────────────────────────────────────

export type IntegrationStatusRow = {
  id: string;
  provider: ErpProvider;
  status: IntegrationStatus;
  auth_meta: Record<string, string>;
  auth_secret_ref: string | null;
  last_sync_at: string | null;
  last_sync_status: LastSyncStatus | null;
  last_sync_error: string | null;
  created_at: string;
};

export type SyncJobRow = {
  id: string;
  status: SyncJobStatus;
  created_at: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_retry_at: string | null;
  order_id: string | null;
  orders: { title: string } | null;
};

// ── Provider-interface ─────────────────────────────────────────────────────
// Hvert adapter implementerer dette grensesnittet.
// UI kaller aldri adaptere direkte — kun via use-cases/server actions.

export interface IntegrationProvider {
  readonly provider: ErpProvider;
  syncInvoiceBasis(
    payload: InvoiceBasisPayload,
    credentials: Record<string, string>,
  ): Promise<SyncResult>;
}
