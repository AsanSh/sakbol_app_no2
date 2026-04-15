import type { ReactNode } from "react";
import { TabAppProvider } from "@/context/tab-app-context";

export default function MainAppLayout({ children }: { children: ReactNode }) {
  return <TabAppProvider>{children}</TabAppProvider>;
}
