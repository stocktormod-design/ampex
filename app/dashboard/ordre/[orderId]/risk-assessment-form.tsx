"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { saveRiskAssessment } from "@/app/dashboard/ordre/actions";

type OrderType = "bolig" | "maritim" | "kompleks";

type ChecklistItem = {
  id: string;
  text: string;
  required?: boolean;
};

type Category = {
  label: string;
  items: ChecklistItem[];
};

type ItemState = {
  checked: boolean;
  na: boolean;
  notes: string;
};

type RiskPayload = {
  version: "risk-v2";
  order_type: OrderType;
  job_description: string;
  location: string;
  work_date: string;
  participants: string;
  approved_by: string;
  checklist: Record<string, ItemState>;
  additional_notes: string;
};

// ─── Checklists ────────────────────────────────────────────────────────────────

const BOLIG: Category[] = [
  {
    label: "Forberedelser",
    items: [
      { id: "tillatelse", text: "Arbeidstillatelse innhentet fra anleggseier / beboer", required: true },
      { id: "spenningsfri", text: "Anlegget er spenningsfritt og sikret mot utilsiktet tilbakekobling", required: true },
      { id: "maalt-spenningsfri", text: "Spenningsfrihet er målt og bekreftet med godkjent instrument (FSE § 10)", required: true },
      { id: "jord-kontroll", text: "Jordforbindelsen og potensialutjevning er kontrollert", required: true },
      { id: "pvu", text: "Nødvendig personlig verneutstyr (PVU) er tilgjengelig og i orden", required: true },
      { id: "ryddet", text: "Arbeidsstedet er ryddet og avsperret om nødvendig" },
      { id: "beboer-varslet", text: "Beboere / bruker er informert om arbeidet og forventet strømpause" },
    ],
  },
  {
    label: "Elektrisk installasjon",
    items: [
      { id: "kursfortegnelse", text: "Kursfortegnelse er kontrollert og stemmer med eksisterende anlegg (NEK 400-5-514)", required: true },
      { id: "rcd", text: "Jordfeilbryter (RCD) er montert der påkrevd, eller eksisterende er kontrollert og godkjent", required: true },
      { id: "kabeltype", text: "Kabeltype, -dimensjon og -føring er i henhold til beregning og NEK 400", required: true },
      { id: "koblingsskjema", text: "Koblingsskjema er tilgjengelig og oppdatert" },
      { id: "overspenningsvern", text: "Overspenningsvern er vurdert (NEK 400-4-443)" },
      { id: "belastning", text: "Beregnet belastning / effektbehov er kontrollert mot eksisterende kurs" },
    ],
  },
  {
    label: "Brannsikkerhet",
    items: [
      { id: "branngjennomforing", text: "Branngjennomføringer og kabelgjennomganger i branncellevegger er tettet iht. brannklasse", required: true },
      { id: "varmtarbeid", text: "Varmt arbeid: branntillatelse innhentet og brannslukkingsapparat tilgjengelig" },
      { id: "varmgang", text: "Kabelkanaler og koblingsbokser er lukket og sikret mot varmgang" },
    ],
  },
  {
    label: "Sluttsjekk og dokumentasjon",
    items: [
      { id: "isolasjonsmaling", text: "Isolasjonsresistans er målt og dokumentert — min. 1 MΩ pr. kurs (NEK 400-6-61)", required: true },
      { id: "vern-testet", text: "Vern, sikringer og jordfeilbrytere er testet og fungerer", required: true },
      { id: "kursfortegnelse-oppdatert", text: "Kursfortegnelse er oppdatert med nye/endrede kretser", required: true },
      { id: "samsvar", text: "Samsvarserklæring er fylt ut og levert anleggseier (FEL § 12)", required: true },
      { id: "ryddet-etter", text: "Arbeidsstedet er ryddet og etterlatt i god stand" },
    ],
  },
];

