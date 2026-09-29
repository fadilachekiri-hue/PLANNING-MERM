"use client";

import { useState } from "react";

type Report = { corrigees: string[]; fusionnees: string[]; aTraiterManuellement: string[]; errors: string[] };

export default function CorrigerSemainesDecaleesPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup/corriger-semaines-decalees", {
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
            <li>Semaines recalées sur le bon lundi : {report.corrigees.length}</li>
            <li>Semaines fusionnées avec une semaine correcte existante : {report.fusionnees.length}</li>
          </ul>
          {report.aTraiterManuellement.length > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <p className="font-medium mb-1">À traiter manuellement (contient des créneaux) :</p>
              <ul className="list-disc pl-4">
                {report.aTraiterManuellement.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
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
        <h1 className="text-lg font-semibold mb-1">Corriger les semaines décalées</h1>
        <p className="text-sm text-slate-500 mb-6">
          Recale sur le lundi toute semaine dont la date de début ne tombe pas un lundi (fusionne avec la bonne
          semaine si elle existe déjà). Les semaines avec des créneaux sont laissées de côté et signalées.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Code d'installation</label>
            <input className="input" type="password" required value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? "En cours..." : "Corriger"}</button>
        </form>
      </div>
    </div>
  );
}
