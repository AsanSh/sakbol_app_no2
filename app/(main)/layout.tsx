import type { ReactNode } from "react";
import { TabAppProvider } from "@/context/tab-app-context";

/** Не отдаём устаревший статический shell из edge-кэша после деплоев. */
export const dynamic = "force-dynamic";

export default function MainAppLayout({ children }: { children: ReactNode }) {
  return <TabAppProvider>{children}</TabAppProvider>;
}
