import { ClipboardList, Package, Shield } from "lucide-react";

const features = [
  {
    title: "Prosjekt og team",
    body: "Samme firma, roller for admin og montører — utvidet funksjonalitet planlegges.",
    Icon: ClipboardList,
  },
  {
    title: "Lager og strekkode",
    body: "Opprett lagre, registrer varer med strekkode fra telefon — eller skriv inn manuelt.",
    Icon: Package,
  },
  {
    title: "Tilgang",
    body: "Data i Supabase med rollebasert tilgang (RLS).",
    Icon: Shield,
  },
];

export function FeatureGrid() {
  return (
    <section className="border-b border-border py-14 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Funksjoner</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Fokus på det som gir verdi i hverdagen — uten unødvendig støy.
        </p>
        <ul className="mt-10 grid gap-6 sm:grid-cols-3">
          {features.map(({ title, body, Icon }) => (
            <li
              key={title}
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
                <Icon className="size-4" aria-hidden />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
