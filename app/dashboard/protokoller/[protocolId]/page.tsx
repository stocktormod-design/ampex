import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  Tag,
  Trash2,
  Users,
  FileText,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/roles";
import { acknowledgeProtocol, deleteProtocol } from "@/app/dashboard/protokoller/actions";
import { ProtocolViewer } from "./protocol-viewer";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ protocolId: string }> | { protocolId: string };
  searchParams?: { ack?: string; success?: string };
};

type AckRow = {
  id: string;
  user_id: string;
  acknowledged_at: string;
  profiles: { full_name: string | null; role: string } | null;
};

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProtocolDetailPage({ params, searchParams }: PageProps) {
  const { protocolId } = params instanceof Promise ? await params : params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("company_id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as { company_id: string | null; role: string; full_name: string | null } | null;
  if (!profile?.company_id) redirect("/onboarding");

  const isAdmin = isAdminRole(profile.role);

  const { data: protocolData } = await supabase
    .from("protocols")
    .select("id, name, description, file_path, created_at, category_id, protocol_categories(name)")
    .eq("id", protocolId)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!protocolData) redirect("/dashboard/protokoller");

  type Protocol = {
    id: string;
    name: string;
    description: string | null;
    file_path: string;
    created_at: string;
    category_id: string | null;
    protocol_categories: { name: string } | null;
  };
  const protocol = protocolData as unknown as Protocol;

  // My acknowledgement
  const { data: myAckData } = await supabase
    .from("protocol_acknowledgements")
    .select("acknowledged_at")
    .eq("protocol_id", protocolId)
    .eq("user_id", user.id)
    .maybeSingle();
  const myAck = myAckData as { acknowledged_at: string } | null;

  // All acknowledgements (admin) + team list
  let acks: AckRow[] = [];
  let teamMembers: { id: string; full_name: string | null; role: string }[] = [];

  if (isAdmin) {
    const adminClient = createAdminClient();
    const [acksRes, teamRes] = await Promise.all([
      adminClient
        .from("protocol_acknowledgements")
        .select("id, acknowledged_at, user_id, profiles(full_name, role)")
        .eq("protocol_id", protocolId)
        .order("acknowledged_at", { ascending: true }),
      adminClient
        .from("profiles")
        .select("id, full_name, role")
        .eq("company_id", profile.company_id)
        .order("full_name"),
    ]);
    acks = (acksRes.data ?? []) as unknown as AckRow[];
    teamMembers = (teamRes.data ?? []) as { id: string; full_name: string | null; role: string }[];
  }

  // Signed URL for PDF
  const adminClient = createAdminClient();
  const { data: urlData } = await adminClient.storage
    .from("protocols")
    .createSignedUrl(protocol.file_path, 3600);
  const pdfUrl = urlData?.signedUrl ?? null;

  const ackedUserIds = new Set(acks.map((a) => a.user_id));

  const notAckedMembers = isAdmin
    ? teamMembers.filter((m) => !ackedUserIds.has(m.id))
    : [];

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div>
        <Link
          href="/dashboard/protokoller"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Protokoller
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{protocol.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {protocol.protocol_categories?.name && (
                <span className="flex items-center gap-1">
                  <Tag className="size-3.5" aria-hidden />
                  {protocol.protocol_categories.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {fmtDateTime(protocol.created_at)}
              </span>
            </div>
            {protocol.description && (
              <p className="mt-1.5 text-sm text-muted-foreground">{protocol.description}</p>
            )}
          </div>
          {/* Admin actions */}
          {isAdmin && (
            <form action={deleteProtocol} className="shrink-0">
              <input type="hidden" name="protocol_id" value={protocol.id} />
              <button
                type="submit"
                title="Slett protokoll"
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">Slett</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Acknowledgement status ── */}
      {searchParams?.ack === "1" || myAck ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 dark:border-emerald-800 dark:bg-emerald-950/30">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Du har bekreftet at du har lest dette
            </p>
            {myAck && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {fmtDateTime(myAck.acknowledged_at)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-800 dark:bg-amber-950/30">
          <FileText className="size-5 shrink-0 text-amber-500" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Ikke bekreftet ennå
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Les gjennom dokumentet og bekreft at du har lest det.
            </p>
          </div>
          <form action={acknowledgeProtocol} className="shrink-0">
            <input type="hidden" name="protocol_id" value={protocol.id} />
            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 active:scale-[0.98]"
            >
              Jeg bekrefter å ha lest dette
            </button>
          </form>
        </div>
      )}

      {/* ── PDF Viewer ── */}
      {pdfUrl ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4 text-muted-foreground" aria-hidden />
              {protocol.name}
            </div>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <Download className="size-3.5" aria-hidden />
              Last ned
            </a>
          </div>
          <ProtocolViewer pdfUrl={pdfUrl} />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">Kunne ikke laste PDF.</p>
        </div>
      )}

      {/* ── Acknowledgement tracking (admin only) ── */}
      {isAdmin && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold">Lesebekreftelser</h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {acks.length} av {teamMembers.length} har bekreftet
            </p>
          </div>

          {/* Progress bar */}
          <div className="px-5 py-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: teamMembers.length > 0 ? `${(acks.length / teamMembers.length) * 100}%` : "0%" }}
              />
            </div>
          </div>

          {/* Confirmed list */}
          {acks.length > 0 && (
            <div className="border-t border-border px-5 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Bekreftet ({acks.length})
              </p>
              <ul className="space-y-1.5">
                {acks.map((ack) => {
                  const ackProfile = ack.profiles as { full_name: string | null; role: string } | null;
                  return (
                    <li key={ack.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
                        <span className="text-sm font-medium">{ackProfile?.full_name ?? "Ukjent"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtDateTime(ack.acknowledged_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Not confirmed list */}
          {notAckedMembers.length > 0 && (
            <div className="border-t border-border px-5 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ikke bekreftet ({notAckedMembers.length})
              </p>
              <ul className="space-y-1.5">
                {notAckedMembers.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <div className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                    <span className="text-sm text-muted-foreground">{m.full_name ?? "Uten navn"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
