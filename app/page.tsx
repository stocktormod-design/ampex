import Link from "next/link";
import {
  Barcode,
  ClipboardList,
  FileImage,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LayoutDashboard className="size-4" aria-hidden />
            </span>
            AMPEX
          </Link>
          <div className="flex items-center gap-2">
            <Link
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
              href="/auth/login"
            >
              Logg inn
            </Link>
            <Link className={cn(buttonVariants({ size: "sm" }))} href="/auth/login">
              Kom i gang
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="absolute inset-0 bg-gradient-to-b from-primary/12 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />
          </div>

          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-col gap-6">
              <Badge variant="secondary" className="w-fit px-3 py-1 text-xs font-medium">
                For elektroentreprenører
              </Badge>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.08]">
                Prosjekt, tegning og lager — samlet i én arbeidsflate
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                AMPEX erstatter spredte regneark og manuelle rutiner med strukturert
                prosjektstyring, visuell oppfølging på tegninger og enkel lagerflyt.
                Teamet ser samme status, uansett om de er på kontoret eller i felt.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-8")} href="/auth/login">
                Logg inn
              </Link>
              <span
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "min-h-11 cursor-default px-8 text-muted-foreground",
                )}
              >
                Priser kommer
              </span>
            </div>

            <dl className="grid gap-6 border-t border-border/60 pt-10 sm:grid-cols-3">
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Multi-tenant
                </dt>
                <dd className="text-sm text-foreground/90">Data isolert per firma med roller.</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sanntid
                </dt>
                <dd className="text-sm text-foreground/90">Oppdateringer synlige for hele teamet.</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Mobil
                </dt>
                <dd className="text-sm text-foreground/90">Skanning og feltarbeid fra telefon.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">Hva du får</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Modulene er bygget for norske elektroprosjekter — fra planlegging til
              dokumentasjon og FDV-forberedelse.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <article className="group relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">Prosjekt</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Oversikt over prosjekter, status og ansvar — uten rot i e-post og
                Excel-ark.
              </p>
            </article>

            <article className="group relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileImage className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">Tegninger</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                PDF-visning med pins for montasjepunkter, status og bilder — synlig
                for alle som trenger det.
              </p>
            </article>

            <article className="group relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Barcode className="size-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">Lager</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                Strekkodeskann, beholdning og sporbar materialbruk knyttet til
                prosjekt.
              </p>
            </article>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-4 py-12 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-medium">Bygget med sikkerhet i tankene</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tilgang styres per firma og rolle. Sensitive nøkler forblir på
                  serveren.
                </p>
              </div>
            </div>
            <Link className={cn(buttonVariants({ variant: "outline" }), "shrink-0")} href="/auth/login">
              Logg inn til dashbord
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        AMPEX · Prosjektstyring for elektroentreprenører
      </footer>
    </div>
  );
}
