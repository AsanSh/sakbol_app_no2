"use client";

import { useEffect, useState } from "react";

type Platform = "telegram" | "browser" | "unknown";

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const init = window.Telegram?.WebApp?.initData;
    const hasInit = typeof init === "string" && init.length > 0;
    const hasTg =
      hasInit || /tgWebAppData|tgWebAppVersion|tgWebAppPlatform/i.test(window.location.hash);
    setPlatform(hasTg ? "telegram" : "browser");
  }, []);

  return platform;
}

export function usePlatformReady(): { isTelegram: boolean; isBrowser: boolean } {
  const p = usePlatform();
  return { isTelegram: p === "telegram", isBrowser: p === "browser" };
}
