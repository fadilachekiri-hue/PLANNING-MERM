"use client";

import { useState } from "react";

type Report = {
  postesAssignesSeptOct: number;
  creneauxIntrouvablesSeptOct: string[];
  postesAssignesNovDec: number;
  creneauxCreesNovDec: number;
  erreursNovDec: string[];
  avertissement: string | null;
};

export default function AssignerPostesPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup/assigner-postes", {
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
          {report.avertissement && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">{report.avertissement}</p>
          )}
          <ul className="text-sm text-slate-600 space-y-1 mb-4">
            <li>Postes assignés (septembre-octobre) : {report.postesAssignesSeptOct}</li>
            <li>Créneaux proposés (novembre-décembre) créés : {report.creneauxCreesNovDec}</li>
            <li>Postes assignés sur créneaux déjà existants (novembre-décembre) : {report.postesAssignesNovDec}</li>
          </ul>
          {report.creneauxIntrouvablesSeptOct.length > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <p className="font-medium mb-1">Créneaux non retrouvés (septembre-octobre, {report.creneauxIntrouvablesSeptOct.length}) :</p>
              <ul className="text-xs list-disc pl-4">
                {report.creneauxIntrouvablesSeptOct.slice(0, 200).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
              {report.creneauxIntrouvablesSeptOct.length > 200 && <p className="text-xs mt-1">… et {report.creneauxIntrouvablesSeptOct.length - 200} de plus.</p>}
            </div>
          )}
          {report.erreursNovDec.length > 0 && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <p className="font-medium mb-1">Erreurs (novembre-décembre) :</p>
              <ul className="list-disc pl-4 text-xs">
                {report.erreursNovDec.slice(0, 200).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <button className="btn-primary w-full" onClick={() => (window.location.href = "/planning")}>
            Aller au planning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-lg font-semibold mb-1">Assigner les postes (septembre → décembre)</h1>
        <p className="text-sm text-slate-500 mb-6">
          Septembre-octobre : assigne le poste (Clinac/Unity/Versa HD/Scanner) déduit des couleurs du fichier Excel
          sur les créneaux déjà importés. Novembre-décembre : propose un planning complet (brouillon, non publié)
          à partir des habilitations et contraintes de chaque manip — à relire et publier semaine par semaine.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Code d'installation</label>
            <input className="input" type="password" required value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? "En cours..." : "Appliquer"}</button>
        </form>
      </div>
    </div>
  );
}
