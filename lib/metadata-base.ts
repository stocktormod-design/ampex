import type { Metadata } from "next";

/** Unnga krasj i metadata om NEXT_PUBLIC_APP_URL mangler eller er ugyldig. */
export function metadataBaseUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      /* fall through */
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    try {
      const host = vercel.startsWith("http") ? vercel : `https://${vercel}`;
      return new URL(host);
    } catch {
      /* fall through */
    }
  }
  return new URL("http://localhost:3000");
}

export function withMetadataBase(metadata: Metadata): Metadata {
  return { ...metadata, metadataBase: metadataBaseUrl() };
}
