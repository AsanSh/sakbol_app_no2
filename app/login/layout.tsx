import type { Metadata } from "next";
import { APP_NAME } from "@/constants";

export const metadata: Metadata = {
  title: `Кирүү · ${APP_NAME}`,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
