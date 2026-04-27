"use server";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import type { DetectorChecklist } from "@/app/dashboard/projects/[projectId]/drawings/[drawingId]/paint-types";

type DetectorRow = {
  id: string;
  payload: { x?: number; y?: number; checklist?: DetectorChecklist };
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capLabel(cap: DetectorChecklist["capOn"]): string {
  if (cap === "no") return "Kappe av";
  if (cap === "yes") return "Kappe på";
  return "Ikke registrert";
}

function buildNarrative(
  total: number,
  capOff: number,
  capOn: number,
  unset: number,
  baseDone: number,
  detDone: number,
): string {
  if (total === 0) {
    return "Ingen publiserte detektorer er registrert på denne tegningen ennå.";
  }
  const pctOff = Math.round((capOff / total) * 100);
  const parts = [
    `Totalt ${total} detektor(er). Kappe registrert som av: ${capOff} (${pctOff} %), på: ${capOn}, ikke valgt: ${unset}.`,
    `Sokkel montert (ja): ${baseDone} av ${total}. Detektor montert (ja): ${detDone} av ${total}.`,
  ];
  if (capOff === total) {
    parts.push("Alle detektorer har registrert kappe av.");
  } else if (unset > capOff + capOn) {
    parts.push("Mange detektorer mangler fortsatt kappe-registrering — fullfør befaring for å øke sporbarheten.");
  } else if (capOff > 0) {
    parts.push("Arbeid pågår: noen detektorer er markert som ferdig (kappe av), resten følges opp.");
  }
  return parts.join(" ");
}

async function loadDetectorContext(projectId: string, drawingId: string) {
  const supabase = await createClient();
  const [{ data: drawing, error: dErr }, { data: proj }] = await Promise.all([
    supabase.from("drawings").select("id, name, revision").eq("id", drawingId).eq("project_id", projectId).maybeSingle(),
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
  ]);
  if (dErr || !drawing) {
    return { ok: false as const, error: dErr?.message ?? "Tegning ikke funnet" };
  }

  const { data: rows, error: oErr } = await supabase
    .from("drawing_overlays")
    .select("id, payload")
    .eq("drawing_id", drawingId)
    .eq("is_published", true)
    .eq("tool_type", "detector")
    .order("created_at", { ascending: true });

  if (oErr) {
    return { ok: false as const, error: oErr.message };
  }

  return {
    ok: true as const,
    drawingName: (drawing as { name: string }).name,
    revision: (drawing as { revision: string | null }).revision,
    projectName: (proj as { name: string } | null)?.name ?? "",
    detectors: (rows ?? []) as DetectorRow[],
  };
}

export async function exportDetectorReportPdf(
  projectId: string,
  drawingId: string,
): Promise<{ ok: true; base64: string; filename: string } | { ok: false; error: string }> {
  const ctx = await loadDetectorContext(projectId, drawingId);
  if (!ctx.ok) return ctx;

  const detectors = ctx.detectors;
  let capOff = 0;
  let capOn = 0;
  let unset = 0;
  let baseDone = 0;
  let detDone = 0;
  for (const row of detectors) {
    const c = row.payload?.checklist;
    if (c?.capOn === "no") capOff += 1;
    else if (c?.capOn === "yes") capOn += 1;
    else unset += 1;
    if (c?.baseMounted) baseDone += 1;
    if (c?.detectorMounted) detDone += 1;
  }
  const narrative = buildNarrative(detectors.length, capOff, capOn, unset, baseDone, detDone);

  function wrapLines(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > maxChars && cur) {
        out.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  const margin = 48;
  let y = 800;
  const ensureSpace = (lines: number, lineHeight: number) => {
    if (y - lines * lineHeight < 56) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
  };
  const drawLines = (size: number, bold: boolean, text: string, color = rgb(0.1, 0.1, 0.12)) => {
    const f = bold ? fontBold : font;
    const chunks = wrapLines(text, 92);
    for (const chunk of chunks) {
      ensureSpace(1, size + 4);
      page.drawText(chunk, { x: margin, y, size, font: f, color });
      y -= size + 4;
    }
  };

  drawLines(16, true, `Detektorrapport — ${ctx.drawingName}`);
  drawLines(10, false, `Prosjekt: ${ctx.projectName || "—"} · Revisjon: ${ctx.revision ?? "—"}`);
  drawLines(10, false, `Generert: ${new Date().toLocaleString("nb-NO")}`);
  y -= 6;
  drawLines(11, true, "Sammendrag");
  drawLines(10, false, narrative);
  y -= 6;

  /* Visuell skala: «kappe av» = ferdig (0/10 hvis ingen har tatt av kappen ennå) */
  const total = detectors.length;
  const done = capOff;
  drawLines(10, true, "Ferdigstillelse (kappe av registrert som «nei» / av)");
  const barW = 420;
  const barH = 16;
  const trackY = y - barH;
  page.drawRectangle({
    x: margin,
    y: trackY,
    width: barW,
    height: barH,
    borderColor: rgb(0.72, 0.74, 0.78),
    borderWidth: 1,
    color: rgb(0.93, 0.94, 0.96),
  });
  if (total > 0 && done > 0) {
    const innerW = barW - 4;
    const fillW = (done / total) * innerW;
    page.drawRectangle({
      x: margin + 2,
      y: trackY + 2,
      width: fillW,
      height: barH - 4,
      color: rgb(0.12, 0.62, 0.38),
    });
  }
  y = trackY - 8;
  drawLines(10, false, `${done} av ${total} detektor(er) markert med kappe av (ferdig). ${capOn} med kappe på. ${unset} uten valg.`);

  y -= 4;
  drawLines(11, true, "Detektorer");
  if (detectors.length === 0) {
    drawLines(10, false, "(Ingen)");
  } else {
    let i = 1;
    for (const row of detectors) {
      const c = row.payload?.checklist;
      const x = row.payload?.x ?? 0;
      const y0 = row.payload?.y ?? 0;
      const comment = (c?.comment ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
      drawLines(
        9,
        false,
        `${i}. pos (${Math.round(x)}, ${Math.round(y0)}) · kappe: ${capLabel(c?.capOn ?? null)} · sokkel: ${c?.baseMounted ? "ja" : "nei"} · detektor: ${c?.detectorMounted ? "ja" : "nei"}${comment ? ` · ${comment}` : ""}`,
      );
      i += 1;
    }
  }

  const bytes = await pdf.save();
  const base64 = Buffer.from(bytes).toString("base64");
  const safe = ctx.drawingName.replace(/[^\wæøåÆØÅ-]+/gi, "-").slice(0, 40) || "tegning";
  return { ok: true, base64, filename: `detektorrapport-${safe}.pdf` };
}

export async function exportDetectorReportXml(
  projectId: string,
  drawingId: string,
): Promise<{ ok: true; xml: string; filename: string } | { ok: false; error: string }> {
  const ctx = await loadDetectorContext(projectId, drawingId);
  if (!ctx.ok) return ctx;

  const detectors = ctx.detectors;
  let capOff = 0;
  let capOn = 0;
  let unset = 0;
  let baseDone = 0;
  let detDone = 0;
  for (const row of detectors) {
    const c = row.payload?.checklist;
    if (c?.capOn === "no") capOff += 1;
    else if (c?.capOn === "yes") capOn += 1;
    else unset += 1;
    if (c?.baseMounted) baseDone += 1;
    if (c?.detectorMounted) detDone += 1;
  }
  const narrative = buildNarrative(detectors.length, capOff, capOn, unset, baseDone, detDone);

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<detectorReport drawingId="${drawingId}" projectId="${projectId}">`);
  lines.push(`  <meta>`);
  lines.push(`    <drawingName>${escapeXml(ctx.drawingName)}</drawingName>`);
  lines.push(`    <projectName>${escapeXml(ctx.projectName)}</projectName>`);
  lines.push(`    <revision>${escapeXml(ctx.revision ?? "")}</revision>`);
  lines.push(`    <generated>${escapeXml(new Date().toISOString())}</generated>`);
  lines.push(`  </meta>`);
  lines.push(`  <summary total="${detectors.length}" capOff="${capOff}" capOn="${capOn}" unset="${unset}" baseMounted="${baseDone}" detectorMounted="${detDone}">`);
  lines.push(`    <narrative>${escapeXml(narrative)}</narrative>`);
  lines.push(`  </summary>`);
  lines.push(`  <detectors>`);
  let i = 1;
  for (const row of detectors) {
    const c = row.payload?.checklist;
    const x = row.payload?.x ?? 0;
    const y0 = row.payload?.y ?? 0;
    lines.push(
      `    <detector index="${i}" id="${row.id}" x="${x}" y="${y0}" capOn="${escapeXml(String(c?.capOn ?? ""))}" baseMounted="${c?.baseMounted ? "true" : "false"}" detectorMounted="${c?.detectorMounted ? "true" : "false"}">`,
    );
    lines.push(`      <comment>${escapeXml((c?.comment ?? "").trim())}</comment>`);
    lines.push(`    </detector>`);
    i += 1;
  }
  lines.push(`  </detectors>`);
  lines.push(`</detectorReport>`);

  const safe = ctx.drawingName.replace(/[^\wæøåÆØÅ-]+/gi, "-").slice(0, 40) || "tegning";
  return { ok: true, xml: lines.join("\n"), filename: `detektorrapport-${safe}.xml` };
}
