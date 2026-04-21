import Image from "next/image";

const placeholders = [
  { seed: "dash-a", label: "Dashbord (placeholder)" },
  { seed: "proj-b", label: "Prosjektliste (placeholder)" },
  { seed: "draw-c", label: "Tegningsvisning (placeholder)" },
];

export function Showcase() {
  return (
    <section className="border-t border-border bg-muted/40 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Forhåndsvisning av grensesnitt
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
          Placeholder-bilder — byttes ut med ekte skjermbilder når modulene er på plass.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {placeholders.map((p) => (
            <figure
              key={p.seed}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={`https://picsum.photos/seed/${p.seed}/800/600`}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
              <figcaption className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
                {p.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
