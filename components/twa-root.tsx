"use client";

import { useEffect } from "react";

/**
 * Expands the Telegram Mini App viewport when running inside TWA.
 * SDK is loaded only on the client to avoid `window` access during SSR.
 */
export function TwaRoot() {
  useEffect(() => {
    let cancelled = false;
    void import("@twa-dev/sdk").then((mod) => {
      if (cancelled) return;
      try {
        const WebApp = mod.default;
        WebApp.ready();
        WebApp.expand();
      } catch {
        /* outside Telegram or unsupported */
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
