"use client";

type HourRow = {
  work_date: string;
  minutes: number;
  note: string | null;
  profiles: { full_name: string | null } | null;
};

type MaterialRow = {
  name: string;
  unit: string;
  quantity: number;
  note: string | null;
};

function csvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const lines = rows.map((r) => r.map(csvCell).join(";"));
  const body = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  orderTitle: string;
  hours: HourRow[];
  materials: MaterialRow[];
  /** "compact" = single row of buttons; "stacked" = vertical on narrow panels */
  layout?: "compact" | "stacked";
};

function safeFilePart(title: string) {
  return title.replace(/[^\wæøåÆØÅ\- ]+/gi, "").trim().slice(0, 60) || "ordre";
}

export function OrderCsvExport({ orderTitle, hours, materials, layout = "compact" }: Props) {
  const base = safeFilePart(orderTitle);

  function exportHours() {
    const header = ["Dato", "Minutter", "Navn", "Notat"];
    const data = hours.map((h) => [
      h.work_date,
      String(h.minutes),
      h.profiles?.full_name?.trim() || "",
      h.note?.trim() || "",
    ]);
    downloadCsv(`${base}-timer.csv`, [header, ...data]);
  }

  function exportMaterials() {
    const header = ["Navn", "Antall", "Enhet", "Notat"];
    const data = materials.map((m) => [m.name, String(m.quantity), m.unit, m.note?.trim() || ""]);
    downloadCsv(`${base}-materialer.csv`, [header, ...data]);
  }

  const wrap =
    layout === "stacked"
      ? "flex flex-col gap-2"
      : "flex flex-wrap items-center gap-2";

  return (
    <div className={wrap}>
      <button
        type="button"
        onClick={exportHours}
        disabled={hours.length === 0}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Last ned timer (CSV)
      </button>
      <button
        type="button"
        onClick={exportMaterials}
        disabled={materials.length === 0}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Last ned materialer (CSV)
      </button>
    </div>
  );
}
