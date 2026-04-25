"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

type OrderType = "bolig" | "maritim" | "kompleks";
type OrderStatus = "active" | "finished" | "archived" | "awaiting_installer" | "approved" | "rejected";

const ORDER_TYPES = new Set<OrderType>(["bolig", "maritim", "kompleks"]);
const ORDER_STATUSES = new Set<OrderStatus>([
  "active",
  "finished",
  "archived",
  "awaiting_installer",
  "approved",
  "rejected",
]);

const REQUIRED_DOC_SECTIONS: Record<OrderType, string[]> = {
  bolig: ["sjekkliste-bolig", "samsvar-bolig"],
  maritim: ["sjekkliste-maritim", "samsvar-maritim", "sikkerhet-maritim"],
  kompleks: ["sjekkliste-kompleks", "samsvar-kompleks", "sluttrapport-kompleks"],
};

type ProfileContext = {
  userId: string;
  companyId: string;
  role: string;
  adminClient: ReturnType<typeof createAdminClient>;
};

function orderPath(orderId: string): string {
  return `/dashboard/ordre/${orderId}`;
}

function toMapsQuery(address: string): string {
  const trimmed = address.trim();
  return trimmed ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}` : "";
}

async function requireContext(): Promise<ProfileContext> {
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
  if (!profile?.company_id) redirect("/onboarding");

  return {
    userId: user.id,
    companyId: profile.company_id,
    role: profile.role,
    adminClient: createAdminClient(),
  };
}

async function requireAdminContext(): Promise<ProfileContext> {
  const context = await requireContext();
  if (!isAdminRole(context.role)) {
    redirect("/dashboard/ordre?error=Du+har+ikke+tilgang");
  }
  return context;
}

async function ensureOrderInCompany(
  adminClient: ReturnType<typeof createAdminClient>,
  companyId: string,
  orderId: string,
) {
  const { data, error } = await adminClient
    .from("orders")
    .select("id, type, status, company_id")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Ordre ikke funnet" };
  return { ok: true as const, data: data as { id: string; type: OrderType; status: OrderStatus; company_id: string } };
}

async function isRiskCompleted(
  adminClient: ReturnType<typeof createAdminClient>,
  orderId: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("order_risk_assessments")
    .select("is_completed")
    .eq("order_id", orderId)
    .maybeSingle();
  const row = data as { is_completed: boolean } | null;
  return Boolean(row?.is_completed);
}

async function areRequiredDocsCompleted(
  adminClient: ReturnType<typeof createAdminClient>,
  orderId: string,
  type: OrderType,
): Promise<boolean> {
  const required = REQUIRED_DOC_SECTIONS[type] ?? [];
  if (required.length === 0) return true;

  const { data } = await adminClient
    .from("order_documentation")
    .select("section_key, is_completed")
    .eq("order_id", orderId)
    .eq("template_type", type)
    .in("section_key", required);

  const rows = (data ?? []) as { section_key: string; is_completed: boolean }[];
  const done = new Set(rows.filter((r) => r.is_completed).map((r) => r.section_key));
  return required.every((section) => done.has(section));
}

export async function createOrder(formData: FormData) {
  const { adminClient, companyId, userId } = await requireAdminContext();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "").trim();
  const assignedInstallerIdRaw = String(formData.get("assigned_installer_id") ?? "").trim();

  if (!title) redirect("/dashboard/ordre?error=Mangler+tittel");
  if (!customerId) redirect("/dashboard/ordre?error=Velg+kunde");
  if (!ORDER_TYPES.has(typeRaw as OrderType)) redirect("/dashboard/ordre?error=Ugyldig+ordretype");

  const type = typeRaw as OrderType;

  const { data: customerData } = await adminClient
    .from("order_customers")
    .select("id")
    .eq("id", customerId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!customerData) redirect("/dashboard/ordre?error=Kunde+ikke+funnet");

  let assignedInstallerId: string | null = null;
  if (assignedInstallerIdRaw) {
    const { data: installerData } = await adminClient
      .from("profiles")
      .select("id, role, company_id")
      .eq("id", assignedInstallerIdRaw)
      .eq("company_id", companyId)
      .maybeSingle();
    const installer = installerData as { id: string; role: string; company_id: string } | null;
    if (!installer || installer.role !== "installator") {
      redirect("/dashboard/ordre?error=Velg+en+gyldig+installatør");
    }
    assignedInstallerId = installer.id;
  }

  const { data: created, error } = await adminClient
    .from("orders")
    .insert({
      company_id: companyId,
      customer_id: customerId,
      title,
      description: description || null,
      type,
      status: "active",
      created_by: userId,
      assigned_installer_id: assignedInstallerId,
    })
    .select("id")
    .single();

  if (error || !created) redirect(`/dashboard/ordre?error=${encodeURIComponent(error?.message ?? "Kunne+ikke+opprette+ordre")}`);

  const createdOrder = created as { id: string };
  revalidatePath("/dashboard/ordre");
  redirect(`${orderPath(createdOrder.id)}?success=created`);
}

export async function updateOrderStatus(formData: FormData) {
  const { adminClient, companyId } = await requireAdminContext();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  if (!orderId || !ORDER_STATUSES.has(statusRaw as OrderStatus)) {
    redirect("/dashboard/ordre?error=Ugyldig+status");
  }

  const check = await ensureOrderInCompany(adminClient, companyId, orderId);
  if (!check.ok) redirect(`/dashboard/ordre?error=${encodeURIComponent(check.error)}`);

  const { error } = await adminClient
    .from("orders")
    .update({ status: statusRaw as OrderStatus })
    .eq("id", orderId)
    .eq("company_id", companyId);

  if (error) redirect(`${orderPath(orderId)}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/dashboard/ordre");
  revalidatePath(orderPath(orderId));
  redirect(`${orderPath(orderId)}?success=status-updated`);
}

