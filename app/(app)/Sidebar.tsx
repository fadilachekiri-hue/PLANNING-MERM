"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/types";

const NAV: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: "/tableau-de-bord", label: "Tableau de bord", roles: ["owner", "admin", "member"] },
  { href: "/planning", label: "Planning", roles: ["owner", "admin", "member"] },
  { href: "/planning/postes", label: "Vue par postes", roles: ["owner", "admin", "member"] },
  { href: "/binomes", label: "Binômes", roles: ["owner", "admin"] },
  { href: "/equipe", label: "Équipe", roles: ["owner", "admin"] },
  { href: "/demandes", label: "Demandes", roles: ["owner", "admin", "member"] },
  { href: "/remplacements", label: "Remplacements", roles: ["owner", "admin", "member"] },
  { href: "/notifications", label: "Notifications", roles: ["owner", "admin", "member"] },
  { href: "/mon-compte", label: "Mon compte", roles: ["owner", "admin", "member"] },
  { href: "/parametres", label: "Paramètres", roles: ["owner", "admin"] },
  { href: "/historique", label: "Historique", roles: ["owner", "admin"] },
];

export default function Sidebar({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/connexion");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white min-h-screen flex flex-col print:hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm">PM</div>
          <div>
            <p className="text-sm font-semibold leading-tight">Planning MERM</p>
            <p className="text-xs text-slate-400 leading-tight">Henri-Mondor</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.filter((item) => item.roles.includes(role)).map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <p className="text-xs text-slate-400 px-2 mb-1">Connecté(e) en tant que</p>
        <p className="text-sm font-medium px-2 mb-2">{name}</p>
        <button onClick={logout} className="btn-secondary w-full">
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
