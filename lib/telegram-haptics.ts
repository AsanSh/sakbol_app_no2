type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

function getHaptic() {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp?.HapticFeedback ?? null;
}

/** Telegram Mini App: лёгкая тактильная отдача (безопасно вне Telegram). */
export function hapticImpact(style: ImpactStyle = "medium") {
  try {
    getHaptic()?.impactOccurred(style);
  } catch {
    /* ignore */
  }
}
