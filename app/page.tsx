import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 sm:py-24">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              AMPEX
            </p>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Prosjektstyring bygget for norske elektroentreprenører
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              AMPEX samler prosjektstyring, tegningsoppfølging og lagerflyt i en
              enkel arbeidsflate. Montører, prosjektledere og administrasjon får
              samme oppdaterte status i sanntid.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link className={cn(buttonVariants({ size: "lg" }), "px-6")} href="/auth/login">
              Logg inn
            </Link>
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "cursor-default px-6 opacity-80",
              )}
            >
              Kjøpsside kommer snart
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border bg-card p-6">
            <h2 className="text-base font-semibold">Prosjekt</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Opprett prosjekter, tildel ansvar og følg fremdrift uten
              regneark-kaos.
            </p>
          </article>
          <article className="rounded-xl border bg-card p-6">
            <h2 className="text-base font-semibold">Tegninger</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Marker punkter i PDF med status, bilder og kommentarer som alle
              ser med en gang.
            </p>
          </article>
          <article className="rounded-xl border bg-card p-6">
            <h2 className="text-base font-semibold">Lager</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Skann strekkoder fra mobil, oppdater beholdning og spor forbruk
              per prosjekt.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
