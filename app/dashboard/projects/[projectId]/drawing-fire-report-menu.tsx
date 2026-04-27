"use client";

import { useState } from "react";
import { FileBarChart } from "lucide-react";
import { exportDetectorReportPdf, exportDetectorReportXml } from "@/app/dashboard/projects/drawing-detector-report-actions";

type Props = {
  projectId: string;
  drawingId: string;
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DrawingFireReportMenu({ projectId, drawingId }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "xml" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPdf() {
    setError(null);
    setBusy("pdf");
    try {
      const r = await exportDetectorReportPdf(projectId, drawingId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      triggerDownload(new Blob([bytes], { type: "application/pdf" }), r.filename);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste ned PDF");
    } finally {
      setBusy(null);
    }
  }

  async function runXml() {
    setError(null);
    setBusy("xml");
    try {
      const r = await exportDetectorReportXml(projectId, drawingId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      triggerDownload(new Blob([r.xml], { type: "application/xml;charset=utf-8" }), r.filename);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste ned XML");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Detektorrapport (PDF/XML)"
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200/80 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70"
      >
        <FileBarChart className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Rapport</span>
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-[60] cursor-default" aria-label="Lukk" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-[70] mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runPdf()}
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              {busy === "pdf" ? "Lager PDF…" : "Last ned PDF"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runXml()}
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              {busy === "xml" ? "Lager XML…" : "Last ned XML"}
            </button>
            {error ? <p className="border-t border-border px-3 py-2 text-xs text-destructive">{error}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
