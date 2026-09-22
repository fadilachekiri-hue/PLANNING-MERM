"use client";

import { useState } from "react";

type Report = {
  profilesCreated: string[];
  profilesReused: string[];
  weeksCreated: number;
  shiftsCreated: number;
  shiftsSkipped: number;
  errors: string[];
};

export default function ImporterPlanningPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup/importer-planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur pendant l'import.");
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
          <h1 className="text-lg font-semibold mb-4">Import terminé ✅</h1>
          <ul className="text-sm text-slate-600 space-y-1 mb-4">
            <li>Profils créés : {report.profilesCreated.length} ({report.profilesCreated.join(", ") || "—"})</li>
            <li>Profils déjà existants réutilisés : {report.profilesReused.length} ({report.profilesReused.join(", ") || "—"})</li>
            <li>Semaines créées : {report.weeksCreated}</li>
            <li>Créneaux créés : {report.shiftsCreated}</li>
            <li>Créneaux déjà présents (ignorés) : {report.shiftsSkipped}</li>
          </ul>
          {report.errors.length > 0 && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <p className="font-medium mb-1">Quelques erreurs :</p>
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
      <div className="card w-full max-w-md p-8">
        <h1 className="text-lg font-semibold mb-1">Importer le planning (septembre → décembre 2026)</h1>
        <p className="text-sm text-slate-500 mb-6">
          Crée les profils manquants (nom de famille seul, prénom "MERM" à corriger ensuite) et les créneaux de
          septembre à décembre 2026 à partir du fichier Excel transmis. Horaires par défaut (matin 08h-15h36 / soir
          13h24-21h00), sans poste (machine) assigné — à compléter ensuite dans l'application. Peut être relancé
          sans créer de doublons.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Code d'installation</label>
            <input className="input" type="password" required value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? "Import en cours..." : "Importer"}</button>
        </form>
      </div>
    </div>
  );
}
