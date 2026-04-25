import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileText, ChevronRight, CheckCircle2, BookOpen, Tag, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { createCategory, deleteCategory, uploadProtocol } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    q?: string;
    category?: string;
    new?: string;
    newcat?: string;
    error?: string;
    success?: string;
  };
};

type CategoryRow = { id: string; name: string };
type ProtocolRow = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  created_at: string;
  protocol_categories: { name: string } | null;
  protocol_acknowledgements: { count: number }[];
};

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ProtokollListPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as { company_id: string | null; role: string } | null;
  if (!profile?.company_id) redirect("/onboarding");

  const isAdmin = isAdminRole(profile.role);

  // Parallel data fetch
  const [protocolsRes, categoriesRes, myAcksRes, teamSizeRes] = await Promise.all([
    supabase
      .from("protocols")
      .select("id, name, description, category_id, created_at, protocol_categories(name), protocol_acknowledgements(count)")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("protocol_categories")
      .select("id, name")
      .eq("company_id", profile.company_id)
      .order("name"),
    supabase
      .from("protocol_acknowledgements")
      .select("protocol_id")
      .eq("user_id", user.id),
    isAdmin
      ? supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", profile.company_id)
      : Promise.resolve({ count: null }),
  ]);

  const allProtocols = (protocolsRes.data ?? []) as unknown as ProtocolRow[];
  const categories = (categoriesRes.data ?? []) as CategoryRow[];
  const myAckedIds = new Set((myAcksRes.data ?? []).map((r: { protocol_id: string }) => r.protocol_id));
  const teamSize = isAdmin ? (teamSizeRes.count ?? 0) : 0;

  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const catFilter = searchParams?.category ?? "";
  const showUpload = searchParams?.new === "1" && isAdmin;
  const showNewCat = searchParams?.newcat === "1" && isAdmin;

  const filtered = allProtocols.filter((p) => {
    if (catFilter && p.category_id !== catFilter) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false) ||
      (p.protocol_categories?.name.toLowerCase().includes(q) ?? false)
    );
  });

  const unreadCount = allProtocols.filter((p) => !myAckedIds.has(p.id)).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Protokoller</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {allProtocols.length} dokument{allProtocols.length === 1 ? "" : "er"}
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {unreadCount} ulest
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2">
            <Link
              href={showNewCat ? "/dashboard/protokoller" : "/dashboard/protokoller?newcat=1"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              <Tag className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Kategori</span>
            </Link>
            <Link
              href={showUpload ? "/dashboard/protokoller" : "/dashboard/protokoller?new=1"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">Last opp</span>
            </Link>
          </div>
        )}
      </div>

      {/* ── Feedback ── */}
      {searchParams?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}
      {searchParams?.success === "category-created" && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Kategori opprettet.
        </p>
      )}

      {/* ── New category form ── */}
      {isAdmin && showNewCat && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Ny kategori</h2>
          <form action={createCategory} className="flex gap-3">
            <div className="flex-1">
              <NativeLabel htmlFor="cat-name" className="sr-only">Kategorinavn</NativeLabel>
              <NativeInput
                id="cat-name"
                name="name"
                required
                placeholder="F.eks. HMS, Brannvern, Elektro"
                autoFocus
                autoComplete="off"
              />
            </div>
            <SubmitButton className="shrink-0">Opprett</SubmitButton>
            <Link
              href="/dashboard/protokoller"
              className="inline-flex items-center rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Avbryt
            </Link>
          </form>

          {/* Existing categories */}
          {categories.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Eksisterende kategorier</p>
              <ul className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <li key={cat.id} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-3 pr-1.5 py-0.5 text-sm">
                    <span>{cat.name}</span>
                    <form action={deleteCategory}>
                      <input type="hidden" name="category_id" value={cat.id} />
                      <button
                        type="submit"
                        title="Slett kategori"
                        className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3" aria-hidden />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Upload form ── */}
      {isAdmin && showUpload && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">Last opp protokoll</h2>
          <form action={uploadProtocol} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <NativeLabel htmlFor="proto-name">Navn *</NativeLabel>
                <NativeInput
                  id="proto-name"
                  name="name"
                  required
                  placeholder="HMS-protokoll 2024"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <NativeLabel htmlFor="proto-cat">Kategori</NativeLabel>
                <select
                  id="proto-cat"
                  name="category_id"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— Ingen kategori —</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="proto-desc">Beskrivelse / nøkkelord</NativeLabel>
              <textarea
                id="proto-desc"
                name="description"
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Kort beskrivelse eller søkeord (brukes ved søk)"
              />
            </div>
            <div className="space-y-2">
              <NativeLabel htmlFor="proto-file">PDF-fil (maks 20 MB)</NativeLabel>
              <input
                id="proto-file"
                name="pdf_file"
                type="file"
                accept="application/pdf,.pdf"
                required
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <div className="flex items-center gap-3">
              <SubmitButton>Last opp</SubmitButton>
              <Link href="/dashboard/protokoller" className="text-sm text-muted-foreground hover:text-foreground">
                Avbryt
              </Link>
            </div>
          </form>
        </div>
      )}

      {/* ── Category tabs + search ── */}
      <div className="space-y-3">
        {/* Category filter pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={q ? `/dashboard/protokoller?q=${encodeURIComponent(q)}` : "/dashboard/protokoller"}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !catFilter
                  ? "bg-foreground text-background"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              Alle
            </Link>
            {categories.map((cat) => {
              const href = `/dashboard/protokoller?category=${cat.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
              const active = catFilter === cat.id;
              return (
                <Link
                  key={cat.id}
                  href={active ? (q ? `/dashboard/protokoller?q=${encodeURIComponent(q)}` : "/dashboard/protokoller") : href}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Search */}
        <form method="get" className="flex gap-2">
          {catFilter && <input type="hidden" name="category" value={catFilter} />}
          <NativeInput
            name="q"
            defaultValue={searchParams?.q ?? ""}
            placeholder="Søk etter navn, kategori eller beskrivelse..."
            className="flex-1"
          />
          <SubmitButton variant="outline" className="shrink-0">Søk</SubmitButton>
          {q && (
            <Link
              href={catFilter ? `/dashboard/protokoller?category=${catFilter}` : "/dashboard/protokoller"}
              className="inline-flex items-center rounded-lg border border-border bg-background px-3 text-sm transition-colors hover:bg-muted"
            >
              ✕
            </Link>
          )}
        </form>
      </div>

      {/* ── Protocol list ── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-16 text-center">
          <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/40" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground">
            {q || catFilter ? "Ingen protokoller matcher søket." : "Ingen protokoller ennå."}
          </p>
          {isAdmin && !showUpload && (
            <Link
              href="/dashboard/protokoller?new=1"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              <Plus className="size-3.5" />
              Last opp den første
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {filtered.map((p) => {
            const acked = myAckedIds.has(p.id);
            const ackCount = (p.protocol_acknowledgements as unknown as { count: number }[])?.[0]?.count ?? 0;
            const catName = p.protocol_categories?.name ?? null;

            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard/protokoller/${p.id}`}
                  className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
                >
                  {/* Read indicator */}
                  <div className="shrink-0">
                    {acked ? (
                      <CheckCircle2 className="size-5 text-emerald-500" aria-label="Lest" />
                    ) : (
                      <FileText className="size-5 text-muted-foreground/50" aria-label="Ikke lest" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{p.name}</p>
                      {!acked && (
                        <span className="hidden shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 sm:inline">
                          Ulest
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {catName && (
                        <span className="flex items-center gap-1">
                          <Tag className="size-3" aria-hidden />
                          {catName}
                        </span>
                      )}
                      {p.description && (
                        <span className="truncate max-w-[20rem]">{p.description}</span>
                      )}
                      {!catName && !p.description && (
                        <span>{fmtDate(p.created_at)}</span>
                      )}
                    </div>
                  </div>

                  {/* Acknowledgement count (admin) */}
                  {isAdmin && (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {ackCount}/{teamSize} lest
                    </span>
                  )}

                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
