import { redirect } from "next/navigation";

/** Старый URL: архив теперь во вкладке «Анализы». */
export default function LegacyDocumentsDashboardPage() {
  redirect("/?tab=analyses");
}
