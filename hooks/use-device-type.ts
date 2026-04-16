"use client";

import { useLayoutEffect, useState } from "react";

/**
 * `twa` — Telegram Mini App (всегда мобильный UI).
 * `mobile-web` — браузер на узком экране (меньше 1024px), тот же UI что и в TWA.
 * `desktop-web` — браузер на широком экране: дашборд с боковым меню.
 */
export type DeviceType = "twa" | "mobile-web" | "desktop-web";

const DESKTOP_MIN_PX = 1024;

export function detectTwa(): boolean {
  if (typeof window === "undefined") return false;
  const init = window.Telegram?.WebApp?.initData;
  const hasInit = typeof init === "string" && init.length > 0;
  if (hasInit) return true;
  return /tgWebAppData|tgWebAppVersion|tgWebAppPlatform/i.test(window.location.hash);
}

function computeDevice(): DeviceType {
  if (typeof window === "undefined") return "mobile-web";
  if (detectTwa()) return "twa";
  return window.innerWidth >= DESKTOP_MIN_PX ? "desktop-web" : "mobile-web";
}

/**
 * Режим отображения: TWA и мобильный веб делят компактный layout; десктопный веб — отдельный dashboard.
 */
export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>("mobile-web");

  useLayoutEffect(() => {
    setDevice(computeDevice());

    function onResize() {
      setDevice(computeDevice());
    }

    window.addEventListener("resize", onResize);

    let n = 0;
    const poll = window.setInterval(() => {
      onResize();
      if (++n >= 50) window.clearInterval(poll);
    }, 100);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearInterval(poll);
    };
  }, []);

  return device;
}
