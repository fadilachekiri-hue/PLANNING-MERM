import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import Sidebar from "./Sidebar";
import ShareButton from "./ShareButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/connexion");
  if (profile.status !== "active") redirect("/connexion");

  return (
    <div className="flex">
      <Sidebar role={profile.role} name={`${profile.first_name} ${profile.last_name}`} />
      <div className="flex-1 min-h-screen">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-end px-6 gap-3">
          <ShareButton />
        </header>
        <main className="p-6 max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
