import { redirect } from "next/navigation";

/** Старый URL: графики во вкладке «Динамика». */
export default function LegacyDynamicsDashboardPage() {
  redirect("/?tab=trends");
}
