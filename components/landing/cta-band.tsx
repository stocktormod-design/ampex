import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function CtaBand() {
  return (
    <section className="border-t border-border bg-primary py-16 text-primary-foreground sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center sm:px-6">
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Klar for å strukturere firmaets prosjekter?
        </h2>
        <p className="max-w-lg text-sm opacity-90 sm:text-base">
          Opprett konto, bekreft e-post, legg inn firma — sa er du inne pa dashbordet.
        </p>
        <Link
          href="/auth/register"
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-white text-primary hover:bg-white/90",
          )}
        >
          Opprett konto
        </Link>
      </div>
    </section>
  );
}
