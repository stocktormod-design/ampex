import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          Ampex
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-zinc-300 hover:bg-white/10 hover:text-white")}
          >
            Logg inn
          </Link>
          <Link
            href="/auth/register"
            className={cn(buttonVariants({ size: "sm" }), "bg-primary text-primary-foreground shadow-lg shadow-primary/25")}
          >
            Kom i gang
          </Link>
        </nav>
      </div>
    </header>
  );
}
