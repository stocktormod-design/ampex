import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 sm:py-20">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            AMPEX
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Alt-i-ett verktøy for elektroprosjekter, tegninger og lager
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            AMPEX erstatter Excel og manuelle rutiner med digital prosjektstyring
            for norske elektroentreprenører. Teamet får full oversikt over
            fremdrift, montasjepunkter og varebruk pa tvers av prosjekter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link className={cn(buttonVariants({ size: "lg" }), "px-5")} href="/auth/login">
            Logg inn
          </Link>
          <span className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-5 opacity-70")}>
            Kjøpsside kommer snart
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Prosjektstyring</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Opprett prosjekter, fordel ansvar og følg status fra planlegging
              til ferdigstillelse.
            </p>
          </article>
          <article className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Tegninger med pins</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Marker punkter i PDF-tegninger med tag, status, bilder og
              kommentarer, og hold teamet synkronisert.
            </p>
          </article>
          <article className="rounded-xl border bg-card p-5">
            <h2 className="text-base font-semibold">Lager og skanning</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Skann strekkoder direkte fra mobilkamera, oppdater beholdning og
              spor materialbruk per prosjekt.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
