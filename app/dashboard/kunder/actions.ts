"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

function toMapsQuery(address: string): string {
  const trimmed = address.trim();
  return trimmed ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}` : "";
}

async function requireAdminContext() {
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
  if (!isAdminRole(profile.role)) redirect("/dashboard/kunder?error=Du+har+ikke+tilgang");

  return {
    userId: user.id,
    companyId: profile.company_id,
    adminClient: createAdminClient(),
  };
}

export async function createCustomer(formData: FormData) {
  const { adminClient, companyId, userId } = await requireAdminContext();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) redirect("/dashboard/kunder?error=Kundenavn+er+påkrevd");

  const { error } = await adminClient.from("order_customers").insert({
    company_id: companyId,
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
    maps_query: address ? toMapsQuery(address) : null,
    created_by: userId,
  });
  if (error) redirect(`/dashboard/kunder?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/dashboard/kunder");
  revalidatePath("/dashboard/ordre");
  redirect("/dashboard/kunder?success=created");
}

export async function updateCustomer(formData: FormData) {
  const { adminClient, companyId } = await requireAdminContext();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!customerId || !name) redirect("/dashboard/kunder?error=Mangler+data");

  const { error } = await adminClient
    .from("order_customers")
    .update({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      maps_query: address ? toMapsQuery(address) : null,
    })
    .eq("id", customerId)
    .eq("company_id", companyId);

  if (error) redirect(`/dashboard/kunder?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard/kunder");
  revalidatePath("/dashboard/ordre");
  redirect("/dashboard/kunder?success=updated");
}
