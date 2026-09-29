"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Combo } from "@/lib/pairing";

export default function BinomesClient({ machines, startDate, paired }: { machines: any[]; startDate: string; paired: any[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ day: startDate, startTime: "08:00", endTime: "16:00", machineId: machines[0]?.id || "" });
  const [loading, setLoading] = useState(false);
  const [combos, setCombos] = useState<Combo[] | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [validated, setValidated] = useState<string | null>(null);

  async function propose() {
    setLoading(true);
    setCombos(null);
    setDiagnostic(null);
    setValidated(null);
    try {
      const res = await fetch("/api/binomes/proposer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiagnostic(data.error || "Erreur.");
        return;
      }
      setCombos(data.combos);
      setDiagnostic(data.diagnostic);
    } finally {
      setLoading(false);
    }
  }

  async function validate(combo: Combo) {
    const res = await fetch("/api/binomes/valider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, profileIds: combo.profileIds }),
    });
    if (res.ok) {
      setValidated(combo.names.join(" + "));
      setCombos(null);
      router.refresh();
    }
  }

  const pairs = groupBy(paired, "pair_id");

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Binômes</h1>
      <p className="text-sm text-slate-500 mb-6">
        L'application propose des associations compatibles ; vous choisissez et validez toujours vous-même.
      </p>

      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-3">Proposer des binômes</h2>
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div>
            <label className="field-label">Jour</label>
            <input type="date" className="input" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Début</label>
            <input type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Fin</label>
            <input type="time" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Poste</label>
            <select className="input" value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })}>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <button className="btn-primary" onClick={propose} disabled={loading}>{loading ? "Recherche..." : "Proposer des binômes"}</button>

        {validated && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-4">Binôme validé et ajouté au planning : {validated}.</p>}
        {diagnostic && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">{diagnostic}</p>}

        {combos && combos.length > 0 && (
          <div className="mt-4 space-y-3">
            {combos.map((c, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.names.join(" + ")}</p>
                  {c.issues.length === 0 ? (
                    <p className="text-xs text-green-700">Aucune contrainte non satisfaite.</p>
                  ) : (
                    <ul className="text-xs text-amber-700 list-disc pl-4">
                      {c.issues.map((issue, j) => <li key={j}>{issue}</li>)}
                    </ul>
                  )}
                </div>
                <button className="btn-primary text-xs" onClick={() => validate(c)}>Valider ce binôme</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Binômes déjà en place — semaine du {startDate}</h2>
        {Object.keys(pairs).length === 0 && <p className="text-sm text-slate-400">Aucun binôme enregistré pour cette semaine.</p>}
        <div className="space-y-2">
          {Object.entries(pairs).map(([pairId, shifts]: [string, any[]]) => (
            <div key={pairId} className="flex items-center gap-2 text-sm border border-slate-100 rounded-lg p-2">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: shifts[0]?.machines?.color_hex }} />
              <span className="font-medium">{shifts[0]?.machines?.name}</span>
              <span className="text-slate-400">{shifts[0]?.start_time?.slice(0, 5)}-{shifts[0]?.end_time?.slice(0, 5)}</span>
              <span>{shifts.map((s) => `${s.profiles?.first_name} ${s.profiles?.last_name}`).join(" + ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function groupBy(list: any[], key: string) {
  const out: Record<string, any[]> = {};
  for (const item of list) {
    const k = item[key];
    if (!k) continue;
    out[k] = out[k] || [];
    out[k].push(item);
  }
  return out;
}
