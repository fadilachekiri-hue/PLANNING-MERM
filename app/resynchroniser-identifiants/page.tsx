"use client";

import { useState } from "react";

type Report = { resynchronises: string[]; inchanges: number; errors: string[] };

export default function ResynchroniserIdentifiantsPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup/resynchroniser-identifiants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur.");
        return;
      }
      setReport(data.report);
    } finally {
      setSaving(false);
    }
  }

  if (report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
        <div className="card w-full max-w-lg p-8">
          <h1 className="text-lg font-semibold mb-4">Resynchronisation terminée ✅</h1>
          <p className="text-sm text-slate-600 mb-2">Déjà à jour : {report.inchanges}</p>
          {report.resynchronises.length > 0 && (
            <div className="text-sm text-slate-600 mb-4">
              <p className="font-medium mb-1">Identifiants corrigés ({report.resynchronises.length}) :</p>
              <ul className="list-disc pl-4">
                {report.resynchronises.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {report.errors.length > 0 && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <p className="font-medium mb-1">Erreurs :</p>
              <ul className="list-disc pl-4">
                {report.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <button className="btn-primary w-full" onClick={() => (window.location.href = "/equipe")}>
            Aller à l'équipe
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold mb-1">Resynchroniser les identifiants</h1>
        <p className="text-sm text-slate-500 mb-6">
          Recalcule l'identifiant de connexion de chaque membre à partir de son prénom/nom actuel. Utile si des noms
          ont été corrigés directement en base plutôt que via le bouton "Modifier" dans Équipe.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Code d'installation</label>
            <input className="input" type="password" required value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? "En cours..." : "Resynchroniser"}</button>
        </form>
      </div>
    </div>
  );
}
