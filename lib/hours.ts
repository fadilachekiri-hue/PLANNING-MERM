import type { Shift } from "@/lib/types";

function toMinutes(t: string | null): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Heures travaillées (shift_type = 'work') pour un ensemble de créneaux. */
export function computeWorkedHours(shifts: Shift[]): number {
  const minutes = shifts
    .filter((s) => s.shift_type === "work" && s.start_time && s.end_time)
    .reduce((total, s) => total + Math.max(0, toMinutes(s.end_time) - toMinutes(s.start_time)), 0);
  return Math.round((minutes / 60) * 100) / 100;
}

export function computeHoursByType(shifts: Shift[]) {
  const byType: Record<string, number> = { work: 0, conge: 0, rtt: 0, repos: 0, absence: 0, tp: 0, rr: 0, fo: 0 };
  for (const s of shifts) {
    if (s.start_time && s.end_time) {
      const h = Math.max(0, toMinutes(s.end_time) - toMinutes(s.start_time)) / 60;
      byType[s.shift_type] = (byType[s.shift_type] || 0) + h;
    }
  }
  for (const key of Object.keys(byType)) {
    byType[key] = Math.round(byType[key] * 100) / 100;
  }
  return byType;
}

export function detectOverlaps(shifts: Shift[]): Array<[Shift, Shift]> {
  const overlaps: Array<[Shift, Shift]> = [];
  const byDay = new Map<number, Shift[]>();
  for (const s of shifts) {
    if (!s.start_time || !s.end_time) continue;
    const list = byDay.get(s.day_of_week) || [];
    list.push(s);
    byDay.set(s.day_of_week, list);
  }
  for (const list of byDay.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const aStart = toMinutes(a.start_time);
        const aEnd = toMinutes(a.end_time);
        const bStart = toMinutes(b.start_time);
        const bEnd = toMinutes(b.end_time);
        if (aStart < bEnd && bStart < aEnd) overlaps.push([a, b]);
      }
    }
  }
  return overlaps;
}
