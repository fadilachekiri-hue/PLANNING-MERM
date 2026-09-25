"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NotificationsClient({ notifications }: { notifications: any[] }) {
  const router = useRouter();

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/lu`, { method: "POST" });
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Notifications</h1>
      <div className="space-y-2">
        {notifications.map((n) => (
          <div key={n.id} className={`card p-4 flex items-start justify-between ${!n.read_at ? "border-brand-200 bg-brand-50/40" : ""}`}>
            <div>
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
              <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
              {n.link && <Link href={n.link} className="text-xs text-brand-600 hover:underline">Voir</Link>}
            </div>
            {!n.read_at && (
              <button className="btn-secondary text-xs" onClick={() => markRead(n.id)}>Marquer comme lue</button>
            )}
          </div>
        ))}
        {notifications.length === 0 && <div className="card p-8 text-center text-slate-400">Aucune notification.</div>}
      </div>
    </div>
  );
}
