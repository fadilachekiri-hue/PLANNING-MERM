"use client";

import { useState } from "react";
import Link from "next/link";
import { addDaysToIso, formatWeekLabel, formatDayShort } from "@/lib/week";
import { DAY_LABELS, shiftPeriodLabel, MORNING_SHIFT, EVENING_SHIFT } from "@/lib/types";
import { holidayName } from "@/lib/holidays";
import MachineSelect from "../MachineSelect";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export default function PostesClient({
  isAdmin,
  startDate,
  week,
  machines,
  shifts,
  members,
  allShifts,
  minStaffing,
  closures,
}: {
  isAdmin: boolean;
  startDate: string;
  week: any;
  machines: any[];
  shifts: any[];
  members: any[];
  allShifts: any[];
  minStaffing: any[];
  closures: any[];
}) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<{ machineId: string; day: number; period: "matin" | "soir" } | null>(null);
  const [addProfileId, setAddProfileId] = useState("");
  const [addPeriod, setAddPeriod] = useState<"matin" | "soir">("matin");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairReport, setRepairReport] = useState<{ postesAssignes: number; semainesTraitees: number; introuvables: string[]; avertissement?: string } | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [buildingDecembre, setBuildingDecembre] = useState(false);
  const [decembreReport, setDecembreReport] = useState<{ postesAssignes: number; semainesCreees: number; introuvables: string[] } | null>(null);
  const [decembreError, setDecembreError] = useState<string | null>(null);

  async function construireDecembre() {
    setBuildingDecembre(true);
    setDecembreReport(null);
    setDecembreError(null);
    try {
      const res = await fetch(`/api/planning/semaines/construire-decembre-valide`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setDecembreReport(data.report);
        // Direction explicite vers la semaine du 1er décembre : rester sur la
        // semaine actuellement affichée après le rechargement donnait
        // l'impression que rien ne s'était passé (le bouton revenait juste à
        // son état initial sans qu'aucun changement ne soit visible à l'écran).
        setTimeout(() => {
          window.location.href = "/planning/postes?semaine=2026-11-30";
        }, 2500);
      } else {
        setDecembreError(data?.error || `Erreur serveur (${res.status}).`);
      }
    } catch (e: any) {
      setDecembreError(e?.message || "Échec de connexion au serveur.");
    } finally {
      setBuildingDecembre(false);
    }
  }

  async function repairPostes() {
    if (!week) return;
    setRepairing(true);
    setRepairReport(null);
    setRepairError(null);
    try {
      const res = await fetch(`/api/planning/semaines/${week.id}/reparer-postes`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setRepairReport(data.report ? { ...data.report, avertissement: data.avertissement } : null);
        // Laisse le rapport s'afficher un instant avant le rechargement complet
        // (plus fiable que router.refresh() pour montrer les postes à jour).
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setRepairError(data?.error || `Erreur serveur (${res.status}).`);
      }
    } catch (e: any) {
      setRepairError(e?.message || "Échec de connexion au serveur.");
    } finally {
      setRepairing(false);
    }
  }

  function goTo(offsetWeeks: number) {
    // Navigation en rechargement complet (plutôt que la navigation interne
    // de Next.js) : plus fiable sur certains navigateurs/PWA où le clic
    // "Semaine suivante" restait bloqué sur la même semaine.
    window.location.href = `/planning/postes?semaine=${addDaysToIso(startDate, offsetWeeks * 7)}`;
  }

  function openAdd(machineId: string, day: number, period: "matin" | "soir") {
    setAddingTo({ machineId, day, period });
    setAddProfileId("");
    setAddPeriod(period);
    setAddError(null);
  }

  async function addDirectShift() {
    if (!week || !addingTo || !addProfileId) return;
    setAddSaving(true);
    setAddError(null);
    try {
      const times = addPeriod === "matin" ? MORNING_SHIFT : EVENING_SHIFT;
      const res = await fetch("/api/planning/creneaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId: week.id,
          profileId: addProfileId,
          dayOfWeek: addingTo.day,
          startTime: times.start,
          endTime: times.end,
          shiftType: "work",
          machineId: addingTo.machineId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        window.location.reload();
      } else if (res.status === 409) {
        setAddError("Cette personne a déjà un créneau qui chevauche cet horaire ce jour-là.");
      } else {
        setAddError(data?.error || `Erreur serveur (${res.status}).`);
      }
    } catch (e: any) {
      setAddError(e?.message || "Échec de connexion au serveur.");
    } finally {
      setAddSaving(false);
    }
  }

  async function assignMachine(shiftId: string, machineId: string) {
    setAssigning(shiftId);
    try {
      await fetch(`/api/planning/creneaux/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: machineId || null }),
      });
      window.location.reload();
    } finally {
      setAssigning(null);
    }
  }

  const unassigned = shifts.filter((s) => !s.machine_id);
  const weekNotYetPlanned = shifts.length === 0;
  const scheduledKeys = new Set(allShifts.map((s: any) => `${s.profile_id}_${s.day_of_week}`));

  // Membres hors MERM (ex. responsable planification des patients) : pas
  // assignés à un poste/machine, affichés à part en bas plutôt que mélangés
  // aux MERM ou comptés dans les alertes d'effectif. Identifiés par leur
  // fonction ("Équipe") différente de "MERM".
  const merms = members.filter((m: any) => !m.job_title || m.job_title.trim().toUpperCase() === "MERM");
  const otherStaff = members.filter((m: any) => m.job_title && m.job_title.trim().toUpperCase() !== "MERM");

  const scannerMachine = machines.find((m) => m.name.toLowerCase() === "scanner");
  const xstrahlMachine = machines.find((m) => m.name.toLowerCase().includes("strahl"));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button className="btn-secondary print:hidden" onClick={() => goTo(-1)}>← Semaine précédente</button>
          <p className="font-semibold">{formatWeekLabel(startDate)}</p>
          <button className="btn-secondary print:hidden" onClick={() => goTo(1)}>Semaine suivante →</button>
        </div>
        <div className="flex gap-2 print:hidden flex-wrap items-center">
          {isAdmin && (
            <button className="btn-secondary text-xs" onClick={repairPostes} disabled={repairing}>
              {repairing ? "Réparation..." : "Réparer les postes (sept.-oct. 2026)"}
            </button>
          )}
          {isAdmin && (
            <button className="btn-secondary text-xs" onClick={construireDecembre} disabled={buildingDecembre}>
              {buildingDecembre ? "Application..." : "Appliquer le planning validé (1-21 déc.)"}
            </button>
          )}
          <Link href={`/planning/apercu?semaine=${startDate}`} className="btn-secondary">📄 Aperçu imprimable</Link>
          <button className="btn-secondary" onClick={() => window.print()}>Imprimer / PDF</button>
          <Link href="/planning" className="btn-secondary">Vue par MERM</Link>
        </div>
      </div>

      {(decembreError || decembreReport) && (
        <div className="card p-4 mb-4 border border-slate-200 bg-slate-50 text-sm">
          {decembreError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ {decembreError}</p>
          )}
          {decembreReport && (
            <div className="text-xs">
              <p className="text-slate-600">{decembreReport.postesAssignes} créneau(x) programmé(s), {decembreReport.semainesCreees} semaine(s) créée(s) — rechargement...</p>
              {decembreReport.introuvables.length > 0 && (
                <ul className="list-disc pl-4 text-amber-700 mt-1">
                  {decembreReport.introuvables.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {(repairError || repairReport) && (
        <div className="card p-4 mb-4 border border-slate-200 bg-slate-50 text-sm">
          {repairError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ {repairError}</p>
          )}
          {repairReport && (
            <div className="text-xs">
              {repairReport.avertissement && <p className="text-slate-500">{repairReport.avertissement}</p>}
              <p className="text-slate-600">{repairReport.postesAssignes} poste(s) réparé(s) sur {repairReport.semainesTraitees} semaine(s) — rechargement...</p>
              {repairReport.introuvables.length > 0 && (
                <ul className="list-disc pl-4 text-amber-700 mt-1">
                  {repairReport.introuvables.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {!week && <div className="card p-8 text-center text-slate-400">Aucun planning pour cette semaine.</div>}

      {week && weekNotYetPlanned && (
        <div className="card p-4 mb-4 border border-slate-200 bg-slate-50 text-sm text-slate-500">
          Cette semaine n'a pas encore de créneaux programmés — aucune alerte d'effectif ne s'affiche tant qu'elle reste vide.
        </div>
      )}

      {week && merms.length > 0 && (
        <div className="card p-4 mb-4 border border-slate-200">
          <h3 className="font-semibold mb-3">Sans créneau programmé</h3>
          <div className="grid grid-cols-5 gap-2">
            {DAY_LABELS.slice(0, 5).map((label, day) => {
              const notScheduled = merms.filter((m) => !scheduledKeys.has(`${m.id}_${day}`));
              return (
                <div key={day} className="border border-slate-100 rounded-lg p-2 min-h-[60px] bg-white">
                  <p className="text-xs font-medium text-slate-500 mb-1">{label} <span className="font-normal text-slate-400">{formatDayShort(addDaysToIso(startDate, day))}</span></p>
                  {notScheduled.length === 0 && <p className="text-xs text-slate-300">—</p>}
                  {notScheduled.map((m: any) => (
                    <p key={m.id} className="text-xs">{m.first_name} {m.last_name}</p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {week && unassigned.length > 0 && (
        <div className="card p-4 mb-4 border border-amber-200 bg-amber-50/40">
          <h3 className="font-semibold mb-3 text-amber-800">Sans poste assigné ({unassigned.length})</h3>
          <div className="grid grid-cols-5 gap-2">
            {DAY_LABELS.slice(0, 5).map((label, day) => {
              const dayShifts = unassigned.filter((s) => s.day_of_week === day);
              const holiday = holidayName(addDaysToIso(startDate, day));
              return (
                <div key={day} className="border border-amber-100 rounded-lg p-2 min-h-[60px] bg-white">
                  <p className="text-xs font-medium text-slate-500 mb-1">{label} <span className="font-normal text-slate-400">{formatDayShort(addDaysToIso(startDate, day))}</span></p>
                  {holiday && <p className="text-xs text-amber-700">🎌 {holiday}</p>}
                  {dayShifts.length === 0 && <p className="text-xs text-slate-300">—</p>}
                  {dayShifts.map((s: any) => (
                    <div key={s.id} className="mb-2">
                      <p className="text-xs">
                        {s.profiles?.first_name} {s.profiles?.last_name?.charAt(0)}.{" "}
                        <span className="text-slate-400">{shiftPeriodLabel(s.start_time)}</span>
                      </p>
                      {isAdmin && (
                        <MachineSelect
                          machines={machines}
                          value=""
                          onChange={(id) => assignMachine(s.id, id)}
                          placeholder="Assigner un poste..."
                          disabled={assigning === s.id}
                          className="mt-1 print:hidden"
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {week && (
        <div className="space-y-6">
          {machines.map((machine) => {
            const machineShifts = shifts.filter((s) => s.machine_id === machine.id);
            return (
              <div key={machine.id} className="card overflow-hidden">
                <div
                  className="flex items-center justify-center gap-2 px-4 py-3 border-b-2"
                  style={{ backgroundColor: `${machine.color_hex}26`, borderBottomColor: machine.color_hex }}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: machine.color_hex }} />
                  <h3 className="font-bold text-lg tracking-wide text-slate-800">{machine.name}</h3>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[480px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide">
                      <th className="px-4 py-2 font-medium w-28 text-slate-400">Jour</th>
                      <th className="px-4 py-2 font-semibold text-amber-700 bg-amber-50 border-l border-amber-100">☀️ Matin</th>
                      <th className="px-4 py-2 font-semibold text-indigo-700 bg-indigo-50 border-l border-indigo-100">🌙 Soir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_LABELS.slice(0, 5).map((label, day) => {
                      const dateIso = addDaysToIso(startDate, day);
                      const holiday = holidayName(dateIso);
                      const dayClosures = closures.filter((c) => c.machine_id === machine.id && c.date === dateIso);
                      const closedAllDay = dayClosures.some((c) => !c.start_time);
                      const dayShifts = machineShifts.filter((s) => s.day_of_week === day);
                      const rules = minStaffing.filter((r) => r.machine_id === machine.id && r.day_of_week === day);

                      const rowTint = closedAllDay ? "bg-slate-50" : holiday ? "bg-amber-50/50" : day % 2 === 1 ? "bg-slate-50/50" : "";

                      function periodCell(period: "matin" | "soir") {
                        const periodShifts = dayShifts.filter((s: any) =>
                          period === "matin" ? s.start_time < "13:00" : s.start_time >= "13:00"
                        );
                        const periodRules = rules.filter((r: any) => (period === "matin" ? r.start_time < "13:00" : r.start_time >= "13:00"));
                        const shortage =
                          closedAllDay || holiday || weekNotYetPlanned
                            ? []
                            : periodRules.filter((r: any) => {
                                const closedNow = dayClosures.some(
                                  (c) => c.start_time && overlaps(c.start_time, c.end_time, r.start_time, r.end_time)
                                );
                                if (closedNow) return false;
                                const covering = periodShifts.filter((s: any) => overlaps(s.start_time, s.end_time, r.start_time, r.end_time));
                                return covering.length < r.min_count;
                              });
                        const partialClosure = dayClosures.find(
                          (c) => c.start_time && overlaps(c.start_time, c.end_time, period === "matin" ? MORNING_SHIFT.start : EVENING_SHIFT.start, period === "matin" ? MORNING_SHIFT.end : EVENING_SHIFT.end)
                        );
                        const xstrahlWithoutScanner =
                          machine.id === xstrahlMachine?.id &&
                          periodShifts.some((s: any) => {
                            const scannerCovers = shifts.some(
                              (o) => o.machine_id === scannerMachine?.id && o.day_of_week === day && overlaps(s.start_time, s.end_time, o.start_time, o.end_time)
                            );
                            return !scannerCovers;
                          });
                        const isAddingHere = addingTo && addingTo.machineId === machine.id && addingTo.day === day && addingTo.period === period;

                        if (closedAllDay) return null; // fusionné sur toute la ligne, voir plus bas

                        const periodStyle =
                          period === "matin"
                            ? "border-l border-amber-100 bg-amber-50/30"
                            : "border-l border-indigo-100 bg-indigo-50/30";

                        return (
                          <td className={`px-4 py-2.5 align-top ${periodStyle}`}>
                            {holiday && <p className="text-xs text-amber-700">Fermé (jour férié)</p>}
                            {!holiday && partialClosure && (
                              <p className="text-xs text-slate-500">
                                Fermé {partialClosure.start_time.slice(0, 5)}-{partialClosure.end_time.slice(0, 5)}
                                {partialClosure.reason ? ` — ${partialClosure.reason}` : ""}
                              </p>
                            )}
                            {!holiday && periodShifts.length === 0 && <p className="text-sm text-slate-300">—</p>}
                            {!holiday && periodShifts.length > 0 && (
                              <ul className="space-y-0.5">
                                {periodShifts.map((s: any) => (
                                  <li key={s.id} className="text-sm text-slate-700">
                                    {s.profiles?.first_name} {s.profiles?.last_name}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {shortage.length > 0 && <p className="text-xs text-red-600 mt-1">Effectif manquant</p>}
                            {xstrahlWithoutScanner && (
                              <p className="text-xs text-amber-600 mt-1">X-STRAHL sans Scanner en parallèle</p>
                            )}
                            {isAdmin && !holiday && (
                              <div className="print:hidden mt-1.5">
                                {isAddingHere ? (
                                  <div className="space-y-1 border-t border-slate-100 pt-1.5">
                                    <select className="input text-xs py-1" value={addProfileId} onChange={(e) => setAddProfileId(e.target.value)} autoFocus>
                                      <option value="">Choisir un MERM...</option>
                                      {merms.map((m: any) => (
                                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                                      ))}
                                    </select>
                                    {addError && <p className="text-xs text-red-600">{addError}</p>}
                                    <div className="flex gap-1">
                                      <button className="btn-primary text-xs flex-1" disabled={!addProfileId || addSaving} onClick={addDirectShift}>
                                        {addSaving ? "..." : "Ajouter"}
                                      </button>
                                      <button className="btn-secondary text-xs" onClick={() => setAddingTo(null)}>Annuler</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button className="text-xs text-slate-400 hover:text-slate-700" onClick={() => openAdd(machine.id, day, period)}>
                                    + Ajouter
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      }

                      return (
                        <tr key={day} className={`border-t border-slate-100 ${rowTint}`}>
                          <td className="px-4 py-2.5 align-top">
                            <p className="font-medium text-slate-700">{label}</p>
                            <p className="text-xs text-slate-400">{formatDayShort(dateIso)}</p>
                          </td>
                          {closedAllDay ? (
                            <td colSpan={2} className="px-4 py-2.5 text-sm text-slate-500 border-l border-slate-100">
                              Fermé{dayClosures[0]?.reason ? ` — ${dayClosures[0].reason}` : ""}
                            </td>
                          ) : (
                            <>
                              {periodCell("matin")}
                              {periodCell("soir")}
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {week && otherStaff.length > 0 && (
        <div className="card p-4 mt-4">
          <h3 className="font-semibold mb-3">Équipe hors postes</h3>
          <div className="space-y-2">
            {otherStaff.map((m: any) => {
              const daysPresent = DAY_LABELS.slice(0, 5)
                .map((label, day) => (scheduledKeys.has(`${m.id}_${day}`) ? label : null))
                .filter(Boolean);
              return (
                <div key={m.id} className="flex items-center gap-2 text-sm border border-slate-100 rounded-lg p-2">
                  <span className="font-medium">{m.first_name} {m.last_name}</span>
                  <span className="text-slate-400">— {m.job_title}</span>
                  {daysPresent.length > 0 && (
                    <span className="text-slate-400 text-xs ml-auto">{daysPresent.join(", ")}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
