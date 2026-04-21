import type { Metadata } from "next";
import { APP_NAME } from "@/constants";

export const metadata: Metadata = {
  title: `Кирүү · ${APP_NAME}`,
};

// Страница входа не должна кэшироваться на CDN: после деплоя клиенты
// (особенно WebView внутри Telegram) должны сразу получать актуальный
// HTML с ссылками на новые JS-чанки, иначе пользователи видят старый
// экран «Откройте SakBol в Telegram» вместо выбора способа входа.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