const MARITIM: Category[] = [
  {
    label: "Arbeidsklarering og forberedelser",
    items: [
      { id: "ptw", text: "Arbeidsklarering (Permit to Work) er innhentet fra skipets teknisk ansvarlig / kaptein", required: true },
      { id: "loto", text: "LOTO-prosedyre (Lockout/Tagout) er gjennomført, dokumentert og kontrollert av alle berørte parter", required: true },
      { id: "spenningsfri", text: "Spenningsfrihet er bekreftet med godkjent måleinstrument (FSE § 10)", required: true },
      { id: "koordinering-bro", text: "Koordinering med bro, maskinrom og skipsledelse er gjennomført", required: true },
      { id: "gassmaling", text: "Gassmåling er utført i aktuelle rom og er godkjent (der dette er aktuelt)" },
      { id: "varmtarbeid-brann", text: "Varmt arbeid: brann- / røykvakt er på plass og branntillatelse er innhentet" },
      { id: "stabilitet", text: "Skipets stabilitet og trim er vurdert i forhold til arbeidsoperasjoner" },
    ],
  },
  {
    label: "Maritimt elektrisk anlegg",
    items: [
      { id: "it-jord", text: "IT-jordsystem (isolert nøytral / uisolert nøytral) er verifisert og kartlagt", required: true },
      { id: "jordfeil-overv", text: "Jordfeilovervåkningssystem (IMD) er operativt og alarm er kontrollert", required: true },
      { id: "kabeltype-maritim", text: "Kabeltype er godkjent for maritimt bruk — f.eks. halogenfriekabler (IEC 60092-353/354)", required: true },
      { id: "korrosjon", text: "Korrosjonsbeskyttelse er vurdert for alle komponenter utsatt for saltvannseksponering eller kondens", required: true },
      { id: "ip-klasse", text: "IP-klasse (kapslingsgard) er i henhold til plassering og miljø (maskinrom, dekk, etc.)", required: true },
      { id: "vibrasjonssikring", text: "Vibrasjonssikring av koblinger, terminaler og apparater er kontrollert" },
      { id: "atex", text: "ATEX-krav for eksplosjonsfarlige soner (maskinrom, tanker, pumprom) er gjennomgått og overholdt" },
      { id: "nodstrom", text: "Nødstrømsystem (nødtavle, UPS, batterier) er ikke berørt uten særskilt tillatelse — koordinering gjennomført", required: true },
      { id: "solas-nodbelysning", text: "SOLAS-krav til nødbelysning, nødkraft og brannsikkerhet er overholdt (SOLAS II-1 reg. 42/43)" },
      { id: "lastevern", text: "Lastevern og overstrømsvern er i henhold til klassereglene" },
    ],
  },
  {
    label: "Sertifisering og klassegodkjenning",
    items: [
      { id: "klassifisering", text: "Utstyr er godkjent av klassifikasjonsselskap (DNV, Bureau Veritas, Lloyd's el.l.)", required: true },
      { id: "sertifikater-tilgjengelig", text: "Typesertifikater og sertifikater for marint elektrisk utstyr er kontrollert og tilgjengelig" },
      { id: "endringer-klasse", text: "Klassifikasjonsselskap er varslet dersom endringen krever godkjenning / ny klassebesiktigelse" },
    ],
  },
  {
    label: "Sluttsjekk og dokumentasjon",
    items: [
      { id: "isolasjonsmaling", text: "Isolasjonsresistans er målt og dokumentert for alle berørte kretser", required: true },
      { id: "jordfeil-status", text: "Jordfeilstatus er kontrollert på IMD-panelet etter arbeid — ingen aktive feil", required: true },
      { id: "funksjonskontroll", text: "Funksjonskontroll er gjennomført — anlegget er verifisert operativt", required: true },
      { id: "ptw-avsluttet", text: "Arbeidsklarering (PTW) er avsluttet, underskrevet og returnert til ansvarlig", required: true },
      { id: "endringer-rapport", text: "Alle endringer er rapportert og innarbeidet i skipets tekniske dokumentasjon / E&I-tegninger", required: true },
    ],
  },
];

