import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import AdminPanel from "./AdminPanel";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user?.is_admin) redirect("/");
  return <AdminPanel />;
}
