"use client";

import { useState } from "react";
import Link from "next/link";
import { addDaysToIso, formatDayShort } from "@/lib/week";
import { DAY_LABELS, SHIFT_TYPE_LABELS, MORNING_SHIFT, EVENING_SHIFT, type ShiftType } from "@/lib/types";
import { holidayName } from "@/lib/holidays";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

function initials(firstName: string, lastName: string) {
  return `${(firstName || "?").charAt(0)}${(lastName || "?").charAt(0)}`.toUpperCase();
}

function tint(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function machineNameLines(name: string): string[] {
  const idx = name.indexOf("-");
  if (idx === -1) return [name];
  return [name.slice(0, idx), name.slice(idx + 1)];
}

type Period = "matin" | "soir";
type CellKey = { machineId: string; day: number; period: Period };

export default function ApercuClient({
  isAdmin,
  startDate,
  week,
  machines,
  workShifts,
  leaveShifts,
  closures,
  merms,
}: {
  isAdmin: boolean;
  startDate: string;
  week: any;
  machines: any[];
  workShifts: any[];
  leaveShifts: any[];
  closures: any[];
  merms: any[];
}) {
  const days = [0, 1, 2, 3, 4].map((d) => ({
    day: d,
    label: DAY_LABELS[d],
    dateIso: addDaysToIso(startDate, d),
  }));

  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [replaceSelections, setReplaceSelections] = useState<Record<string, string>>({});
  const [addProfileId, setAddProfileId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const today = new Date();
  const generatedOn = today.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const periodLabel = `${formatDayShort(startDate)} – ${formatDayShort(addDaysToIso(startDate, 4))} ${new Date(startDate + "T00:00:00").getFullYear()}`;

  function goTo(offsetWeeks: number) {
    const next = addDaysToIso(startDate, offsetWeeks * 7);
    window.location.href = `/planning/apercu?semaine=${next}`;
  }

  function toggleCell(cell: CellKey) {
    const same = editingCell && editingCell.machineId === cell.machineId && editingCell.day === cell.day && editingCell.period === cell.period;
    setEditingCell(same ? null : cell);
    setAddProfileId("");
    setActionError(null);
  }

  async function replaceShift(shiftId: string) {
    const newProfileId = replaceSelections[shiftId];
    if (!newProfileId) return;
    setBusyId(shiftId);
    setActionError(null);
    try {
      const res = await fetch(`/api/planning/creneaux/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: newProfileId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        window.location.reload();
      } else if (res.status === 409) {
        setActionError("Cette personne a déjà un créneau qui chevauche cet horaire ce jour-là.");
      } else {
        setActionError(data?.error || `Erreur serveur (${res.status}).`);
      }
    } catch (e: any) {
      setActionError(e?.message || "Échec de connexion au serveur.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeShift(shiftId: string) {
    if (!confirm("Retirer cette personne de ce créneau ?")) return;
    setBusyId(shiftId);
    setActionError(null);
    try {
      const res = await fetch(`/api/planning/creneaux/${shiftId}`, { method: "DELETE" });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || `Erreur serveur (${res.status}).`);
      }
    } catch (e: any) {
      setActionError(e?.message || "Échec de connexion au serveur.");
    } finally {
      setBusyId(null);
    }
  }

  async function addToCell(machineId: string, day: number, period: Period) {
    if (!week || !addProfileId) return;
    setBusyId("adding");
    setActionError(null);
    try {
      const times = period === "matin" ? MORNING_SHIFT : EVENING_SHIFT;
      const res = await fetch("/api/planning/creneaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId: week.id,
          profileId: addProfileId,
          dayOfWeek: day,
          startTime: times.start,
          endTime: times.end,
          shiftType: "work",
          machineId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        window.location.reload();
      } else if (res.status === 409) {
        setActionError("Cette personne a déjà un créneau qui chevauche cet horaire ce jour-là.");
      } else {
        setActionError(data?.error || `Erreur serveur (${res.status}).`);
      }
    } catch (e: any) {
      setActionError(e?.message || "Échec de connexion au serveur.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={() => goTo(-1)}>← Semaine précédente</button>
          <button className="btn-secondary" onClick={() => goTo(1)}>Semaine suivante →</button>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>🖨️ Imprimer / PDF</button>
          <Link href="/planning/postes" className="btn-secondary">Vue détaillée</Link>
        </div>
      </div>

      {isAdmin && week && (
        <p className="text-xs text-slate-400 print:hidden">
          Clique sur ✏️ à côté d'un poste pour remplacer ou retirer une personne, ou en ajouter une directement depuis cette vue.
        </p>
      )}

      {!week && (
        <div className="card p-8 text-center text-slate-400 space-y-3">
          <p>Aucun planning créé pour cette semaine.</p>
          <Link href="/planning/postes" className="btn-primary inline-block">✏️ Créer / modifier le planning</Link>
        </div>
      )}

      {week && (
        <div className="card overflow-hidden print:shadow-none print:border-0 print:rounded-none">
          {/* En-tête façon document */}
          <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between flex-wrap gap-1">
            <div>
              <h1 className="text-lg font-bold tracking-wide">PLANNING MERM — RADIOTHÉRAPIE</h1>
              <p className="text-sm text-indigo-100">Semaine du {periodLabel}</p>
            </div>
            <p className="text-xs text-indigo-100">Généré le {generatedOn}</p>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm border-collapse min-w-[760px] print:min-w-0 print:w-full print:table-fixed">
              <thead>
                <tr>
                  <th className="px-3 py-2 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 w-28">Poste</th>
                  <th className="px-2 py-2 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 w-20">Créneau</th>
                  {days.map((d) => {
                    const holiday = holidayName(d.dateIso);
                    return (
                      <th key={d.day} className="px-3 py-2 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 min-w-[150px]">
                        {d.label} {formatDayShort(d.dateIso)}
                        {holiday && <span className="block normal-case font-normal text-amber-600">🎌 {holiday}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {machines.map((machine) => {
                  const rowBg = tint(machine.color_hex, "14");
                  return (["matin", "soir"] as const).map((period, pIdx) => {
                    const isMatin = period === "matin";
                    return (
                      <tr key={`${machine.id}_${period}`} style={{ backgroundColor: rowBg }} className="border-t border-white">
                        {pIdx === 0 && (
                          <td rowSpan={2} className="px-3 py-2 align-middle font-semibold text-slate-700 border-r border-white">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: machine.color_hex }} />
                              <span className="leading-tight">
                                {machineNameLines(machine.name).map((line, i) => (
                                  <span key={i} className="block">{line}</span>
                                ))}
                              </span>
                            </span>
                          </td>
                        )}
                        <td className="px-2 py-2 align-middle text-xs font-medium text-slate-500 border-r border-white">
                          {isMatin ? "Matin" : "Après-m."}
                        </td>
                        {days.map((d) => {
                          const holiday = holidayName(d.dateIso);
                          const dayClosures = closures.filter((c) => c.machine_id === machine.id && c.date === d.dateIso);
                          const closedAllDay = dayClosures.some((c) => !c.start_time);
                          const periodBounds = isMatin ? { start: "08:00", end: "13:00" } : { start: "13:00", end: "21:00" };
                          const closedThisPeriod =
                            closedAllDay ||
                            dayClosures.some((c) => c.start_time && overlaps(c.start_time, c.end_time, periodBounds.start, periodBounds.end));
                          const occupants = workShifts.filter(
                            (s) =>
                              s.machine_id === machine.id &&
                              s.day_of_week === d.day &&
                              (isMatin ? s.start_time < "13:00" : s.start_time >= "13:00")
                          );
                          const cell: CellKey = { machineId: machine.id, day: d.day, period };
                          const isEditingThis =
                            !!editingCell && editingCell.machineId === cell.machineId && editingCell.day === cell.day && editingCell.period === cell.period;
                          const closedHere = holiday || closedThisPeriod;

                          return (
                            <td key={d.day} className="px-2 py-1.5 align-top border-r border-white">
                              {holiday ? (
                                <span className="text-xs italic text-amber-700">Fermé (férié)</span>
                              ) : closedThisPeriod ? (
                                <span className="text-xs italic text-slate-400">Fermé</span>
                              ) : occupants.length === 0 ? (
                                <span className="text-xs text-slate-300">—</span>
                              ) : (
                                <div className="space-y-1">
                                  {occupants.map((s: any) => (
                                    <div key={s.id} className="flex items-center gap-1.5 bg-white/70 rounded-md px-1.5 py-1">
                                      <span
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                        style={{ backgroundColor: machine.color_hex }}
                                      >
                                        {initials(s.profiles?.first_name, s.profiles?.last_name)}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-slate-800 truncate">
                                          {s.profiles?.first_name} {s.profiles?.last_name}
                                        </p>
                                        {s.profiles?.phone && <p className="text-[10px] text-slate-400 truncate">{s.profiles.phone}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isAdmin && !closedHere && (
                                <button
                                  className="print:hidden mt-1 text-[10px] text-slate-400 hover:text-brand-600"
                                  onClick={() => toggleCell(cell)}
                                >
                                  {isEditingThis ? "Fermer" : "✏️ Modifier"}
                                </button>
                              )}

                              {isAdmin && isEditingThis && (
                                <div className="print:hidden mt-1.5 space-y-1.5 border-t border-slate-200 pt-1.5">
                                  {occupants.map((s: any) => (
                                    <div key={s.id} className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[10px] text-slate-500 truncate max-w-[70px]">{s.profiles?.last_name}</span>
                                      <select
                                        className="input text-[11px] py-0.5 px-1 flex-1 min-w-[90px]"
                                        value={replaceSelections[s.id] || ""}
                                        onChange={(e) => setReplaceSelections((r) => ({ ...r, [s.id]: e.target.value }))}
                                      >
                                        <option value="">Remplacer par...</option>
                                        {merms
                                          .filter((m) => m.id !== s.profile_id)
                                          .map((m) => (
                                            <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                                          ))}
                                      </select>
                                      <button
                                        className="btn-primary text-[10px] px-1.5 py-0.5"
                                        disabled={!replaceSelections[s.id] || busyId === s.id}
                                        onClick={() => replaceShift(s.id)}
                                      >
                                        OK
                                      </button>
                                      <button
                                        className="btn-secondary text-[10px] px-1.5 py-0.5"
                                        disabled={busyId === s.id}
                                        onClick={() => removeShift(s.id)}
                                      >
                                        Retirer
                                      </button>
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-1">
                                    <select
                                      className="input text-[11px] py-0.5 px-1 flex-1"
                                      value={addProfileId}
                                      onChange={(e) => setAddProfileId(e.target.value)}
                                    >
                                      <option value="">+ Ajouter...</option>
                                      {merms.map((m) => (
                                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                                      ))}
                                    </select>
                                    <button
                                      className="btn-secondary text-[10px] px-1.5 py-0.5"
                                      disabled={!addProfileId || busyId === "adding"}
                                      onClick={() => addToCell(machine.id, d.day, period)}
                                    >
                                      Ajouter
                                    </button>
                                  </div>
                                  {actionError && <p className="text-[10px] text-red-600">{actionError}</p>}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })}

                {/* Congés / absences, fusionnées en bas comme sur le modèle */}
                <tr className="border-t-2 border-red-200" style={{ backgroundColor: "#fef2f2" }}>
                  <td colSpan={2} className="px-3 py-2 align-top font-semibold text-red-700">Congés</td>
                  {days.map((d) => {
                    const dayLeaves = leaveShifts.filter((s) => s.day_of_week === d.day);
                    return (
                      <td key={d.day} className="px-2 py-2 align-top">
                        {dayLeaves.length === 0 ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : (
                          <div className="space-y-1">
                            {dayLeaves.map((s: any) => (
                              <p key={s.id} className="text-xs text-red-700 leading-tight">
                                {s.profiles?.first_name} {s.profiles?.last_name}
                                <br />
                                <span className="text-red-400">{SHIFT_TYPE_LABELS[s.shift_type as ShiftType] || s.shift_type}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="font-medium text-slate-600">Légende :</span>
            {machines.map((m) => (
              <span key={m.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: m.color_hex }} />
                {m.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-200" />
              Congés / absences
            </span>
          </div>

          <div className="px-5 py-2 border-t border-slate-100 text-center text-[11px] text-slate-400">
            Planning MERM — document généré automatiquement · Semaine du {periodLabel}
          </div>
        </div>
      )}
    </div>
  );
}
