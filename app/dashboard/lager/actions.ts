"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

async function requireCompanyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }
  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { company_id: string | null; role: string } | null;
  if (!profile?.company_id || !isAdminRole(profile.role)) {
    redirect("/dashboard");
  }
  return { supabase, companyId: profile.company_id };
}

export async function createWarehouse(formData: FormData) {
  const { supabase, companyId } = await requireCompanyAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();

  if (!name) {
    redirect(`/dashboard/lager?error=${encodeURIComponent("Navn på lager er påkrevd")}`);
  }

  const { data, error } = await supabase
    .from("warehouses")
    .insert({
      company_id: companyId,
      name,
      location: location || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/dashboard/lager?error=${encodeURIComponent(error?.message ?? "Klarte ikke opprette lager")}`);
  }

  revalidatePath("/dashboard/lager");
  redirect(`/dashboard/lager/${(data as { id: string }).id}`);
}

export async function lookupBarcode(warehouseId: string, rawBarcode: string) {
  const { supabase, companyId } = await requireCompanyAdmin();
  const barcode = rawBarcode.trim();
  if (!barcode) {
    return { ok: false as const, error: "Strekkode kan ikke være tom" };
  }

  const { data: wh } = await supabase
    .from("warehouses")
    .select("id")
    .eq("id", warehouseId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!wh) {
    return { ok: false as const, error: "Lager ikke funnet" };
  }

  const { data: item } = await supabase
    .from("warehouse_items")
    .select("id, name")
    .eq("warehouse_id", warehouseId)
    .eq("barcode", barcode)
    .maybeSingle();

  return {
    ok: true as const,
    found: Boolean(item),
    name: (item as { name?: string } | null)?.name ?? null,
  };
}

export async function registerWarehouseItem(warehouseId: string, rawBarcode: string, rawName: string) {
  const { supabase, companyId } = await requireCompanyAdmin();
  const barcode = rawBarcode.trim();
  const name = rawName.trim();
  if (!barcode || !name) {
    return { ok: false as const, error: "Strekkode og navn er påkrevd" };
  }

  const { data: wh } = await supabase
    .from("warehouses")
    .select("id")
    .eq("id", warehouseId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!wh) {
    return { ok: false as const, error: "Lager ikke funnet" };
  }

  const { error } = await supabase.from("warehouse_items").insert({
    warehouse_id: warehouseId,
    barcode,
    name,
    quantity: 0,
    unit: "stk",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false as const, error: "Denne strekkoden er allerede registrert i dette lageret." };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/dashboard/lager/${warehouseId}`);
  return { ok: true as const };
}
