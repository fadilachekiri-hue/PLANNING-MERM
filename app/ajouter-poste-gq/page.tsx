"use client";

import { useState } from "react";

type Report = {
  posteDejaExistant: boolean;
  posteCree: boolean;
  gloriaTrouvee: boolean;
  habiliteeSurGQ: boolean;
  errors: string[];
  tousLesPostes: string[];
};

export default function AjouterPosteGQPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup/ajouter-poste-gq", {
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
          <h1 className="text-lg font-semibold mb-4">Terminé ✅</h1>
          <ul className="text-sm text-slate-600 space-y-1 mb-4">
            <li>Poste GQ déjà existant : {report.posteDejaExistant ? "oui" : "non"}</li>
            <li>Poste GQ créé : {report.posteCree ? "oui" : "non"}</li>
            <li>Gloria Fonteneau trouvée : {report.gloriaTrouvee ? "oui" : "non"}</li>
            <li>Gloria habilitée sur GQ : {report.habiliteeSurGQ ? "oui" : "non"}</li>
          </ul>
          {report.errors.length > 0 && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <p className="font-medium mb-1">Erreurs :</p>
              <ul className="list-disc pl-4">
                {report.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">
            <p className="font-medium mb-1">Tous les postes en base (diagnostic) :</p>
            <ul className="list-disc pl-4">
              {report.tousLesPostes.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
          <button className="btn-primary w-full" onClick={() => (window.location.href = "/planning")}>
            Aller au planning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold mb-1">Ajouter le poste GQ</h1>
        <p className="text-sm text-slate-500 mb-6">
          Crée le poste "GQ" (travail qualité) s'il n'existe pas encore et habilite Gloria Fonteneau dessus.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Code d'installation</label>
            <input className="input" type="password" required value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? "En cours..." : "Ajouter"}</button>
        </form>
      </div>
    </div>
  );
}
