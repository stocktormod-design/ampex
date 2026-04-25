import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Package, ArrowRight, Plus, Activity, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  planning: "Planlegging",
  active: "Aktiv",
  completed: "Ferdig",
};

const STATUS_COLOR: Record<string, string> = {
  planning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  completed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "short",
  });
}

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role, full_name, companies(name)")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as {
    company_id: string | null;
    role: string;
    full_name: string | null;
    companies: { name: string } | null;
  } | null;

  if (!profile?.company_id) redirect("/onboarding");

  const isAdmin = isAdminRole(profile.role);
  const companyName = profile.companies?.name ?? null;
  const firstName = profile.full_name?.split(" ")[0] ?? null;

  const [projectsRes, drawingsRes, warehouseRes, protocolsRes, myAcksRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("drawings")
      .select("id, project_id, is_published, projects!inner(company_id)")
      .eq("projects.company_id", profile.company_id),
    isAdmin
      ? supabase
          .from("warehouses")
          .select("id, name, warehouse_items(count)")
          .eq("company_id", profile.company_id)
      : Promise.resolve({ data: null }),
    supabase
      .from("protocols")
      .select("id", { count: "exact", head: false })
      .eq("company_id", profile.company_id),
    supabase
      .from("protocol_acknowledgements")
      .select("protocol_id")
      .eq("user_id", user.id),
  ]);

  type ProjectRow = { id: string; name: string; status: string; created_at: string };
  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const drawings = (drawingsRes.data ?? []) as { id: string; project_id: string; is_published: boolean }[];

  const activeCount = projects.filter((p) => p.status === "active").length;
  const planningCount = projects.filter((p) => p.status === "planning").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;
  const publishedDrawings = drawings.filter((d) => d.is_published).length;

  type WarehouseRow = { id: string; name: string; warehouse_items: { count: number }[] };
  const warehouses = (warehouseRes.data ?? []) as WarehouseRow[];

  const totalProtocols = (protocolsRes.data ?? []).length;
  const ackedIds = new Set(((myAcksRes.data ?? []) as { protocol_id: string }[]).map((r) => r.protocol_id));
  const unreadProtocols = totalProtocols - ackedIds.size;
  const totalItems = warehouses.reduce((sum, w) => {
    const cnt = (w.warehouse_items as unknown as { count: number }[])?.[0]?.count ?? 0;
    return sum + cnt;
  }, 0);

  const drawingsByProject: Record<string, number> = {};
  for (const d of drawings) {
    drawingsByProject[d.project_id] = (drawingsByProject[d.project_id] ?? 0) + 1;
  }

  const recentProjects = projects.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          God dag{firstName ? `, ${firstName}` : ""}
        </h1>
        {companyName && (
          <p className="mt-0.5 text-sm text-muted-foreground">{companyName}</p>
        )}
      </div>

      {/* ── Unread protocols banner ── */}
      {unreadProtocols > 0 && (
        <Link
          href="/dashboard/protokoller"
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
        >
          <BookOpen className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span className="font-medium text-amber-800 dark:text-amber-300">
            Du har {unreadProtocols} uleste prosedyre{unreadProtocols === 1 ? "" : "r"}
          </span>
          <ArrowRight className="ml-auto size-4 shrink-0 text-amber-500" aria-hidden />
        </Link>
      )}

      {/* ── Stat cards ── */}
      <div className={`grid gap-3 ${isAdmin ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Aktive prosjekter</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{activeCount}</p>
          {planningCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{planningCount} i planlegging</p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Tegninger</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{publishedDrawings}</p>
          <p className="mt-1 text-xs text-muted-foreground">publiserte</p>
        </div>
        {isAdmin && (
          <>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Fullførte</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{completedCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">prosjekter</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Lagervarer</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{totalItems}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {warehouses.length} lager
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Quick actions ── */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/projects?new=1"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
            Nytt prosjekt
          </Link>
          {warehouses.length > 0 && (
            <Link
              href={`/dashboard/lager/${warehouses[0].id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              <Package className="size-4" aria-hidden />
              Skann strekkode
            </Link>
          )}
        </div>
      )}

      {/* ── Recent projects ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold">Siste prosjekter</h2>
          </div>
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Se alle
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>

        {recentProjects.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-12 text-center">
            <FolderKanban className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">Ingen prosjekter ennå.</p>
            {isAdmin && (
              <Link
                href="/dashboard/projects?new=1"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                <Plus className="size-3.5" />
                Opprett det første
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {recentProjects.map((p) => {
              const dCount = drawingsByProject[p.id] ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/projects/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDate(p.created_at)}
                        {dCount > 0 && ` · ${dCount} tegning${dCount === 1 ? "" : "er"}`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLOR[p.status] ?? STATUS_COLOR.planning
                      }`}
                    >
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Warehouse summary (admin only) ── */}
      {isAdmin && warehouses.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold">Lager</h2>
            </div>
            <Link
              href="/dashboard/lager"
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Se alle
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {warehouses.slice(0, 3).map((w) => {
              const cnt = (w.warehouse_items as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <li key={w.id}>
                  <Link
                    href={`/dashboard/lager/${w.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Package className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{w.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {cnt} vare{cnt === 1 ? "" : "r"}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
