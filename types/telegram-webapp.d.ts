export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        HapticFeedback?: {
          impactOccurred: (
            style: "light" | "medium" | "heavy" | "rigid" | "soft",
          ) => void;
        };
      };
    };
  }
}
