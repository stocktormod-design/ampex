import { NextResponse } from "next/server";
import { runErpSyncWorkerOnce } from "@/lib/integrations/use-cases/processSyncJobs";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const configuredSecret = process.env.ERP_SYNC_WORKER_SECRET;
  if (!configuredSecret) {
    return true;
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return token.length > 0 && token === configuredSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const maxJobsRaw = Number(url.searchParams.get("maxJobs") ?? "10");
  const maxJobs = Number.isFinite(maxJobsRaw) ? Math.min(Math.max(1, maxJobsRaw), 50) : 10;

  const results: unknown[] = [];
  for (let i = 0; i < maxJobs; i += 1) {
    const result = await runErpSyncWorkerOnce();
    results.push(result);
    if (!result.processed) {
      break;
    }
  }

  const processedCount = results.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return "processed" in entry && Boolean((entry as { processed?: boolean }).processed);
  }).length;

  return NextResponse.json({
    ok: true,
    processedCount,
    drained: processedCount < maxJobs,
    results,
  });
}

