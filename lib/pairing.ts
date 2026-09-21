import "server-only";

export type Candidate = {
  id: string;
  name: string;
  level: "training" | "autonomous";
  shiftPreference: "morning" | "evening" | "none";
  overtimeOk: boolean;
  contractedHours: number;
  alreadyWorkedHours: number;
};

export type Combo = {
  profileIds: string[];
  names: string[];
  issues: string[]; // contraintes non satisfaites, à afficher
  score: number; // plus petit = meilleur
};

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

export function proposePairs(params: {
  candidates: Candidate[];
  teamSize: number;
  minAutonomous: number;
  allowTrainingWithSupervisor: boolean;
  slotHours: number;
  slotIsMorning: boolean;
}): { combos: Combo[]; diagnostic: string | null } {
  const { candidates, teamSize, minAutonomous, allowTrainingWithSupervisor, slotHours, slotIsMorning } = params;

  const autonomous = candidates.filter((c) => c.level === "autonomous");
  const training = candidates.filter((c) => c.level === "training");

  if (autonomous.length < minAutonomous) {
    return {
      combos: [],
      diagnostic: `Seulement ${autonomous.length} personne(s) autonome(s) disponible(s), alors que la règle exige au moins ${minAutonomous}.`,
    };
  }

  const pool = allowTrainingWithSupervisor ? candidates : autonomous;
  if (pool.length < teamSize) {
    return { combos: [], diagnostic: `Pas assez de personnes formées disponibles pour composer un binôme de ${teamSize} personne(s).` };
  }

  // Limite raisonnable pour éviter une explosion combinatoire.
  const limitedPool = pool.slice(0, 20);
  const raw = combinations(limitedPool, teamSize);

  const combos: Combo[] = [];
  for (const combo of raw) {
    const nbAutonomous = combo.filter((c) => c.level === "autonomous").length;
    if (nbAutonomous < minAutonomous) continue;
    const nbTraining = combo.length - nbAutonomous;
    if (nbTraining > 0 && !allowTrainingWithSupervisor) continue;
    if (nbTraining > 0 && nbAutonomous === 0) continue; // une personne en formation doit être encadrée

    const issues: string[] = [];
    let score = 0;

    for (const c of combo) {
      const projected = c.alreadyWorkedHours + slotHours;
      if (projected > c.contractedHours && !c.overtimeOk) {
        issues.push(`${c.name} dépasserait ses heures contractuelles (${projected}h / ${c.contractedHours}h) et n'est pas volontaire aux heures supplémentaires.`);
        score += 3;
      } else if (projected > c.contractedHours) {
        issues.push(`${c.name} dépasserait ses heures contractuelles (${projected}h / ${c.contractedHours}h) — heures supplémentaires acceptées.`);
        score += 1;
      }
      const prefersMorning = c.shiftPreference === "morning";
      const prefersEvening = c.shiftPreference === "evening";
      if ((slotIsMorning && prefersEvening) || (!slotIsMorning && prefersMorning)) {
        issues.push(`${c.name} préfère habituellement l'autre créneau (${prefersMorning ? "matin" : "soir"}).`);
        score += 1;
      }
    }

    combos.push({ profileIds: combo.map((c) => c.id), names: combo.map((c) => c.name), issues, score });
  }

  combos.sort((a, b) => a.score - b.score);
  if (combos.length === 0) {
    return { combos: [], diagnostic: "Aucune combinaison ne respecte les règles de compétences définies pour ce poste." };
  }
  return { combos: combos.slice(0, 5), diagnostic: null };
}
