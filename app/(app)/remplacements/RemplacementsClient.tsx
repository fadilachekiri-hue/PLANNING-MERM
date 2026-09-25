"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemplacementsClient({ isAdmin, requests, machines, activeProfiles }: { isAdmin: boolean; requests: any[]; machines: any[]; activeProfiles: any[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ day: "", startTime: "08:00", endTime: "16:00", machineId: "", reason: "", candidateIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.candidateIds.length === 0) {
      setError("Sélectionnez au moins une personne à solliciter.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/remplacements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function respond(id: string, response: "available" | "unavailable") {
    await fetch(`/api/remplacements/${id}/reponse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
    router.refresh();
  }

  async function confirmChoice(id: string, profileId: string) {
    await fetch(`/api/remplacements/${id}/confirmer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    router.refresh();
  }

  async function cancel(id: string) {
    if (!confirm("Annuler cette recherche de remplaçant ?")) return;
    await fetch(`/api/remplacements/${id}/annuler`, { method: "POST" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Remplacements</h1>
        {isAdmin && <button className="btn-primary" onClick={() => setShowForm(true)}>+ Rechercher un remplaçant</button>}
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="field-label">Jour</label>
                <input type="date" className="input" required value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Début</label>
                <input type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Fin</label>
                <input type="time" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="field-label">Poste</label>
              <select className="input" value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })}>
                <option value="">Non précisé</option>
                {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Motif (facultatif)</label>
              <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Personnes à solliciter</label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {activeProfiles.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.candidateIds.includes(p.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          candidateIds: e.target.checked ? [...form.candidateIds, p.id] : form.candidateIds.filter((id) => id !== p.id),
                        })
                      }
                    />
                    {p.first_name} {p.last_name}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Envoi..." : "Envoyer la demande"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {r.day} — {r.start_time?.slice(0, 5)} à {r.end_time?.slice(0, 5)} {r.machines?.name ? `(${r.machines.name})` : ""}
                </p>
                {r.reason && <p className="text-xs text-slate-500">{r.reason}</p>}
                <span className={`badge mt-1 ${r.status === "open" ? "bg-amber-50 text-amber-700" : r.status === "filled" ? "bg-green-50 text-green-700" : "bg-slate-200 text-slate-600"}`}>
                  {r.status === "open" ? "Ouvert" : r.status === "filled" ? "Pourvu" : "Annulé"}
                </span>
              </div>
              {isAdmin && r.status === "open" && (
                <button className="btn-secondary text-xs" onClick={() => cancel(r.id)}>Annuler la recherche</button>
              )}
            </div>

            {isAdmin && r.replacement_candidates && (
              <div className="mt-3 space-y-1">
                {r.replacement_candidates.map((c: any) => (
                  <div key={c.profile_id} className="flex items-center justify-between text-xs">
                    <span>
                      {c.profiles?.first_name} {c.profiles?.last_name} —{" "}
                      <span className={c.response === "available" ? "text-green-700" : c.response === "unavailable" ? "text-red-600" : "text-slate-400"}>
                        {c.response === "available" ? "Disponible" : c.response === "unavailable" ? "Indisponible" : "Pas encore répondu"}
                      </span>
                    </span>
                    {r.status === "open" && c.response === "available" && (
                      <button className="btn-primary text-xs" onClick={() => confirmChoice(r.id, c.profile_id)}>Choisir cette personne</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isAdmin && r.status === "open" && !r.myResponse && (
              <div className="flex gap-2 mt-3">
                <button className="btn-primary text-xs" onClick={() => respond(r.id, "available")}>Disponible</button>
                <button className="btn-secondary text-xs" onClick={() => respond(r.id, "unavailable")}>Indisponible</button>
              </div>
            )}
            {!isAdmin && r.myResponse && (
              <p className="text-xs mt-2 text-slate-500">Votre réponse : {r.myResponse === "available" ? "Disponible" : "Indisponible"}</p>
            )}
          </div>
        ))}
        {requests.length === 0 && <div className="card p-8 text-center text-slate-400">Aucune demande de remplacement.</div>}
      </div>
    </div>
  );
}
