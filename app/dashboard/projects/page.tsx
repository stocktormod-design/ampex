import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { createProject } from "@/app/dashboard/projects/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeInput } from "@/components/ui/native-input";
import { NativeLabel } from "@/components/ui/native-label";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, roleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

type ProjectsPageProps = {
  searchParams?: {
    q?: string;
    status?: string;
    error?: string;
    success?: string;
  };
};

type CompanyProfile = {
  company_id: string | null;
  role: string;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  planning: "Planlegging",
  active: "Aktiv",
  completed: "Ferdig",
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
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
  const profile = profileData as CompanyProfile | null;

  if (!profile?.company_id) {
    redirect("/onboarding");
  }

  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });
  const projects = (projectsData ?? []) as ProjectRow[];

  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const statusFilter = (searchParams?.status ?? "all").trim();

  const filtered = projects.filter((p) => {
    const statusOk = statusFilter === "all" || p.status === statusFilter;
    if (!statusOk) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) ?? false) ||
      (STATUS_LABEL[p.status] ?? p.status).toLowerCase().includes(q)
    );
  });

  const canManage = isAdminRole(profile.role);

  return (
    <main className="space-y-8">
      <div className="flex gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FolderKanban className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Prosjekter</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Prosjekter med PDF-tegninger i utkast/publisert-flyt.
          </p>
        </div>
      </div>

      {searchParams?.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams?.success ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Operasjonen er gjennomført.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Nytt prosjekt</CardTitle>
            <CardDescription>
              {canManage
                ? "Owner/admin kan opprette nye prosjekter."
                : `Din rolle (${roleLabel(profile.role)}) kan se prosjekter, men ikke opprette.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <form action={createProject} className="space-y-4">
                <div className="space-y-2">
                  <NativeLabel htmlFor="name">Prosjektnavn</NativeLabel>
                  <NativeInput id="name" name="name" required placeholder="Sykehjem Nordfløy" autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <NativeLabel htmlFor="description">Beskrivelse</NativeLabel>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Kort beskrivelse (valgfritt)"
                  />
                </div>
                <div className="space-y-2">
                  <NativeLabel htmlFor="status">Status</NativeLabel>
                  <select
                    id="status"
                    name="status"
                    defaultValue="planning"
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="planning">Planlegging</option>
                    <option value="active">Aktiv</option>
                    <option value="completed">Ferdig</option>
                  </select>
                </div>
                <SubmitButton className="w-full">Opprett prosjekt</SubmitButton>
              </form>
            ) : (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Kontakt admin dersom et prosjekt mangler.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Prosjektliste</CardTitle>
            <CardDescription>{filtered.length} treff</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto]" method="get">
              <NativeInput name="q" defaultValue={searchParams?.q ?? ""} placeholder="Søk i navn/beskrivelse..." />
              <select
                name="status"
                defaultValue={statusFilter}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">Alle statuser</option>
                <option value="planning">Planlegging</option>
                <option value="active">Aktiv</option>
                <option value="completed">Ferdig</option>
              </select>
              <SubmitButton variant="outline">Filtrer</SubmitButton>
            </form>

            {filtered.length === 0 ? (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                Ingen prosjekter matcher filteret.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {filtered.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{project.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {project.description?.trim() || "Ingen beskrivelse"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                        {STATUS_LABEL[project.status] ?? project.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
