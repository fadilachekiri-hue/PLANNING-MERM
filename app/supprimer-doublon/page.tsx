"use client";

import { useState } from "react";

export default function SupprimerDoublonPage() {
  const [form, setForm] = useState({ secret: "", firstName: "", lastName: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ identifiant: string; job_title: string | null } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup/supprimer-doublon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.candidates ? `${data.error} (${data.candidates.length} trouvés)` : data.error);
        return;
      }
      setResult(data.deleted);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <h1 className="text-lg font-semibold mb-2">Profil supprimé ✅</h1>
          <p className="text-sm text-slate-600 mb-6">
            Identifiant supprimé : <span className="font-mono">{result.identifiant}</span>
            {result.job_title ? ` (${result.job_title})` : ""}
          </p>
          <button className="btn-primary w-full" onClick={() => (window.location.href = "/tableau-de-bord")}>
            Retour à l'application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold mb-1">Supprimer un doublon</h1>
        <p className="text-sm text-slate-500 mb-6">
          Ne fonctionne que sur un profil <strong>en attente d'activation</strong> (jamais un compte actif ni le
          compte propriétaire).
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Code d'installation</label>
            <input className="input" type="password" required value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Prénom</label>
              <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Nom</label>
              <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? "Suppression..." : "Supprimer ce profil"}</button>
        </form>
      </div>
    </div>
  );
}
