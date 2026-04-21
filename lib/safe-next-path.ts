/** Tillat kun interne paths etter innlogging (blokker // og full URL). */
export function safeNextPath(raw: unknown, fallback = "/dashboard"): string {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return fallback;
  if (s.includes("://")) return fallback;
  if (s.includes("\n") || s.includes("\r")) return fallback;
  return s;
}
