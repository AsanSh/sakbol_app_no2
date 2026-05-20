import { redirect } from "next/navigation";

/** Legacy URL: анализы во вкладке «Медкарта». */
export default function LegacyTestsPage() {
  redirect("/?tab=analyses");
}
