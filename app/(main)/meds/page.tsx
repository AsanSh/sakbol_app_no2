import { redirect } from "next/navigation";

export default function MedsPage() {
  redirect("/?tab=pharmacy");
}
