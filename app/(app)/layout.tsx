import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import Sidebar from "./Sidebar";
import ShareButton from "./ShareButton";

// Sans ceci, Next.js met en cache indéfiniment les requêtes Supabase faites
// depuis les Server Components (comportement par défaut de Next 14, même sur
// une route rendue dynamiquement à cause de cookies()) : les écritures
// (créneaux, postes...) réussissaient bien en base, mais les pages
// continuaient à afficher une version figée tant que ce cache n'était pas
// explicitement invalidé. force-dynamic force une lecture fraîche à chaque
// requête pour toutes les pages de l'application.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/connexion");
  if (profile.status !== "active") redirect("/connexion");

  return (
    <div className="flex">
      <Sidebar role={profile.role} name={`${profile.first_name} ${profile.last_name}`} />
      <div className="flex-1 min-h-screen">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-end px-6 gap-3 print:hidden">
          <ShareButton />
        </header>
        <main className="p-6 max-w-6xl mx-auto print:p-0 print:max-w-none">{children}</main>
      </div>
    </div>
  );
}
