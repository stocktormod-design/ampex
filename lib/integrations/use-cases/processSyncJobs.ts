import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { syncInvoiceBasis } from "./syncInvoiceBasis";
import type { InvoiceBasisPayload } from "../types";

type ClaimedJobRow = {
  job_id: string;
  integration_id: string;
  company_id: string;
  provider: string;
  order_id: string | null;
  retry_count: number;
  max_retries: number;
};

const BACKOFF_MINUTES = [1, 5, 15, 60];

function calculateNextRetryAt(retryCountAfterFailure: number): string {
  const index = Math.max(0, Math.min(retryCountAfterFailure - 1, BACKOFF_MINUTES.length - 1));
  const minutes = BACKOFF_MINUTES[index];
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function loadInvoiceBasisPayload(
  companyId: string,
  orderId: string,
): Promise<InvoiceBasisPayload | null> {
  const admin = createAdminClient();

  const { data: orderData, error: orderError } = await admin
    .from("orders")
    .select(`
      id,
      title,
      type,
      order_customers (
        id,
        name,
        phone,
        email,
        address
      )
    `)
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (orderError || !orderData) {
    return null;
  }

  const order = orderData as {
    id: string;
    title: string;
    type: "bolig" | "maritim" | "kompleks";
    order_customers:
      | { id: string; name: string; phone: string | null; email: string | null; address: string | null }[]
      | { id: string; name: string; phone: string | null; email: string | null; address: string | null }
      | null;
  };

  const customer = Array.isArray(order.order_customers)
    ? order.order_customers[0] ?? null
    : order.order_customers;

  if (!customer) {
    return null;
  }

  const [{ data: hoursData }, { data: materialsData }] = await Promise.all([
    admin
      .from("order_hours")
      .select("id, work_date, minutes, note, profiles(full_name)")
      .eq("order_id", order.id)
      .order("work_date", { ascending: true }),
    admin
      .from("order_materials")
      .select("id, name, unit, quantity, note")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
  ]);

  const hours = ((hoursData ?? []) as unknown as {
    id: string;
    work_date: string;
    minutes: number;
    note: string | null;
    profiles: { full_name: string | null }[] | null;
  }[]).map((row) => ({
    localId: row.id,
    workerName: row.profiles?.[0]?.full_name?.trim() || "Ukjent bruker",
    workDate: row.work_date,
    minutes: row.minutes,
    note: row.note,
  }));

  const materials = (materialsData ?? []) as {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    note: string | null;
  }[];

  return {
    orderId: order.id,
    orderTitle: order.title,
    orderType: order.type,
    customer: {
      localId: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    },
    hours,
    materials: materials.map((row) => ({
      localId: row.id,
      name: row.name,
      unit: row.unit,
      quantity: Number(row.quantity),
      note: row.note,
    })),
  };
}

export async function runErpSyncWorkerOnce() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_sync_job");

  if (error) {
    return { processed: false as const, reason: `claim-failed:${error.message}` };
  }

  const row = ((Array.isArray(data) ? data[0] : data) ?? null) as ClaimedJobRow | null;
  if (!row) {
    return { processed: false as const, reason: "no-jobs" };
  }

  const markIntegrationSync = async (status: "completed" | "failed", lastError: string | null) => {
    await admin
      .from("company_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: status,
        last_sync_error: lastError,
      })
      .eq("id", row.integration_id);
  };

  if (!row.order_id) {
    const message = "Jobb mangler order_id og kan ikke behandles.";
    await admin
      .from("erp_sync_jobs")
      .update({
        status: "failed",
        last_error: message,
        finished_at: new Date().toISOString(),
        next_retry_at: null,
      })
      .eq("id", row.job_id);
    await markIntegrationSync("failed", message);
    return { processed: true as const, jobId: row.job_id, status: "failed" as const };
  }

  const payload = await loadInvoiceBasisPayload(row.company_id, row.order_id);
  if (!payload) {
    const message = "Kunne ikke bygge fakturagrunnlag for ordren.";
    await admin
      .from("erp_sync_jobs")
      .update({
        status: "failed",
        last_error: message,
        finished_at: new Date().toISOString(),
        next_retry_at: null,
      })
      .eq("id", row.job_id);
    await markIntegrationSync("failed", message);
    return { processed: true as const, jobId: row.job_id, status: "failed" as const };
  }

  const result = await syncInvoiceBasis(row.company_id, payload, row.integration_id);
  if (result.ok) {
    await admin
      .from("erp_sync_jobs")
      .update({
        status: "completed",
        last_error: null,
        next_retry_at: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", row.job_id);
    await markIntegrationSync("completed", null);
    return { processed: true as const, jobId: row.job_id, status: "completed" as const };
  }

  const nextRetryCount = row.retry_count + 1;
  const shouldRetry = result.retryable && nextRetryCount < row.max_retries;
  const nextRetryAt = shouldRetry ? calculateNextRetryAt(nextRetryCount) : null;

  await admin
    .from("erp_sync_jobs")
    .update({
      status: shouldRetry ? "retry_wait" : "failed",
      retry_count: nextRetryCount,
      last_error: result.error,
      next_retry_at: nextRetryAt,
      finished_at: shouldRetry ? null : new Date().toISOString(),
    })
    .eq("id", row.job_id);

  await markIntegrationSync("failed", result.error);
  return {
    processed: true as const,
    jobId: row.job_id,
    status: shouldRetry ? ("retry_wait" as const) : ("failed" as const),
    retryCount: nextRetryCount,
    nextRetryAt,
  };
}

