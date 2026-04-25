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

function normalizeBarcodeKey(s: string): string {
  return s.trim().toLowerCase();
}

function dedupeBarcodeList(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    const t = c.trim();
    if (!t) continue;
    const k = normalizeBarcodeKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
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

  const { data: rows, error } = await supabase.rpc("match_warehouse_barcode", {
    p_warehouse_id: warehouseId,
    p_code: barcode,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  const row = (rows as { item_id: string; item_name: string }[] | null)?.[0];

  return {
    ok: true as const,
    found: Boolean(row),
    name: row?.item_name ?? null,
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

  const { data: item, error: insErr } = await supabase
    .from("warehouse_items")
    .insert({
      warehouse_id: warehouseId,
      name,
      quantity: 0,
      unit: "stk",
    })
    .select("id")
    .single();

  if (insErr || !item) {
    return { ok: false as const, error: insErr?.message ?? "Klarte ikke opprette vare" };
  }

  const itemId = (item as { id: string }).id;

  const { error: bcErr } = await supabase.from("warehouse_item_barcodes").insert({
    warehouse_item_id: itemId,
    barcode,
  });

  if (bcErr) {
    await supabase.from("warehouse_items").delete().eq("id", itemId);
    if (bcErr.code === "23505") {
      return { ok: false as const, error: "Denne strekkoden er allerede registrert i dette lageret." };
    }
    return { ok: false as const, error: bcErr.message };
  }

  revalidatePath(`/dashboard/lager/${warehouseId}`);
  return { ok: true as const };
}

export async function updateWarehouseItem(
  warehouseId: string,
  itemId: string,
  raw: { barcodes: string[]; name: string; quantity: number; unit: string },
) {
  const { supabase, companyId } = await requireCompanyAdmin();
  const name = raw.name.trim();
  const unit = raw.unit.trim() || "stk";
  const barcodes = dedupeBarcodeList(raw.barcodes ?? []);

  if (!name) {
    return { ok: false as const, error: "Navn er påkrevd" };
  }
  if (!Number.isFinite(raw.quantity) || raw.quantity < 0) {
    return { ok: false as const, error: "Antall må være 0 eller høyere" };
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

  const { data: existing } = await supabase
    .from("warehouse_items")
    .select("id")
    .eq("id", itemId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (!existing) {
    return { ok: false as const, error: "Vare ikke funnet" };
  }

  const { error: updErr } = await supabase
    .from("warehouse_items")
    .update({
      name,
      quantity: Math.floor(raw.quantity),
      unit,
    })
    .eq("id", itemId)
    .eq("warehouse_id", warehouseId);

  if (updErr) {
    return { ok: false as const, error: updErr.message };
  }

  const { error: delErr } = await supabase.from("warehouse_item_barcodes").delete().eq("warehouse_item_id", itemId);

  if (delErr) {
    return { ok: false as const, error: delErr.message };
  }

  if (barcodes.length > 0) {
    const { error: insErr } = await supabase.from("warehouse_item_barcodes").insert(
      barcodes.map((b) => ({
        warehouse_item_id: itemId,
        barcode: b,
      })),
    );

    if (insErr) {
      if (insErr.code === "23505") {
        return { ok: false as const, error: "Én eller flere strekkoder er allerede i bruk i dette lageret." };
      }
      return { ok: false as const, error: insErr.message };
    }
  }

  revalidatePath(`/dashboard/lager/${warehouseId}`);
  return { ok: true as const };
}

export async function deleteWarehouseItem(warehouseId: string, itemId: string) {
  const { supabase, companyId } = await requireCompanyAdmin();

  const { data: wh } = await supabase
    .from("warehouses")
    .select("id")
    .eq("id", warehouseId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!wh) {
    return { ok: false as const, error: "Lager ikke funnet" };
  }

  const { error } = await supabase
    .from("warehouse_items")
    .delete()
    .eq("id", itemId)
    .eq("warehouse_id", warehouseId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/dashboard/lager/${warehouseId}`);
  return { ok: true as const };
}

export async function adjustItemQuantity(
  warehouseId: string,
  itemId: string,
  delta: number,
) {
  const { supabase, companyId } = await requireCompanyAdmin();

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
    .select("id, quantity")
    .eq("id", itemId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (!item) {
    return { ok: false as const, error: "Vare ikke funnet" };
  }

  const raw = item as { id: string; quantity: number };
  const newQty = Math.max(0, raw.quantity + delta);

  const { error } = await supabase
    .from("warehouse_items")
    .update({ quantity: newQty })
    .eq("id", itemId)
    .eq("warehouse_id", warehouseId);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath(`/dashboard/lager/${warehouseId}`);
  return { ok: true as const, newQuantity: newQty };
}