const KOMPLEKS: Category[] = [
  {
    label: "Planlegging og koordinering",
    items: [
      { id: "arbeidstillatelse", text: "Arbeidsordre og arbeidstillatelse er innhentet og godkjent av driftsansvarlig", required: true },
      { id: "loto", text: "LOTO-prosedyre er gjennomført, dokumentert og kontrollert av alle berørte parter", required: true },
      { id: "toolbox", text: "Risikovurdering er gjennomgått med alle arbeidstakere (verktøykasse-samtale / Toolbox Talk)", required: true },
      { id: "driftsansvarlig", text: "Koordinering med anleggets driftsansvarlig er gjennomført", required: true },
      { id: "andre-entrepriser", text: "Koordinering med andre entrepriser, faggrupper og underentreprenører er gjennomført" },
      { id: "nodstopp-kartlagt", text: "Nødavstenging, nødstopp og rømningsveier er kartlagt og kommunisert til alle", required: true },
      { id: "spesialkompetanse", text: "Nødvendig spesialkompetanse er verifisert (HV-sertifikat, ATEX, ex-anlegg osv.)", required: true },
    ],
  },
  {
    label: "Tekniske vurderinger",
    items: [
      { id: "kortslutning", text: "Kortslutningsstrøm er beregnet og dokumentert for nye og endrede avganger", required: true },
      { id: "vernselektivitet", text: "Vernselektivitet er kontrollert — alle vern koordinert mot hverandre", required: true },
      { id: "arc-flash", text: "Arc-flash (lysbuerisikovurdering) er gjennomført — verneutstyr tilpasset beregnet energi (NFPA 70E / IEC 61482)", required: true },
      { id: "ups", text: "UPS, batteribuffer og nødstrøm er vurdert og tatt hensyn til i frakoblingsprosedyre", required: true },
      { id: "jord-potensial", text: "Jordsystem og potensialutjevning er kartlagt og verifisert", required: true },
      { id: "emc", text: "EMC-krav er vurdert — skjerming, separat kabelføring og filtrering der nødvendig" },
      { id: "nodstopp-testet", text: "Nødstopp og sikkerhetsfunksjoner er testet og virker korrekt etter arbeid" },
      { id: "belastningsberegning", text: "Belastningsberegning og effektbalanse er kontrollert og dokumentert" },
    ],
  },
  {
    label: "Arbeidsmiljø og personlig sikkerhet",
    items: [
      { id: "pvu-arcrated", text: "PVU er tilpasset risikovurdering — inkl. ARC-rated klær, visir og hansker der påkrevd", required: true },
      { id: "stoy", text: "Støy og arbeidsmiljøkrav er vurdert — hørselsvern er tilgjengelig" },
      { id: "trange-rom", text: "Arbeid i trange rom (confined space): tillatelse og redningsprosedyre er etablert" },
      { id: "kjemikalier", text: "Kjemikalier og farlige stoffer i arbeidsområdet er kartlagt — HMS-datablad er tilgjengelig" },
      { id: "romningsveier", text: "Rømningsveier er kartlagt og ikke blokkert av materialer eller utstyr" },
      { id: "fall-sikring", text: "Fall-sikring er etablert ved arbeid i høyden (sele, sikringslinje, rekkverk)" },
    ],
  },
  {
    label: "Sluttsjekk og dokumentasjon",
    items: [
      { id: "isolasjonsmaling", text: "Alle isolasjonsmålinger er utført og dokumentert for berørte kretser", required: true },
      { id: "vern-testet", text: "Vern, jordfeilbrytere og sikkerhetsfunksjoner er testet etter arbeid", required: true },
      { id: "systemtest", text: "Systemet er testet under drift og verifisert operativt (der dette er mulig og forsvarlig)" },
      { id: "driftsansvarlig-info", text: "Driftsansvarlig er informert om gjennomførte endringer og ny driftstilstand", required: true },
      { id: "som-bygget", text: "Som-bygget-tegninger (as-built) er oppdatert eller oppdatering er formelt planlagt og avtalt", required: true },
      { id: "samsvar", text: "Samsvarserklæring er utarbeidet og klar for levering (FEL § 12)", required: true },
      { id: "dokumentasjon-komplett", text: "All teknisk dokumentasjon er komplett og overlevert anleggseier / driftsansvarlig" },
      { id: "loto-opphevet", text: "LOTO er formelt opphevet og alle låser / merkelapper er fjernet", required: true },
    ],
  },
];

