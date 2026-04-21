import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { BarcodeRegister } from "@/app/dashboard/lager/[warehouseId]/barcode-register";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ warehouseId: string }> | { warehouseId: string };
};

export default async function WarehouseDetailPage({ params }: PageProps) {
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
    .select("id, barcode, name, quantity, unit, updated_at")
    .eq("warehouse_id", warehouse.id)
    .order("name", { ascending: true });

  const itemRows = (items ?? []) as {
    id: string;
    barcode: string | null;
    name: string;
    quantity: number;
    unit: string;
    updated_at: string;
  }[];

  return (
    <main className="space-y-8">
      <div className="flex flex-col gap-2">
        <Link href="/dashboard/lager" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          ← Tilbake til lager
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{warehouse.name}</h1>
        {warehouse.location ? (
          <p className="text-sm text-muted-foreground">{warehouse.location}</p>
        ) : null}
      </div>

      <BarcodeRegister warehouseId={warehouse.id} />

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Varer</CardTitle>
          <CardDescription>Alle registrerte varer i dette lageret.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {itemRows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">Ingen varer enna.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">Strekkode</th>
                    <th className="px-4 py-2">Navn</th>
                    <th className="px-4 py-2 text-right">Antall</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemRows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{row.barcode ?? "—"}</td>
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.quantity} {row.unit}
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
