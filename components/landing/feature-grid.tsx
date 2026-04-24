import { FileText, Flame, Package, Smartphone } from "lucide-react";

const features = [
  {
    Icon: FileText,
    title: "PDF-tegningseditor",
    body: "Last opp tegninger som PDF, JPEG eller PNG. Tegn overlay med lag, kurver og rektangler direkte i nettleseren.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    Icon: Flame,
    title: "Branndetektor-sjekkliste",
    body: "Plasser detektor-punkt på tegningen, registrer sokkel, detektor og kappestatus — med foto og kommentar.",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  {
    Icon: Package,
    title: "Lager og strekkode",
    body: "Opprett lagre for firma, registrer varer med strekkodeskanning fra telefon eller skriv inn manuelt.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    Icon: Smartphone,
    title: "Mobil-first",
    body: "Designet for montører på felt. Fungerer på telefon med touch-navigasjon, klyp for zoom og hurtigtaster.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
];

export function FeatureGrid() {
  return (
    <section className="bg-zinc-950 pb-24 pt-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Alt du trenger. Ingenting du ikke trenger.
          </h2>
          <p className="mt-3 text-sm text-zinc-400 sm:text-base">
            Bygget spesifikt for norske elektroentreprenører.
          </p>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ Icon, title, body, color, bg }) => (
            <li
              key={title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <div className={`inline-flex rounded-xl border p-2.5 ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} aria-hidden />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
