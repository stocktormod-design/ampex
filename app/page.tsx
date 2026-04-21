export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 p-6 sm:p-10">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        AMPEX
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Prosjektstyring for norske elektroentreprenorer
      </h1>
      <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
        Grunnoppsett er klart med Next.js 14, Tailwind, shadcn/ui og Supabase
        SSR-klienter. Neste steg er databaseoppsett, autentisering og modulene
        for prosjekt, tegning og lager.
      </p>
      <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground">
        Oppstart ferdig. Kjor <code className="font-semibold">npm run dev</code>{" "}
        for a starte lokalt.
      </div>
    </main>
  );
}
