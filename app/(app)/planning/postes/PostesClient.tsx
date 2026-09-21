"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDaysToIso, formatWeekLabel } from "@/lib/week";
import { DAY_LABELS } from "@/lib/types";

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export default function PostesClient({ startDate, week, machines, shifts, minStaffing }: { startDate: string; week: any; machines: any[]; shifts: any[]; minStaffing: any[] }) {
  const router = useRouter();

  function goTo(offsetWeeks: number) {
    router.push(`/planning/postes?semaine=${addDaysToIso(startDate, offsetWeeks * 7)}`);
  }

  const scannerMachine = machines.find((m) => m.name.toLowerCase() === "scanner");
  const xstrahlMachine = machines.find((m) => m.name.toLowerCase().includes("strahl"));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={() => goTo(-1)}>← Semaine précédente</button>
          <p className="font-semibold">{formatWeekLabel(startDate)}</p>
          <button className="btn-secondary" onClick={() => goTo(1)}>Semaine suivante →</button>
        </div>
        <Link href="/planning" className="btn-secondary">Vue Personnel</Link>
      </div>

      {!week && <div className="card p-8 text-center text-slate-400">Aucun planning pour cette semaine.</div>}

      {week && (
        <div className="space-y-4">
          {machines.map((machine) => (
            <div key={machine.id} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: machine.color_hex }} />
                <h3 className="font-semibold">{machine.name}</h3>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {DAY_LABELS.map((label, day) => {
                  const dayShifts = shifts.filter((s) => s.machine_id === machine.id && s.day_of_week === day);
                  const rules = minStaffing.filter((r) => r.machine_id === machine.id && r.day_of_week === day);
                  const shortages = rules.filter((r) => {
                    const covering = dayShifts.filter((s) => overlaps(s.start_time, s.end_time, r.start_time, r.end_time));
                    return covering.length < r.min_count;
                  });

                  const xstrahlWithoutScanner =
                    machine.id === xstrahlMachine?.id &&
                    dayShifts.some((s) => {
                      const scannerCovers = shifts.some(
                        (o) => o.machine_id === scannerMachine?.id && o.day_of_week === day && overlaps(s.start_time, s.end_time, o.start_time, o.end_time)
                      );
                      return !scannerCovers;
                    });

                  return (
                    <div key={day} className="border border-slate-100 rounded-lg p-2 min-h-[90px]">
                      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                      {dayShifts.length === 0 && <p className="text-xs text-slate-300">—</p>}
                      {dayShifts.map((s: any) => (
                        <p key={s.id} className="text-xs mb-1">
                          {s.profiles?.first_name} {s.profiles?.last_name?.charAt(0)}. <span className="text-slate-400">{s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)}</span>
                        </p>
                      ))}
                      {shortages.length > 0 && (
                        <p className="text-xs text-red-600 mt-1">⚠ Effectif manquant ({shortages.length})</p>
                      )}
                      {xstrahlWithoutScanner && (
                        <p className="text-xs text-amber-600 mt-1">⚠ X-STRAHL sans Scanner en parallèle (règle à confirmer)</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
