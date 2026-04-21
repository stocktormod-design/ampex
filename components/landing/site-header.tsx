import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight text-foreground">
          Ampex
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/auth/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Logg inn
          </Link>
          <Link href="/auth/register" className={cn(buttonVariants({ size: "sm" }))}>
            Kom i gang
          </Link>
        </nav>
      </div>
    </header>
  );
}
