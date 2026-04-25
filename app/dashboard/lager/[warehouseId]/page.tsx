import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { BarcodeRegister } from "@/app/dashboard/lager/[warehouseId]/barcode-register";
import { WarehouseItemEdit } from "@/app/dashboard/lager/[warehouseId]/warehouse-item-edit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { QuickAdjust } from "@/app/dashboard/lager/[warehouseId]/quick-adjust";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ warehouseId: string }> | { warehouseId: string };
  searchParams?: { q?: string };
};


export default async function WarehouseDetailPage({ params, searchParams }: PageProps) {
  const { warehouseId } = params instanceof Promise ? await params : params;
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

  if (!profile?.company_id) {
    redirect("/onboarding");
  }

  if (!isAdminRole(profile.role)) {
    redirect("/dashboard");
  }

  const { data: warehouseData } = await supabase
    .from("warehouses")
    .select("id, name, location")
    .eq("id", warehouseId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  const warehouse = warehouseData as { id: string; name: string; location: string | null } | null;

  if (!warehouse) {
    redirect("/dashboard/lager");
  }

  const { data: items } = await supabase
    .from("warehouse_items")
    .select("id, name, quantity, unit, updated_at, warehouse_item_barcodes(id, barcode, created_at)")
    .eq("warehouse_id", warehouse.id)
    .order("name", { ascending: true });

  type RawItem = {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    updated_at: string;
    warehouse_item_barcodes: { id: string; barcode: string; created_at: string }[] | null;
  };

  const allItemRows = (items ?? []).map((row) => {
    const r = row as RawItem;
    const codes = [...(r.warehouse_item_barcodes ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return {
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      unit: r.unit,
      updated_at: r.updated_at,
      barcodes: codes.map((c) => c.barcode),
    };
  });

  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const itemRows = q
    ? allItemRows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.barcodes.some((b) => b.toLowerCase().includes(q)),
      )
    : allItemRows;

  const emptyCount = allItemRows.filter((r) => r.quantity <= 0).length;
  const lowCount = allItemRows.filter((r) => r.quantity > 0 && r.quantity <= 5).length;

  return (
    <main className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard/lager"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Lager
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{warehouse.name}</h1>
            {warehouse.location ? (
              <p className="text-sm text-muted-foreground">{warehouse.location}</p>
            ) : null}
          </div>
          {/* Stock summary badges */}
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {emptyCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="size-3" aria-hidden />
                {emptyCount} tomt
              </span>
            )}
            {lowCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertTriangle className="size-3" aria-hidden />
                {lowCount} lavt
              </span>
            )}
          </div>
        </div>
      </div>

      <BarcodeRegister warehouseId={warehouse.id} />

      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Varer</CardTitle>
              <CardDescription>
                {allItemRows.length} varer totalt. Bruk «Rediger» for strekkoder, navn, antall og enhet.
              </CardDescription>
            </div>
          </div>
          {/* Search */}
          {allItemRows.length > 5 && (
            <form method="get" className="mt-3 flex gap-2">
              <NativeInput
                name="q"
                defaultValue={searchParams?.q ?? ""}
                placeholder="Søk på navn eller strekkode..."
                className="flex-1"
              />
              <SubmitButton variant="outline" className="shrink-0">Søk</SubmitButton>
              {q && (
                <Link
                  href={`/dashboard/lager/${warehouseId}`}
                  className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  Nullstill
                </Link>
              )}
            </form>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {itemRows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">
              {q ? "Ingen varer matcher søket." : "Ingen varer ennå."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">Strekkode</th>
                    <th className="px-4 py-2">Navn</th>
                    <th className="px-4 py-2 text-right">Antall</th>
                    <th className="px-4 py-2 text-right">Handling</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-muted/30 ${row.quantity <= 0 ? "bg-red-50/30 dark:bg-red-950/10" : row.quantity <= 5 ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                    >
                      <td className="max-w-[14rem] px-4 py-2 font-mono text-xs break-all text-muted-foreground">
                        {row.barcodes.length > 0 ? row.barcodes.join(" · ") : "—"}
                      </td>
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2 text-right">
                        <QuickAdjust
                          warehouseId={warehouse.id}
                          itemId={row.id}
                          initialQuantity={row.quantity}
                          unit={row.unit}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <WarehouseItemEdit warehouseId={warehouse.id} item={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
