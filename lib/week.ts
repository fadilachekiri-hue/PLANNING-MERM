/** Renvoie la date du lundi (YYYY-MM-DD) de la semaine contenant `date`. */
export function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function addDaysToIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatWeekLabel(startIso: string): string {
  const start = new Date(startIso + "T00:00:00");
  const end = new Date(addDaysToIso(startIso, 6) + "T00:00:00");
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return `Semaine du ${fmt(start)} au ${fmt(end)}`;
}
