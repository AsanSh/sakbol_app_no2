"use client";

import { useLayoutEffect, useState } from "react";

/** TYPE 1: TWA · TYPE 2: мобильный браузер · TYPE 3: десктопный браузер */
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
 * Три режима отображения: Telegram Mini App, мобильный веб, десктопный веб (колонка «телефон»).
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
