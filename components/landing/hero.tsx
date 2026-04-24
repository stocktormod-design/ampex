import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-zinc-950 pt-14">
      {/* Subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Cyan glow top-center */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full opacity-10"
        style={{
          background: "radial-gradient(ellipse at center, #22d3ee 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-28 sm:px-8 sm:pt-36">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-semibold text-cyan-300">Verktøy for elektrobransjen</span>
        </div>

        <div className="grid gap-16 lg:grid-cols-[1fr_420px] lg:gap-24">
          {/* Left: copy */}
          <div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Alt du trenger<br />
              <span className="text-zinc-400">på ett sted.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
              Ampex gir elektroentreprenører et komplett verktøy: tegningseditor,
              branndetektor-sjekkliste og lager med strekkodeskanning — designet
              for montører på felt.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/auth/register"
                className="inline-flex h-11 items-center rounded-lg bg-white px-6 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90"
              >
                Opprett konto
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex h-11 items-center rounded-lg border border-zinc-700 px-6 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
              >
                Logg inn →
              </Link>
            </div>

            {/* Feature pills */}
            <div className="mt-10 flex flex-wrap gap-2">
              {[
                "PDF-tegninger",
                "Overlay og lag",
                "Branndetektor-sjekkliste",
                "Strekkodeskanning",
                "Mobil-first",
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right: app mockup */}
          <div className="hidden lg:block">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              {/* Fake top bar */}
              <div className="flex h-10 items-center gap-2 border-b border-zinc-800 px-4">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="ml-3 flex-1 rounded bg-zinc-800 px-3 py-1 text-[10px] text-zinc-600">
                  Prosjekt: Sykehjem Nordfløy
                </div>
              </div>

              {/* Fake editor layout */}
              <div className="flex">
                {/* Left toolbar */}
                <div className="flex w-12 flex-col items-center gap-1.5 border-r border-zinc-800 px-1.5 py-3">
                  {["S", "D", "L", "R", "T", "E"].map((l, i) => (
                    <div
                      key={l}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-bold ${
                        i === 1
                          ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-400"
                          : "border-zinc-800 text-zinc-600"
                      }`}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {/* Canvas area */}
                <div className="relative flex-1 bg-zinc-800">
                  {/* Fake drawing grid */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />
                  {/* Floor plan outlines */}
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 200">
                    <rect x="20" y="20" width="260" height="160" rx="2" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                    <line x1="120" y1="20" x2="120" y2="180" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <line x1="20" y1="100" x2="280" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                    {/* Detector dots */}
                    <circle cx="60" cy="55" r="6" fill="#ef4444" stroke="#111" strokeWidth="1" />
                    <circle cx="170" cy="55" r="6" fill="#22c55e" stroke="#111" strokeWidth="1" />
                    <circle cx="240" cy="55" r="6" fill="#ef4444" stroke="#111" strokeWidth="1" />
                    <circle cx="60" cy="140" r="6" fill="#22c55e" stroke="#111" strokeWidth="1" />
                    <circle cx="200" cy="140" r="6" fill="#22d3ee" stroke="#111" strokeWidth="1.5" />
                    <circle cx="200" cy="140" r="11" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="3 2" />

                    {/* A line */}
                    <path d="M 60 55 Q 115 60 170 55" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                  </svg>
                </div>

                {/* Right panel */}
                <div className="w-44 border-l border-zinc-800 p-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Status</div>
                  <div className="mt-2 space-y-1.5">
                    {[
                      { label: "Sokkel montert", done: true },
                      { label: "Detektor montert", done: true },
                      { label: "Kappe av", done: false },
                    ].map(({ label, done }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className={`h-3 w-3 shrink-0 rounded-sm border ${done ? "border-cyan-500 bg-cyan-500/20" : "border-zinc-700"}`}>
                          {done && (
                            <svg viewBox="0 0 8 8" className="text-cyan-400">
                              <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            </svg>
                          )}
                        </div>
                        <span className="text-[9px] text-zinc-500">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 h-16 rounded-md border border-zinc-800 bg-zinc-900/60 p-1.5">
                    <div className="text-[8px] text-zinc-700">Kommentar…</div>
                  </div>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="flex h-8 items-center gap-1 border-t border-zinc-800 px-3">
                <span className="rounded bg-zinc-800 px-1.5 text-[8px] text-zinc-600">detector</span>
                <span className="text-[8px] text-zinc-700">· Lag 1</span>
                <span className="ml-auto text-[8px] text-zinc-700">87%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
