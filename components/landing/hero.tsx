import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative min-h-[88vh] overflow-hidden">
      <Image
        src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=2400&q=80"
        alt=""
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/40" aria-hidden />
      <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-20 pt-32 sm:px-6 sm:pb-28">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          For norske elektroentreprenorer
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
          Prosjekter, tegninger og team — på ett sted.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-300">
          Ampex samler arbeidsflyt for elektrofirma: oversikt over prosjekter, dokumentasjon og
          medarbeidere i en trygg, moderne løsning.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/auth/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-primary px-8 text-primary-foreground shadow-lg shadow-primary/30",
            )}
          >
            Start gratis
          </Link>
          <Link
            href="/auth/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-white/20 bg-white/5 text-white hover:bg-white/10",
            )}
          >
            Logg inn
          </Link>
        </div>
      </div>
    </section>
  );
}
