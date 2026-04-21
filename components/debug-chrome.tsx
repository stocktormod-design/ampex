import Link from "next/link";
import { isAmpexDebugEnabled } from "@/lib/debug";

export function DebugChrome() {
  if (!isAmpexDebugEnabled()) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[100] border-t border-amber-500/40 bg-amber-950/95 px-3 py-2 text-xs text-amber-100 shadow-lg backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-amber-50">Ampex feilsøk (AMPEX_DEBUG)</span>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/api/debug/health"
            className="underline decoration-amber-400/80 underline-offset-2 hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            Åpne health JSON
          </Link>
          <span className="text-amber-200/90">
            Vercel → Logs → søk{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">[ampex:debug]</code>
          </span>
        </div>
      </div>
    </div>
  );
}
