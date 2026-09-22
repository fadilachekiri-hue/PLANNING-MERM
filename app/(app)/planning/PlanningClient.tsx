"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDaysToIso, formatWeekLabel } from "@/lib/week";
import { computeWorkedHours, detectOverlaps } from "@/lib/hours";
import { DAY_LABELS, SHIFT_TYPE_LABELS, type Shift, type ShiftType } from "@/lib/types";

const TYPE_COLORS: Record<ShiftType, string> = {
  work: "",
  conge: "bg-purple-100 text-purple-700 border border-purple-200",
  rtt: "bg-indigo-100 text-indigo-700 border border-indigo-200",
  repos: "bg-slate-100 text-slate-500 border border-slate-200",
  absence: "bg-red-100 text-red-700 border border-red-200",
};

export default function PlanningClient({
  isAdmin,
  startDate,
  week,
  machines,
  members,
  shifts,
  allActiveProfiles,
}: {
  isAdmin: boolean;
  startDate: string;
  week: any;
  machines: any[];
  members: any[];
  shifts: Shift[];
  allActiveProfiles: any[];
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ profileId: string; day: number; shift?: Shift } | null>(null);
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const machineById = useMemo(() => Object.fromEntries(machines.map((m) => [m.id, m])), [machines]);

  function goTo(offsetWeeks: number) {
    const next = addDaysToIso(startDate, offsetWeeks * 7);
    router.push(`/planning?semaine=${next}`);
  }

  async function createWeek() {
    setCreating(true);
    try {
      await fetch("/api/planning/semaines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate }),
      });
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function publish() {
    if (!week) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/planning/semaines/${week.id}/publier`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  async function addMember(profileId: string) {
    if (!week || !profileId) return;
    await fetch(`/api/planning/semaines/${week.id}/membres`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    setAddingMember(false);
    router.refresh();
  }

  async function removeMember(profileId: string, name: string) {
    if (!week) return;
    if (!confirm(`Retirer ${name} de cette semaine uniquement ? Ses créneaux sur cette semaine seront supprimés (les autres semaines ne sont pas touchées).`)) return;
    await fetch(`/api/planning/semaines/${week.id}/membres/${profileId}`, { method: "DELETE" });
    router.refresh();
  }

  const availableToAdd = allActiveProfiles.filter((p) => !members.some((m) => m.id === p.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button className="btn-secondary print:hidden" onClick={() => goTo(-1)}>← Semaine précédente</button>
          <div className="text-center">
            <p className="font-semibold">{formatWeekLabel(startDate)}</p>
            {week && (
              <span className={`badge ${week.status === "published" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                {week.status === "published" ? "Publié" : "Brouillon"}
              </span>
            )}
          </div>
          <button className="btn-secondary print:hidden" onClick={() => goTo(1)}>Semaine suivante →</button>
        </div>
        <div className="flex gap-2 print:hidden">
          <button className="btn-secondary" onClick={() => window.print()}>Imprimer / PDF</button>
          <Link href="/planning/postes" className="btn-secondary">Vue par postes</Link>
          {isAdmin && !week && (
            <button className="btn-primary" onClick={createWeek} disabled={creating}>
              {creating ? "Création..." : "Créer cette semaine"}
            </button>
          )}
          {isAdmin && week && week.status === "draft" && (
            <button className="btn-primary" onClick={publish} disabled={publishing}>
              {publishing ? "Publication..." : "Publier le planning"}
            </button>
          )}
        </div>
      </div>

      <Legend machines={machines} />

      {!week && (
        <div className="card p-8 text-center text-slate-400">
          {isAdmin ? "Aucune semaine créée pour l'instant." : "Aucun planning publié pour cette semaine."}
        </div>
      )}

      {week && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-3 py-3 sticky left-0 bg-slate-50 min-w-[180px]">Nom</th>
                {DAY_LABELS.map((d, i) => (
                  <th key={i} className="text-left px-2 py-3 min-w-[150px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const memberShifts = shifts.filter((s) => s.profile_id === member.id);
                const worked = computeWorkedHours(memberShifts);
                const diff = Math.round((worked - member.contracted_hours) * 100) / 100;
                const overlapPairs = detectOverlaps(memberShifts);
                return (
                  <tr key={member.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3 sticky left-0 bg-white">
                      <p className="font-medium">{member.first_name} {member.last_name}</p>
                      <p className={`text-xs mt-0.5 ${diff < 0 ? "text-red-600" : diff > 0 ? "text-amber-600" : "text-slate-400"}`}>
                        {worked}h / {member.contracted_hours}h ({diff >= 0 ? "+" : ""}{diff}h)
                      </p>
                      {overlapPairs.length > 0 && <p className="text-xs text-red-600 mt-0.5">⚠ Chevauchement d'horaires</p>}
                      {isAdmin && (
                        <button className="text-xs text-red-500 hover:underline mt-1" onClick={() => removeMember(member.id, `${member.first_name} ${member.last_name}`)}>
                          Retirer du planning
                        </button>
                      )}
                    </td>
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                      const dayShifts = memberShifts.filter((s) => s.day_of_week === day);
                      return (
                        <td key={day} className="px-2 py-2">
                          <div className="space-y-1">
                            {dayShifts.map((s) => (
                              <Chip key={s.id} shift={s} machine={s.machine_id ? machineById[s.machine_id] : null} onClick={() => isAdmin && setEditor({ profileId: member.id, day, shift: s })} />
                            ))}
                            {isAdmin && (
                              <button
                                className="w-full text-xs text-slate-400 hover:text-brand-600 border border-dashed border-slate-200 rounded-md py-1"
                                onClick={() => setEditor({ profileId: member.id, day })}
                              >
                                + Ajouter
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">Personne n'est encore inclus dans cette semaine.</td>
                </tr>
              )}
            </tbody>
          </table>

          {isAdmin && (
            <div className="p-3 border-t border-slate-100">
              {addingMember ? (
                <select className="input max-w-xs" autoFocus onChange={(e) => addMember(e.target.value)} defaultValue="">
                  <option value="" disabled>Choisir un membre à ajouter...</option>
                  {availableToAdd.map((p) => (
                    <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                  ))}
                </select>
              ) : (
                <button className="btn-secondary text-xs" onClick={() => setAddingMember(true)}>+ Ajouter une personne à cette semaine</button>
              )}
            </div>
          )}
        </div>
      )}

      {editor && week && (
        <ShiftEditor
          weekId={week.id}
          profileId={editor.profileId}
          day={editor.day}
          shift={editor.shift}
          machines={machines}
          memberName={`${members.find((m) => m.id === editor.profileId)?.first_name} ${members.find((m) => m.id === editor.profileId)?.last_name}`}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Chip({ shift, machine, onClick }: { shift: Shift; machine: any; onClick: () => void }) {
  const label = SHIFT_TYPE_LABELS[shift.shift_type];
  if (shift.shift_type === "work") {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-md px-2 py-1 text-xs border"
        style={{ backgroundColor: (machine?.color_hex || "#cbd5e1") + "33", borderColor: machine?.color_hex || "#cbd5e1" }}
      >
        <span className="font-medium">{shift.start_time?.slice(0, 5)}–{shift.end_time?.slice(0, 5)}</span>
        <br />
        {machine?.name || "Non affecté"}
      </button>
    );
  }
  return (
    <button onClick={onClick} className={`w-full text-left rounded-md px-2 py-1 text-xs ${TYPE_COLORS[shift.shift_type]}`}>
      {label}
    </button>
  );
}

function Legend({ machines }: { machines: any[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-4 text-xs">
      {machines.map((m) => (
        <span key={m.id} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: m.color_hex }} />
          {m.name}
        </span>
      ))}
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-200" />Congé</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200" />RTT</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200" />Repos</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200" />Absence</span>
    </div>
  );
}

function ShiftEditor({
  weekId,
  profileId,
  day,
  shift,
  machines,
  memberName,
  onClose,
  onSaved,
}: {
  weekId: string;
  profileId: string;
  day: number;
  shift?: Shift;
  machines: any[];
  memberName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [shiftType, setShiftType] = useState<ShiftType>(shift?.shift_type || "work");
  const [startTime, setStartTime] = useState(shift?.start_time?.slice(0, 5) || "08:00");
  const [endTime, setEndTime] = useState(shift?.end_time?.slice(0, 5) || "16:00");
  const [machineId, setMachineId] = useState(shift?.machine_id || "");
  const [notes, setNotes] = useState(shift?.notes || "");
  const [error, setError] = useState<string | null>(null);
  const [conflictConfirm, setConflictConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(force = false) {
    setError(null);
    setSaving(true);
    const payload = {
      weekId,
      profileId,
      dayOfWeek: day,
      startTime: startTime || null,
      endTime: endTime || null,
      shiftType,
      machineId: shiftType === "work" ? machineId || null : null,
      notes,
      force,
    };
    try {
      const url = shift ? `/api/planning/creneaux/${shift.id}` : "/api/planning/creneaux";
      const method = shift ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.status === 409) {
        setConflictConfirm(true);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Erreur.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!shift) return;
    if (!confirm("Supprimer ce créneau ?")) return;
    await fetch(`/api/planning/creneaux/${shift.id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-1">{memberName} — {DAY_LABELS[day]}</h2>
        <p className="text-xs text-slate-400 mb-4">{shift ? "Modifier le créneau" : "Ajouter un créneau"}</p>

        <div className="space-y-3">
          <div>
            <label className="field-label">Type</label>
            <select className="input" value={shiftType} onChange={(e) => setShiftType(e.target.value as ShiftType)}>
              {Object.entries(SHIFT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {shiftType === "work" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Début</label>
                  <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Fin</label>
                  <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="field-label">Poste</label>
                <select className="input" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                  <option value="">Non affecté</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="field-label">Note (facultatif)</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {conflictConfirm && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Ce créneau chevauche un autre créneau existant pour cette personne ce jour-là.
              <button className="underline ml-1" onClick={() => save(true)}>Enregistrer quand même</button>
            </p>
          )}

          <div className="flex justify-between pt-2">
            {shift ? <button className="btn-danger" onClick={remove}>Supprimer</button> : <span />}
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={onClose}>Annuler</button>
              <button className="btn-primary" onClick={() => save(false)} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