export async function saveRiskAssessment(formData: FormData) {
  const { adminClient, companyId, userId } = await requireAdminContext();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const payloadRaw = String(formData.get("payload_json") ?? "{}");
  const complete = String(formData.get("complete") ?? "0") === "1";

  const check = await ensureOrderInCompany(adminClient, companyId, orderId);
  if (!check.ok) redirect(`/dashboard/ordre?error=${encodeURIComponent(check.error)}`);

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(payloadRaw) as Record<string, unknown>;
  } catch {
    redirect(`${orderPath(orderId)}?error=Ugyldig+risikovurdering+JSON`);
  }

  const { error } = await adminClient
    .from("order_risk_assessments")
    .upsert(
      {
        order_id: orderId,
        template_type: check.data.type,
        payload,
        is_completed: complete,
        completed_at: complete ? new Date().toISOString() : null,
        completed_by: complete ? userId : null,
      },
      { onConflict: "order_id" },
    );

  if (error) redirect(`${orderPath(orderId)}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(orderPath(orderId));
  redirect(`${orderPath(orderId)}?success=risk-saved`);
}

export async function saveDocumentationSection(formData: FormData) {
  const { adminClient, companyId } = await requireAdminContext();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const sectionKey = String(formData.get("section_key") ?? "").trim();
  const payloadRaw = String(formData.get("payload_json") ?? "{}");
  const complete = String(formData.get("complete") ?? "0") === "1";
  if (!orderId || !sectionKey) redirect("/dashboard/ordre?error=Mangler+dokumentasjonsdata");

  const check = await ensureOrderInCompany(adminClient, companyId, orderId);
  if (!check.ok) redirect(`/dashboard/ordre?error=${encodeURIComponent(check.error)}`);

  const riskDone = await isRiskCompleted(adminClient, orderId);
  if (!riskDone) redirect(`${orderPath(orderId)}?error=Fullfør+risikovurdering+først`);

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(payloadRaw) as Record<string, unknown>;
  } catch {
    redirect(`${orderPath(orderId)}?error=Ugyldig+dokumentasjon+JSON`);
  }

  const { error } = await adminClient
    .from("order_documentation")
    .upsert(
      {
        order_id: orderId,
        section_key: sectionKey,
        template_type: check.data.type,
        payload,
        is_completed: complete,
      },
      { onConflict: "order_id,section_key" },
    );

  if (error) redirect(`${orderPath(orderId)}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(orderPath(orderId));
  redirect(`${orderPath(orderId)}?success=doc-saved`);
}

