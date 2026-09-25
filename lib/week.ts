// Toutes ces fonctions manipulent des dates calendaires (YYYY-MM-DD) sans
// heure — les calculs se font entièrement en UTC pour ne jamais dépendre du
// fuseau horaire du navigateur ou du serveur. Mélanger heure locale (pour
// les calculs) et UTC (pour le formatage, via toISOString) faisait dériver
// la date d'un jour dans les fuseaux en avance sur UTC (ex. Europe/Paris),
// ce qui pouvait faire retomber "semaine suivante" sur la semaine de départ.

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Renvoie la date du lundi (YYYY-MM-DD) de la semaine contenant `date`. */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDaysToIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatWeekLabel(startIso: string): string {
  const start = parseIso(startIso);
  const end = parseIso(addDaysToIso(startIso, 6));
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
  return `Semaine du ${fmt(start)} au ${fmt(end)}`;
}
