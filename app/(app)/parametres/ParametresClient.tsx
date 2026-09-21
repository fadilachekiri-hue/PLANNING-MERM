"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_LABELS } from "@/lib/types";

export default function ParametresClient({ machines, rules, minStaffing }: { machines: any[]; rules: any[]; minStaffing: any[] }) {
  const router = useRouter();
  const [local, setLocal] = useState(() =>
    Object.fromEntries(
      machines.map((m) => {
        const r = rules.find((x) => x.machine_id === m.id);
        return [m.id, { minAutonomous: r?.min_autonomous ?? 1, teamSize: r?.team_size ?? 2, allowTrainingWithSupervisor: r?.allow_training_with_supervisor ?? false, notes: r?.notes ?? "" }];
      })
    )
  );
  const [saved, setSaved] = useState<string | null>(null);

  async function saveRule(machineId: string) {
    await fetch(`/api/parametres/regles-binomes/${machineId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(local[machineId]),
    });
    setSaved(machineId);
    setTimeout(() => setSaved(null), 1500);
  }

  const [staffForm, setStaffForm] = useState({ machineId: machines[0]?.id || "", dayOfWeek: 0, startTime: "08:00", endTime: "16:00", minCount: 1 });

  async function addStaffRule(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/parametres/effectifs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staffForm),
    });
    router.refresh();
  }

  async function removeStaffRule(id: string) {
    await fetch(`/api/parametres/effectifs/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Paramètres</h1>

      <div className="card p-5">
        <h2 className="font-semibold mb-1">Règles de composition des binômes</h2>
        <p className="text-sm text-slate-500 mb-4">Ces règles sont utilisées par l'outil « Proposer des binômes ». Elles ne s'appliquent jamais automatiquement au planning.</p>
        <div className="space-y-4">
          {machines.map((m) => (
            <div key={m.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: m.color_hex }} />
                <p className="font-medium">{m.name}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="field-label">Effectif attendu</label>
                  <input type="number" min={1} max={6} className="input" value={local[m.id].teamSize} onChange={(e) => setLocal({ ...local, [m.id]: { ...local[m.id], teamSize: Number(e.target.value) } })} />
                </div>
                <div>
                  <label className="field-label">Nb minimum de personnes autonomes</label>
                  <input type="number" min={0} max={6} className="input" value={local[m.id].minAutonomous} onChange={(e) => setLocal({ ...local, [m.id]: { ...local[m.id], minAutonomous: Number(e.target.value) } })} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={local[m.id].allowTrainingWithSupervisor} onChange={(e) => setLocal({ ...local, [m.id]: { ...local[m.id], allowTrainingWithSupervisor: e.target.checked } })} />
                    Autoriser une personne en formation si encadrée
                  </label>
                </div>
              </div>
              <input className="input mb-3" placeholder="Notes (facultatif)" value={local[m.id].notes} onChange={(e) => setLocal({ ...local, [m.id]: { ...local[m.id], notes: e.target.value } })} />
              <button className="btn-secondary text-xs" onClick={() => saveRule(m.id)}>{saved === m.id ? "Enregistré ✓" : "Enregistrer"}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-1">Effectifs minimums par poste</h2>
        <p className="text-sm text-slate-500 mb-4">Utilisés pour générer les alertes dans la Vue par postes.</p>

        <form onSubmit={addStaffRule} className="grid grid-cols-5 gap-2 mb-4">
          <select className="input" value={staffForm.machineId} onChange={(e) => setStaffForm({ ...staffForm, machineId: e.target.value })}>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="input" value={staffForm.dayOfWeek} onChange={(e) => setStaffForm({ ...staffForm, dayOfWeek: Number(e.target.value) })}>
            {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <input type="time" className="input" value={staffForm.startTime} onChange={(e) => setStaffForm({ ...staffForm, startTime: e.target.value })} />
          <input type="time" className="input" value={staffForm.endTime} onChange={(e) => setStaffForm({ ...staffForm, endTime: e.target.value })} />
          <div className="flex gap-2">
            <input type="number" min={1} className="input" value={staffForm.minCount} onChange={(e) => setStaffForm({ ...staffForm, minCount: Number(e.target.value) })} />
            <button className="btn-primary text-xs whitespace-nowrap">Ajouter</button>
          </div>
        </form>

        <div className="space-y-1">
          {minStaffing.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-t border-slate-100 py-2">
              <span>{r.machines?.name} — {DAY_LABELS[r.day_of_week]} {r.start_time?.slice(0, 5)}-{r.end_time?.slice(0, 5)} : {r.min_count} personne(s) minimum</span>
              <button className="text-xs text-red-500 hover:underline" onClick={() => removeStaffRule(r.id)}>Supprimer</button>
            </div>
          ))}
          {minStaffing.length === 0 && <p className="text-sm text-slate-400">Aucune règle définie.</p>}
        </div>
      </div>
    </div>
  );
}
