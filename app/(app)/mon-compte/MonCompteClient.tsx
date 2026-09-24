"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_LABELS } from "@/lib/types";

export default function MonCompteClient({ profile, availabilities }: { profile: any; availabilities: any[] }) {
  const router = useRouter();
  const [shiftPreference, setShiftPreference] = useState(profile.shift_preference);
  const [overtimeOk, setOvertimeOk] = useState(profile.overtime_ok);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ dayOfWeek: 0, kind: "available", startTime: "", endTime: "", note: "" });

  async function savePrefs() {
    await fetch("/api/mon-compte", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftPreference, overtimeOk }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  async function addAvailability(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/disponibilites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    router.refresh();
  }

  async function removeAvailability(id: string) {
    await fetch(`/api/disponibilites/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-semibold">Mon compte</h1>

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Mes informations</h2>
        <p className="text-sm text-slate-500">Identifiant : <span className="font-mono">{profile.identifiant}</span></p>
        <p className="text-sm text-slate-500">Nom : {profile.first_name} {profile.last_name}</p>
        <p className="text-sm text-slate-500">Fonction : {profile.job_title || "—"}</p>
        <p className="text-sm text-slate-500">Heures contractuelles : {profile.contracted_hours}h/semaine</p>
        <p className="text-xs text-slate-400 mt-2">Ces informations sont gérées par une administratrice. Contactez-la pour toute correction.</p>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Mes préférences</h2>
        <div className="space-y-3">
          <div>
            <label className="field-label">Préférence horaire</label>
            <select className="input" value={shiftPreference} onChange={(e) => setShiftPreference(e.target.value)}>
              <option value="none">Aucune</option>
              <option value="morning">Matin</option>
              <option value="evening">Soir</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overtimeOk} onChange={(e) => setOvertimeOk(e.target.checked)} />
            Je peux effectuer des heures supplémentaires
          </label>
          <button className="btn-primary" onClick={savePrefs}>{saved ? "Enregistré ✓" : "Enregistrer"}</button>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Mes disponibilités récurrentes</h2>
        <form onSubmit={addAvailability} className="grid grid-cols-2 gap-2 mb-4">
          <select className="input" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
            {DAY_LABELS.slice(0, 6).map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="available">Disponible</option>
            <option value="unavailable">Indisponible</option>
          </select>
          <input type="time" className="input" placeholder="Début" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <input type="time" className="input" placeholder="Fin" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          <input className="input col-span-2" placeholder="Note (facultatif)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="btn-secondary col-span-2">+ Ajouter</button>
        </form>
        <div className="space-y-1">
          {availabilities.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm border-t border-slate-100 py-2">
              <span>{DAY_LABELS[a.day_of_week]} {a.start_time ? `${a.start_time.slice(0, 5)}-${a.end_time?.slice(0, 5)}` : ""} — {a.kind === "available" ? "Disponible" : "Indisponible"} {a.note ? `(${a.note})` : ""}</span>
              <button className="text-xs text-red-500 hover:underline" onClick={() => removeAvailability(a.id)}>Supprimer</button>
            </div>
          ))}
          {availabilities.length === 0 && <p className="text-sm text-slate-400">Aucune disponibilité renseignée.</p>}
        </div>
      </div>
    </div>
  );
}
