"use client";

import { useEffect, useState } from "react";

type Platform = "telegram" | "browser" | "unknown";

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    const hasTg =
      typeof window !== "undefined" &&
      !!(window.Telegram?.WebApp?.initData || window.location.hash.includes("tgWebApp"));
    setPlatform(hasTg ? "telegram" : "browser");
  }, []);

  return platform;
}

export function usePlatformReady(): { isTelegram: boolean; isBrowser: boolean } {
  const p = usePlatform();
  return { isTelegram: p === "telegram", isBrowser: p === "browser" };
}
