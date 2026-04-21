import Image from "next/image";

const features = [
  {
    title: "Prosjektoversikt",
    body: "Se status, frister og ansvarlige — uten å hoppe mellom regneark og e-post.",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
    alt: "Team som jobber sammen",
  },
  {
    title: "Tegninger og felt",
    body: "Koble tegninger til montasje og oppfølging på byggeplass. (Kommer i neste fase.)",
    image:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=80",
    alt: "Tegninger pa bord",
  },
  {
    title: "Trygg tilgang",
    body: "Roller for owner, admin og montorer — slik at riktige personer ser riktige data.",
    image:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=900&q=80",
    alt: "Sikkerhet og tilgang",
  },
];

export function FeatureGrid() {
  return (
    <section className="border-t border-border bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bygget for elektrofirma</h2>
          <p className="mt-4 text-muted-foreground">
            MVP-en fokuserer på innlogging, firma og brukere. Her er retningen for produktet.
          </p>
        </div>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <Image
                  src={f.image}
                  alt={f.alt}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
