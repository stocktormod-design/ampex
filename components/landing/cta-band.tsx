import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function CtaBand() {
  return (
    <section className="border-b border-border bg-muted/30 py-12 sm:py-14">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Prøv Ampex</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Opprett konto, bekreft e-post og legg inn firma — så er du i gang.
          </p>
        </div>
        <Link href="/auth/register" className={cn(buttonVariants({ size: "lg" }), "shrink-0 self-start sm:self-center")}>
          Registrer
        </Link>
      </div>
    </section>
  );
}
