"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPE_LABEL: Record<string, string> = { conge: "Congé", rtt: "RTT", absence: "Absence", indisponibilite: "Indisponibilité" };
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "Acceptée", cls: "bg-green-50 text-green-700" },
  rejected: { label: "Refusée", cls: "bg-red-50 text-red-700" },
};

export default function DemandesClient({ isAdmin, requests }: { isAdmin: boolean; requests: any[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ type: "conge", dateStart: "", dateEnd: "", comment: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);

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
      router.refresh();
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
    if (res.ok && data.daysNeedingReview?.length > 0) {
      setReviewNotice(
        `Attention : ${data.daysNeedingReview.join(", ")} — un créneau de travail existait déjà, à revoir manuellement dans le Planning.`
      );
    }
    router.refresh();
  }

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

      {reviewNotice && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">{reviewNotice}</p>}

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
