/**
 * Tom frontend — bygg UI herfra.
 * Supabase: lib/supabase/{client,server,admin}.ts + supabase/migrations/
 * Vercel / Supabase env uendret.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ampex</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Frontend er nullstilt. Koble til Supabase fra <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">lib/supabase</code>{" "}
          nar du bygger auth og sider pa nytt.
        </p>
      </div>
    </main>
  );
}
