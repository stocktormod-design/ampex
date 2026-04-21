import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="border-b border-border bg-muted/20">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Prosjektverktøy for elektro
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Oversikt over firma, prosjekter og lager.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Ampex er under utvikling: innlogging, brukere og lager med strekkode er på plass.
          Flere moduler kommer etter hvert.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/auth/register" className={cn(buttonVariants({ size: "lg" }))}>
            Opprett konto
          </Link>
          <Link href="/auth/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Logg inn
          </Link>
        </div>
      </div>
    </section>
  );
}
