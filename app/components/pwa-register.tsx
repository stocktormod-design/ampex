"use client";

import { useEffect } from "react";

/**
 * Registrerer service worker i produksjon (unngår cache-hodepine under `next dev`).
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignorer — f.eks. HTTP på localhost */
    });
  }, []);

  return null;
}
