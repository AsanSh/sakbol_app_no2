export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        HapticFeedback?: {
          impactOccurred: (
            style: "light" | "medium" | "heavy" | "rigid" | "soft",
          ) => void;
        };
      };
    };
  }
}
