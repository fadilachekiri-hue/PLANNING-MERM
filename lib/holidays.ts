import { addDaysToIso } from "@/lib/week";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Lundi de Pâques (date pivot pour les fêtes mobiles), calcul Meeus/Jones/Butcher. */
function easterMondayIso(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easterSundayIso = `${year}-${pad(month)}-${pad(day)}`;
  return addDaysToIso(easterSundayIso, 1);
}

/** Les 11 jours fériés légaux français pour une année donnée. */
export function frenchHolidays(year: number): { date: string; name: string }[] {
  const easterMonday = easterMondayIso(year);
  return [
    { date: `${year}-01-01`, name: "Jour de l'an" },
    { date: easterMonday, name: "Lundi de Pâques" },
    { date: `${year}-05-01`, name: "Fête du Travail" },
    { date: `${year}-05-08`, name: "Victoire 1945" },
    { date: addDaysToIso(easterMonday, 38), name: "Ascension" },
    { date: addDaysToIso(easterMonday, 49), name: "Lundi de Pentecôte" },
    { date: `${year}-07-14`, name: "Fête nationale" },
    { date: `${year}-08-15`, name: "Assomption" },
    { date: `${year}-11-01`, name: "Toussaint" },
    { date: `${year}-11-11`, name: "Armistice" },
    { date: `${year}-12-25`, name: "Noël" },
  ];
}

/** Nom du jour férié à cette date (YYYY-MM-DD), ou null si ce n'en est pas un. */
export function holidayName(iso: string): string | null {
  const year = Number(iso.slice(0, 4));
  const found = frenchHolidays(year).find((h) => h.date === iso);
  return found ? found.name : null;
}

export function isHoliday(iso: string): boolean {
  return holidayName(iso) !== null;
}
