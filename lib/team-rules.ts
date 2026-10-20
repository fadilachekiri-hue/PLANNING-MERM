// Règles métier transmises par la cadre (organisation des plannings et des
// binômes). Centralisées ici pour être appliquées automatiquement par
// /api/binomes/proposer et par l'éditeur de créneau. Les noms sont comparés
// sur le nom de famille (profiles.last_name), en minuscules, sans accent.

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Personnes à ne pas prendre en compte pour le moment dans les plannings. */
export const EXCLUDED_FROM_PLANNING = ["teixeira"].map(norm);

export function isExcludedFromPlanning(lastName: string): boolean {
  return EXCLUDED_FROM_PLANNING.includes(norm(lastName));
}

/** Référent·e·s par poste (repère technique, à privilégier comme encadrant). */
export const REFERENTS: Record<string, string[]> = {
  unity: ["carementrant"],
  scanner: ["el zayat", "charbonnel", "hicquel"],
};

/** Nouveaux arrivants / en cours de formation : à associer à une personne calme et expérimentée. */
export const NEEDS_EXPERIENCED_PARTNER = ["coulibaly", "gautier"].map(norm); // Fanta Coulibaly, Gautier

/** Personnes calmes et expérimentées, adaptées en binôme avec un nouvel arrivant. */
export const CALM_EXPERIENCED = ["rahmani"].map(norm); // Chanez Rahmani, sur le Clinac notamment

/** À éviter en binôme avec un nouvel arrivant (a elle-même besoin de cadre). */
export const AVOID_PAIRING_WITH_NEW = ["ledieu"].map(norm);

/** Postes à éviter (sans être une interdiction absolue) pour certaines personnes. */
export const MACHINE_AVOID: Record<string, string[]> = {
  unity: ["ledieu", "genet", "dumont"].map(norm),
};

/** Pas encore assez formé·e·s pour être seul·e·s ou régulièrement sur ce poste. */
export const MACHINE_LIMITED_TRAINING: Record<string, string[]> = {
  unity: ["coulibaly", "rahmani"].map(norm), // Fanta Coulibaly, Chanez Rahmani
};

/** En formation sur ce poste : à positionner ponctuellement pour progresser. */
export const MACHINE_IN_TRAINING: Record<string, string[]> = {
  scanner: ["chauliac"].map(norm),
};

/** Postes du soir tard sur Versa HD : personnes disponibles / qui préfèrent ce créneau. */
export const VERSA_LATE_EVENING_OK = ["charbonnel", "renou"].map(norm);
export const PREFERS_LATE_EVENING = ["renou"].map(norm);

/** Ne pas positionner la même personne sur ces deux postes au cours de la même semaine. */
export const AVOID_SAME_WEEK_MACHINE_PAIRS: [string, string][] = [["versa hd", "clinac"]];

/** Fonteneau : à positionner au GQ tous les mercredis si possible (0 = lundi). */
export const WEDNESDAY_GQ_LASTNAME = norm("Fonteneau");
export const WEDNESDAY_DAY_INDEX = 2;

/** Indisponibilités fixes (jour + créneau) à exclure d'office des propositions. */
export const HARD_DAY_UNAVAILABLE: Array<{ lastName: string; dayOfWeek: number; period: "matin" | "soir" }> = [
  { lastName: norm("Hicquel"), dayOfWeek: 2, period: "soir" }, // mercredi soir : Maxime Hicquel
  { lastName: norm("Rahmani"), dayOfWeek: 1, period: "soir" }, // mardi soir : Chanez
];

export function machineKey(machineName: string): string {
  return norm(machineName);
}

export function isReferent(machineName: string, lastName: string): boolean {
  return (REFERENTS[machineKey(machineName)] || []).includes(norm(lastName));
}

export function isMachineAvoid(machineName: string, lastName: string): boolean {
  return (MACHINE_AVOID[machineKey(machineName)] || []).includes(norm(lastName));
}

export function isLimitedTraining(machineName: string, lastName: string): boolean {
  return (MACHINE_LIMITED_TRAINING[machineKey(machineName)] || []).includes(norm(lastName));
}

export function isInTraining(machineName: string, lastName: string): boolean {
  return (MACHINE_IN_TRAINING[machineKey(machineName)] || []).includes(norm(lastName));
}

export function needsExperiencedPartner(lastName: string): boolean {
  return NEEDS_EXPERIENCED_PARTNER.includes(norm(lastName));
}

export function isCalmExperienced(lastName: string): boolean {
  return CALM_EXPERIENCED.includes(norm(lastName));
}

export function avoidPairingWithNew(lastName: string): boolean {
  return AVOID_PAIRING_WITH_NEW.includes(norm(lastName));
}

export function isHardUnavailable(lastName: string, dayOfWeek: number, period: "matin" | "soir"): boolean {
  return HARD_DAY_UNAVAILABLE.some((r) => r.lastName === norm(lastName) && r.dayOfWeek === dayOfWeek && r.period === period);
}

export function conflictingWeekMachine(machineName: string): string | null {
  const key = machineKey(machineName);
  for (const [a, b] of AVOID_SAME_WEEK_MACHINE_PAIRS) {
    if (key === norm(a)) return b;
    if (key === norm(b)) return a;
  }
  return null;
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("_");
}