const CHECKLISTS: Record<OrderType, Category[]> = {
  bolig: BOLIG,
  maritim: MARITIM,
  kompleks: KOMPLEKS,
};

// ─── State helpers ─────────────────────────────────────────────────────────────

function defaultChecklist(categories: Category[]): Record<string, ItemState> {
  const entries: Record<string, ItemState> = {};
  for (const cat of categories) {
    for (const item of cat.items) {
      entries[item.id] = { checked: false, na: false, notes: "" };
    }
  }
  return entries;
}

function parsePayload(raw: Record<string, unknown> | null, orderType: OrderType): RiskPayload {
  const categories = CHECKLISTS[orderType];
  const defaults = defaultChecklist(categories);

  if (raw?.version === "risk-v2") {
    const typed = raw as unknown as RiskPayload;
    return {
      ...typed,
      order_type: orderType,
      checklist: { ...defaults, ...(typed.checklist ?? {}) },
    };
  }

  // Migrate from old sja-v1 or unknown format
  const old = raw as Record<string, unknown> | null;
  return {
    version: "risk-v2",
    order_type: orderType,
    job_description: String(old?.job_description ?? ""),
    location: String(old?.location ?? ""),
    work_date: "",
    participants: String(old?.participants ?? ""),
    approved_by: String(old?.approved_by ?? ""),
    checklist: defaults,
    additional_notes: String(old?.mitigations ?? ""),
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

type Props = {
  orderId: string;
  orderType: OrderType;
  existingPayload: Record<string, unknown> | null;
  isCompleted: boolean;
};

export function RiskAssessmentForm({ orderId, orderType, existingPayload, isCompleted }: Props) {
  const [state, setState] = useState<RiskPayload>(() => parsePayload(existingPayload, orderType));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [warnIncomplete, setWarnIncomplete] = useState(false);
  const hiddenRef = useRef<HTMLTextAreaElement>(null);

  const categories = CHECKLISTS[orderType];

  function setField<K extends keyof RiskPayload>(key: K, value: RiskPayload[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function setItem(id: string, patch: Partial<ItemState>) {
    setState((prev) => ({
      ...prev,
      checklist: { ...prev.checklist, [id]: { ...prev.checklist[id], ...patch } },
    }));
  }

  function toggleCollapse(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  const allItems = categories.flatMap((c) => c.items);
  const requiredItems = allItems.filter((i) => i.required);
  const checkedRequired = requiredItems.filter((i) => state.checklist[i.id]?.checked);
  const totalChecked = allItems.filter((i) => state.checklist[i.id]?.checked || state.checklist[i.id]?.na).length;
  const allRequiredDone = checkedRequired.length === requiredItems.length;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const completing = submitter?.value === "1";
    if (completing && !allRequiredDone) {
      e.preventDefault();
      setWarnIncomplete(true);
      return;
    }
    setWarnIncomplete(false);
    if (hiddenRef.current) {
      hiddenRef.current.value = JSON.stringify(state);
    }
  }

  return (
    <form action={saveRiskAssessment} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="order_id" value={orderId} />
      <textarea ref={hiddenRef} name="payload_json" className="hidden" defaultValue="{}" readOnly />

      {/* Progress bar */}
      <div>
        <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>{totalChecked} av {allItems.length} punkter behandlet</span>
          <span className="font-medium text-foreground">
            {checkedRequired.length}/{requiredItems.length} obligatoriske
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{ width: `${allItems.length > 0 ? (totalChecked / allItems.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Header info */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Arbeidsbeskrivelse *</label>
          <textarea
            rows={3}
            value={state.job_description}
            onChange={(e) => setField("job_description", e.target.value)}
            placeholder="Beskriv arbeidet som skal utføres…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Arbeidssted / Lokasjon *</label>
          <textarea
            rows={3}
            value={state.location}
            onChange={(e) => setField("location", e.target.value)}
            placeholder="Adresse eller beskrivelse av stedet…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Planlagt dato</label>
          <input
            type="date"
            value={state.work_date}
            onChange={(e) => setField("work_date", e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Deltakere</label>
          <input
            type="text"
            value={state.participants}
            onChange={(e) => setField("participants", e.target.value)}
            placeholder="Navn på alle som deltar…"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Godkjent av (ansvarlig) *</label>
          <input
            type="text"
            value={state.approved_by}
            onChange={(e) => setField("approved_by", e.target.value)}
            placeholder="Fullt navn på ansvarlig person…"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Checklists */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Sjekkliste</h3>
        {categories.map((cat) => {
          const isCollapsed = collapsed[cat.label];
          const catItems = cat.items;
          const catDone = catItems.filter((i) => state.checklist[i.id]?.checked || state.checklist[i.id]?.na).length;
          const allCatDone = catDone === catItems.length;

          return (
            <div key={cat.label} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => toggleCollapse(cat.label)}
                className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{cat.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      allCatDone
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {catDone}/{catItems.length}
                  </span>
                </div>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                />
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-border">
                  {catItems.map((item) => {
                    const entry = state.checklist[item.id] ?? { checked: false, na: false, notes: "" };
                    const isNa = entry.na;
                    const isChecked = entry.checked;

                    return (
                      <div
                        key={item.id}
                        className={`px-4 py-3 ${isChecked ? "bg-emerald-50/50 dark:bg-emerald-950/20" : isNa ? "bg-muted/30" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            id={`item-${item.id}`}
                            checked={isChecked}
                            disabled={isNa}
                            onChange={(e) =>
                              setItem(item.id, { checked: e.target.checked, na: false })
                            }
                            className="mt-0.5 size-4 shrink-0 accent-emerald-600 disabled:opacity-40"
                          />
                          <div className="min-w-0 flex-1">
                            <label
                              htmlFor={`item-${item.id}`}
                              className={`cursor-pointer text-sm leading-snug ${
                                isNa ? "text-muted-foreground line-through" : ""
                              }`}
                            >
                              {item.text}
                              {item.required && !isNa && (
                                <span className="ml-1.5 text-xs text-muted-foreground">(obligatorisk)</span>
                              )}
                            </label>

                            {(isChecked || entry.notes) && (
                              <input
                                type="text"
                                value={entry.notes}
                                onChange={(e) => setItem(item.id, { notes: e.target.value })}
                                placeholder="Kommentar / avvik…"
                                className="mt-2 h-8 w-full rounded-lg border border-input bg-background px-2 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            )}
                          </div>

                          {/* N/A toggle */}
                          {!item.required && (
                            <button
                              type="button"
                              onClick={() => setItem(item.id, { na: !isNa, checked: false, notes: "" })}
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                                isNa
                                  ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                  : "border border-border bg-background text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              N/A
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Additional notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Ytterligere merknader / avvik / tiltak
        </label>
        <textarea
          rows={3}
          value={state.additional_notes}
          onChange={(e) => setField("additional_notes", e.target.value)}
          placeholder="Beskriv avvik, observasjoner eller tiltak som ikke dekkes av sjekklisten…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Incomplete warning */}
      {warnIncomplete && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          {requiredItems.length - checkedRequired.length} obligatoriske punkt er ikke krysset av. Kryss av eller legg
          til merknad før du markerer som fullført.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="complete"
          value="0"
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Lagre utkast
        </button>
        <button
          type="submit"
          name="complete"
          value="1"
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/85"
        >
          Marker som fullført
        </button>
        {isCompleted && !warnIncomplete && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Fullført</span>
        )}
        {!allRequiredDone && (
          <span className="text-xs text-muted-foreground">
            {requiredItems.length - checkedRequired.length} obligatoriske gjenstår
          </span>
        )}
      </div>
    </form>
  );
}
