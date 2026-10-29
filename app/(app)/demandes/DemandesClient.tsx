"use client";

import { useState } from "react";

const TYPE_LABEL: Record<string, string> = { conge: "Congé", rtt: "RTT", absence: "Absence", indisponibilite: "Indisponibilité" };
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "Acceptée", cls: "bg-green-50 text-green-700" },
  rejected: { label: "Refusée", cls: "bg-red-50 text-red-700" },
};

const DAY_LABELS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

type ImpactItem = {
  date: string;
  weekId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  machineId: string;
  machineName: string;
  period: "matin" | "soir";
  remainingTeammates: { id: string; name: string }[];
  combos: { profileIds: string[]; names: string[]; issues: string[]; score: number }[];
  diagnostic: string | null;
};

export default function DemandesClient({ isAdmin, requests }: { isAdmin: boolean; requests: any[] }) {
  const [form, setForm] = useState({ type: "conge", dateStart: "", dateEnd: "", comment: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [impact, setImpact] = useState<ImpactItem[]>([]);
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/demandes", {
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
      setForm({ type: "conge", dateStart: "", dateEnd: "", comment: "" });
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function decide(id: string, status: "approved" | "rejected") {
    const comment = status === "rejected" ? prompt("Commentaire (facultatif) :") || "" : "";
    const res = await fetch(`/api/demandes/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment }),
    });
    const data = await res.json();
    if (res.ok && data.impact?.length > 0) {
      // Des postes se libèrent : on affiche les propositions de remplacement
      // calculées automatiquement au lieu de recharger tout de suite — rien
      // n'est appliqué tant que la cadre n'a pas choisi (ou ignoré).
      setImpact(data.impact);
      return;
    }
    window.location.reload();
  }

  function impactKey(item: ImpactItem) {
    return `${item.weekId}_${item.dayOfWeek}_${item.startTime}`;
  }

  async function applyReplacement(item: ImpactItem, combo: ImpactItem["combos"][number]) {
    const key = impactKey(item);
    setApplying(key);
    try {
      const res = await fetch("/api/planning/absences/remplacer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId: item.weekId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          machineId: item.machineId,
          profileIds: combo.profileIds,
        }),
      });
      if (res.ok) {
        setResolvedKeys((prev) => new Set(prev).add(key));
      }
    } finally {
      setApplying(null);
    }
  }

  const allResolved = impact.length > 0 && impact.every((it) => resolvedKeys.has(impactKey(it)));

  const pending = requests.filter((r) => r.status === "pending");
  const others = requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Demandes</h1>
        {!isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ Nouvelle demande</button>
        )}
      </div>

      {impact.length > 0 && (
        <div className="card p-5 mb-6 border border-amber-200 bg-amber-50">
          <h2 className="font-semibold mb-1">Postes à réorganiser suite à cette absence</h2>
          <p className="text-sm text-slate-600 mb-4">
            Cette absence libère {impact.length} poste(s) déjà programmé(s). Voici des propositions de remplacement
            calculées automatiquement (compétences, disponibilité, heures, consignes) — choisissez-en une, ou laissez
            et modifiez vous-même dans le Planning.
          </p>
          <div className="space-y-4">
            {impact.map((item) => {
              const key = impactKey(item);
              const resolved = resolvedKeys.has(key);
              return (
                <div key={key} className="border border-slate-200 bg-white rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">
                    {DAY_LABELS[item.dayOfWeek]} {item.date} — {item.machineName} ({item.period}, {item.startTime.slice(0, 5)}-{item.endTime.slice(0, 5)})
                    {item.remainingTeammates.length > 0 && (
                      <span className="text-slate-500 font-normal"> — déjà en place : {item.remainingTeammates.map((t) => t.name).join(" + ")}</span>
                    )}
                  </p>
                  {resolved && <p className="text-sm text-green-700">Remplacement validé.</p>}
                  {!resolved && item.diagnostic && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      {item.diagnostic} — à pourvoir manuellement dans le Planning.
                    </p>
                  )}
                  {!resolved && item.combos.length > 0 && (
                    <div className="space-y-2">
                      {item.combos.map((c, i) => (
                        <div key={i} className="border border-slate-100 rounded-lg p-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm">{c.names.join(" + ")}</p>
                            {c.issues.length === 0 ? (
                              <p className="text-xs text-green-700">Aucune contrainte non satisfaite.</p>
                            ) : (
                              <ul className="text-xs text-amber-700 list-disc pl-4">
                                {c.issues.map((issue, j) => <li key={j}>{issue}</li>)}
                              </ul>
                            )}
                          </div>
                          <button
                            className="btn-primary text-xs"
                            disabled={applying === key}
                            onClick={() => applyReplacement(item, c)}
                          >
                            {applying === key ? "..." : "Valider"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn-secondary" onClick={() => window.location.reload()}>
              {allResolved ? "Terminer" : "Ignorer le reste, je modifierai moi-même"}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card p-5 mb-6">
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="field-label">Type</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Du</label>
                <input type="date" className="input" required value={form.dateStart} onChange={(e) => setForm({ ...form, dateStart: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Au</label>
                <input type="date" className="input" required value={form.dateEnd} onChange={(e) => setForm({ ...form, dateEnd: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="field-label">Commentaire (facultatif)</label>
              <input className="input" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Envoi..." : "Envoyer la demande"}</button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 mb-2">En attente ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.profiles?.first_name} {r.profiles?.last_name} — {TYPE_LABEL[r.type]}</p>
                  <p className="text-xs text-slate-500">Du {r.date_start} au {r.date_end}{r.comment ? ` — ${r.comment}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={() => decide(r.id, "approved")}>Accepter</button>
                  <button className="btn-danger text-xs" onClick={() => decide(r.id, "rejected")}>Refuser</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-2">Historique</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                {isAdmin && <th className="text-left px-4 py-2">Nom</th>}
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Dates</th>
                <th className="text-left px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {(isAdmin ? others : requests).map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  {isAdmin && <td className="px-4 py-2">{r.profiles?.first_name} {r.profiles?.last_name}</td>}
                  <td className="px-4 py-2">{TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-2">{r.date_start} → {r.date_end}</td>
                  <td className="px-4 py-2"><span className={`badge ${STATUS_LABEL[r.status].cls}`}>{STATUS_LABEL[r.status].label}</span></td>
                </tr>
              ))}
              {(isAdmin ? others : requests).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aucune demande.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