export async function addOrderHour(formData: FormData) {
  const { adminClient, companyId, userId } = await requireAdminContext();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const workDate = String(formData.get("work_date") ?? "").trim();
  const minutes = Number(String(formData.get("minutes") ?? "0").trim());
  const note = String(formData.get("note") ?? "").trim();

  const check = await ensureOrderInCompany(adminClient, companyId, orderId);
  if (!check.ok) redirect(`/dashboard/ordre?error=${encodeURIComponent(check.error)}`);
  if (!workDate || !Number.isFinite(minutes) || minutes <= 0) {
    redirect(`${orderPath(orderId)}?error=Ugyldig+timeføring`);
  }

  const riskDone = await isRiskCompleted(adminClient, orderId);
  if (!riskDone) redirect(`${orderPath(orderId)}?error=Fullfør+risikovurdering+først`);

  const { error } = await adminClient.from("order_hours").insert({
    order_id: orderId,
    user_id: userId,
    work_date: workDate,
    minutes,
    note: note || null,
  });

  if (error) redirect(`${orderPath(orderId)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(orderPath(orderId));
  redirect(`${orderPath(orderId)}?success=hours-added`);
}

export async function addOrderMaterial(formData: FormData) {
  const { adminClient, companyId } = await requireAdminContext();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "stk").trim() || "stk";
  const quantity = Number(String(formData.get("quantity") ?? "0").trim());
  const note = String(formData.get("note") ?? "").trim();
  const warehouseItemIdRaw = String(formData.get("warehouse_item_id") ?? "").trim();

  const check = await ensureOrderInCompany(adminClient, companyId, orderId);
  if (!check.ok) redirect(`/dashboard/ordre?error=${encodeURIComponent(check.error)}`);
  if (!name || !Number.isFinite(quantity) || quantity <= 0) {
    redirect(`${orderPath(orderId)}?error=Ugyldig+materialføring`);
  }

  const riskDone = await isRiskCompleted(adminClient, orderId);
  if (!riskDone) redirect(`${orderPath(orderId)}?error=Fullfør+risikovurdering+først`);

  const { error } = await adminClient.from("order_materials").insert({
    order_id: orderId,
    warehouse_item_id: warehouseItemIdRaw || null,
    name,
    unit,
    quantity,
    note: note || null,
  });

  if (error) redirect(`${orderPath(orderId)}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(orderPath(orderId));
  redirect(`${orderPath(orderId)}?success=materials-added`);
}

export async function submitOrderForInstaller(formData: FormData) {
  const { adminClient, companyId, userId } = await requireAdminContext();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const installerUserId = String(formData.get("installer_user_id") ?? "").trim();
  if (!orderId || !installerUserId) redirect("/dashboard/ordre?error=Mangler+ordre+eller+installatør");

  const check = await ensureOrderInCompany(adminClient, companyId, orderId);
  if (!check.ok) redirect(`/dashboard/ordre?error=${encodeURIComponent(check.error)}`);

  const riskDone = await isRiskCompleted(adminClient, orderId);
  if (!riskDone) redirect(`${orderPath(orderId)}?error=Risikovurdering+må+fullføres`);

  const docsDone = await areRequiredDocsCompleted(adminClient, orderId, check.data.type);
  if (!docsDone) redirect(`${orderPath(orderId)}?error=Alle+påkrevde+dokumentseksjoner+må+fullføres`);

  const { data: installerData } = await adminClient
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", installerUserId)
    .eq("company_id", companyId)
    .maybeSingle();
  const installer = installerData as { id: string; role: string; company_id: string } | null;
  if (!installer || installer.role !== "installator") {
    redirect(`${orderPath(orderId)}?error=Installatør+ikke+funnet`);
  }

  const { error: inboxError } = await adminClient.from("installer_inbox_items").insert({
    order_id: orderId,
    installer_user_id: installer.id,
    status: "pending",
    submitted_by: userId,
    submitted_at: new Date().toISOString(),
  });
  if (inboxError) redirect(`${orderPath(orderId)}?error=${encodeURIComponent(inboxError.message)}`);

  const { error: updateError } = await adminClient
    .from("orders")
    .update({ status: "awaiting_installer", assigned_installer_id: installer.id })
    .eq("id", orderId)
    .eq("company_id", companyId);
  if (updateError) redirect(`${orderPath(orderId)}?error=${encodeURIComponent(updateError.message)}`);

  revalidatePath(orderPath(orderId));
  revalidatePath("/dashboard/installator/inbox");
  redirect(`${orderPath(orderId)}?success=sent-to-installer`);
}

export async function installerDecideOrder(formData: FormData) {
  const { adminClient, companyId, userId, role } = await requireContext();
  const inboxItemId = String(formData.get("inbox_item_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const decisionNote = String(formData.get("decision_note") ?? "").trim();
  if (!inboxItemId || (decision !== "approved" && decision !== "rejected")) {
    redirect("/dashboard/installator/inbox?error=Ugyldig+beslutning");
  }

  if (role !== "installator" && !isAdminRole(role)) {
    redirect("/dashboard/installator/inbox?error=Du+har+ikke+tilgang");
  }

  const { data: inboxData, error: inboxErr } = await adminClient
    .from("installer_inbox_items")
    .select("id, order_id, installer_user_id, status, orders!inner(company_id)")
    .eq("id", inboxItemId)
    .maybeSingle();
  if (inboxErr || !inboxData) {
    redirect(`/dashboard/installator/inbox?error=${encodeURIComponent(inboxErr?.message ?? "Innboksoppføring+ikke+funnet")}`);
  }

  const inbox = inboxData as {
    id: string;
    order_id: string;
    installer_user_id: string;
    status: string;
    orders: { company_id: string }[] | null;
  };
  const ownerCompanyId = inbox.orders?.[0]?.company_id ?? null;
  if (ownerCompanyId !== companyId) {
    redirect("/dashboard/installator/inbox?error=Ordren+tilhører+ikke+firmaet");
  }
  if (role === "installator" && inbox.installer_user_id !== userId) {
    redirect("/dashboard/installator/inbox?error=Dette+er+ikke+din+oppgave");
  }
  if (inbox.status !== "pending") {
    redirect("/dashboard/installator/inbox?error=Oppgaven+er+allerede+behandlet");
  }

  const { error: updateInboxErr } = await adminClient
    .from("installer_inbox_items")
    .update({
      status: decision,
      decision_note: decisionNote || null,
      decision_at: new Date().toISOString(),
    })
    .eq("id", inbox.id);
  if (updateInboxErr) redirect(`/dashboard/installator/inbox?error=${encodeURIComponent(updateInboxErr.message)}`);

  const nextOrderStatus: OrderStatus = decision === "approved" ? "approved" : "rejected";
  const { error: updateOrderErr } = await adminClient
    .from("orders")
    .update({ status: nextOrderStatus })
    .eq("id", inbox.order_id)
    .eq("company_id", companyId);
  if (updateOrderErr) redirect(`/dashboard/installator/inbox?error=${encodeURIComponent(updateOrderErr.message)}`);

  revalidatePath("/dashboard/installator/inbox");
  revalidatePath(orderPath(inbox.order_id));
  redirect("/dashboard/installator/inbox?success=decision-saved");
}

export async function createCustomerInline(formData: FormData) {
  const { adminClient, companyId, userId } = await requireAdminContext();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  if (!name) redirect("/dashboard/ordre?error=Kundenavn+er+påkrevd");

  const { error } = await adminClient.from("order_customers").insert({
    company_id: companyId,
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
    maps_query: address ? toMapsQuery(address) : null,
    created_by: userId,
  });
  if (error) redirect(`/dashboard/ordre?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/dashboard/ordre");
  revalidatePath("/dashboard/kunder");
  redirect("/dashboard/ordre?success=customer-created");
}
