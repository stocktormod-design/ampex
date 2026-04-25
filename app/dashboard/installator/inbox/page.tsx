import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { installerDecideOrder } from "@/app/dashboard/ordre/actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: { error?: string; success?: string };
};

export default async function InstallerInboxPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { company_id: string | null; role: string } | null;
  if (!profile?.company_id) redirect("/onboarding");
  if (profile.role !== "installator" && !isAdminRole(profile.role)) {
    redirect("/dashboard");
  }

  let query = supabase
    .from("installer_inbox_items")
    .select("id, order_id, status, submitted_at, decision_at, decision_note, orders!inner(id, title, type, status, company_id)")
    .eq("orders.company_id", profile.company_id)
    .order("submitted_at", { ascending: false });

  if (profile.role === "installator") {
    query = query.eq("installer_user_id", user.id);
  }
  const { data: inboxData } = await query;
  const rows = (inboxData ?? []) as {
    id: string;
    order_id: string;
    status: "pending" | "approved" | "rejected";
    submitted_at: string;
    decision_at: string | null;
    decision_note: string | null;
    orders: { id: string; title: string; type: string; status: string; company_id: string }[] | null;
  }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Installatør innboks</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{rows.filter((r) => r.status === "pending").length} venter på behandling</p>
      </div>

      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}
      {searchParams?.success && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Endringen ble lagret.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Ingen innboksoppgaver.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const order = row.orders?.[0];
            if (!order) return null;
            return (
              <li key={row.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{order.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.type} · Ordrestatus: {order.status}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/ordre/${order.id}`}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Åpne ordre
                  </Link>
                </div>

                {row.status === "pending" ? (
                  <form action={installerDecideOrder} className="mt-3 space-y-2">
                    <input type="hidden" name="inbox_item_id" value={row.id} />
                    <textarea
                      name="decision_note"
                      rows={2}
                      placeholder="Notat (valgfritt)"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        name="decision"
                        value="approved"
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      >
                        Godkjenn
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="rejected"
                        className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                      >
                        Avvis
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Beslutning: {row.status === "approved" ? "Godkjent" : "Avvist"}</p>
                    <p>{row.decision_note?.trim() || "Ingen notat."}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href="/dashboard/ordre"
        className="inline-flex w-fit items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
      >
        Til ordre
      </Link>
    </div>
  );
}
