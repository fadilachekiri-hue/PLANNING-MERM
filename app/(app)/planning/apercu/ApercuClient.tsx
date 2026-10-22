"use client";

import Link from "next/link";
import { addDaysToIso, formatDayShort } from "@/lib/week";
import { DAY_LABELS, SHIFT_TYPE_LABELS, type ShiftType } from "@/lib/types";
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

export default function ApercuClient({
  startDate,
  week,
  machines,
  workShifts,
  leaveShifts,
  closures,
}: {
  startDate: string;
  week: any;
  machines: any[];
  workShifts: any[];
  leaveShifts: any[];
  closures: any[];
}) {
  const days = [0, 1, 2, 3, 4].map((d) => ({
    day: d,
    label: DAY_LABELS[d],
    dateIso: addDaysToIso(startDate, d),
  }));

  const today = new Date();
  const generatedOn = today.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const periodLabel = `${formatDayShort(startDate)} – ${formatDayShort(addDaysToIso(startDate, 4))} ${new Date(startDate + "T00:00:00").getFullYear()}`;

  function goTo(offsetWeeks: number) {
    const next = addDaysToIso(startDate, offsetWeeks * 7);
    window.location.href = `/planning/apercu?semaine=${next}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={() => goTo(-1)}>← Semaine précédente</button>
          <button className="btn-secondary" onClick={() => goTo(1)}>Semaine suivante →</button>
        </div>
        <div className="flex gap-2">
          <Link href="/planning/postes" className="btn-secondary">← Retour à la vue par poste</Link>
          <button className="btn-primary" onClick={() => window.print()}>🖨️ Imprimer / PDF</button>
        </div>
      </div>

      {!week && (
        <div className="card p-8 text-center text-slate-400">Aucun planning créé pour cette semaine.</div>
      )}

      {week && (
        <div className="card overflow-hidden print:shadow-none print:border-0">
          {/* En-tête façon document */}
          <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between flex-wrap gap-1">
            <div>
              <h1 className="text-lg font-bold tracking-wide">PLANNING MERM — RADIOTHÉRAPIE</h1>
              <p className="text-sm text-indigo-100">Semaine du {periodLabel}</p>
            </div>
            <p className="text-xs text-indigo-100">Généré le {generatedOn}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[760px]">
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
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: machine.color_hex }} />
                              {machine.name}
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
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-slate-800 truncate">
                                          {s.profiles?.first_name} {s.profiles?.last_name}
                                        </p>
                                        {s.profiles?.phone && <p className="text-[10px] text-slate-400 truncate">{s.profiles.phone}</p>}
                                      </div>
                                    </div>
                                  ))}
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
                          <div className="space-y-0.5">
                            {dayLeaves.map((s: any) => (
                              <p key={s.id} className="text-xs text-red-700">
                                {s.profiles?.first_name} {s.profiles?.last_name}
                                <span className="text-red-400"> — {SHIFT_TYPE_LABELS[s.shift_type as ShiftType] || s.shift_type}</span>
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
