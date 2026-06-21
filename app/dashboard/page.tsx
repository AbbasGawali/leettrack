import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { getSessionUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return <Dashboard user={user} />;
}
