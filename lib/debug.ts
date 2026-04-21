/**
 * Sett AMPEX_DEBUG=1 (Vercel / .env.local) for feilsøking:
 * — synlig banner + /api/debug/health
 * — console.warn med prefiks [ampex:debug] (Vercel Runtime Logs)
 * Ikke la dette stå på i produksjon etter at feilen er funnet.
 */
export function isAmpexDebugEnabled(): boolean {
  const v = process.env.AMPEX_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function debugLog(tag: string, payload: Record<string, unknown>): void {
  if (!isAmpexDebugEnabled()) return;
  try {
    console.warn(`[ampex:debug] ${tag}`, JSON.stringify(payload));
  } catch {
    console.warn(`[ampex:debug] ${tag}`, payload);
  }
}
