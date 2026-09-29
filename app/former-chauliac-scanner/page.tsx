"use client";

import { useState } from "react";

type Report = {
  chauliacTrouvee: boolean;
  scannerTrouve: boolean;
  niveauApplique: boolean;
  niveauDejaSuffisant: boolean;
  errors: string[];
};

export default function FormerChauliacScannerPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup/former-chauliac-scanner", {
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
            <li>Chauliac trouvée : {report.chauliacTrouvee ? "oui" : "non"}</li>
            <li>Poste Scanner trouvé : {report.scannerTrouve ? "oui" : "non"}</li>
            <li>Niveau "en formation" appliqué : {report.niveauApplique ? "oui" : "non"}</li>
            <li>Niveau déjà suffisant (inchangé) : {report.niveauDejaSuffisant ? "oui" : "non"}</li>
          </ul>
          {report.errors.length > 0 && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <p className="font-medium mb-1">Erreurs :</p>
              <ul className="list-disc pl-4">
                {report.errors.map((e, i) => <li key={i}>{e}</li>)}
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
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold mb-1">Former Chauliac au Scanner</h1>
        <p className="text-sm text-slate-500 mb-6">
          Place Chauliac en niveau "en formation" sur le Scanner, sans toucher au reste de ses habilitations.
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
