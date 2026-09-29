import "server-only";
import {
  isMachineAvoid,
  isLimitedTraining,
  isInTraining,
  needsExperiencedPartner,
  isCalmExperienced,
  avoidPairingWithNew,
  pairKey,
} from "@/lib/team-rules";

export type Candidate = {
  id: string;
  name: string;
  lastName: string;
  level: "training" | "autonomous";
  shiftPreference: "morning" | "evening" | "none";
  overtimeOk: boolean;
  contractedHours: number;
  alreadyWorkedHours: number;
  /** Déjà positionné·e cette semaine sur l'autre poste d'une paire à éviter (ex. Versa HD / Clinac). */
  conflictingMachineThisWeek?: boolean;
  /** N'a pas encore travaillé l'Unity cette semaine (objectif : au moins une fois par semaine). */
  unityNotDoneThisWeek?: boolean;
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
  machineName: string;
  /** Fréquence des binômes déjà formés récemment sur ce poste (clé = pairKey(idA, idB)). */
  recentPairFrequency?: Record<string, number>;
}): { combos: Combo[]; diagnostic: string | null } {
  const { candidates, teamSize, minAutonomous, allowTrainingWithSupervisor, slotHours, slotIsMorning, machineName, recentPairFrequency } = params;

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

      // Consignes de la cadre par poste.
      if (isMachineAvoid(machineName, c.lastName)) {
        issues.push(`${c.name} : à éviter habituellement sur ce poste (consigne).`);
        score += 2;
      }
      if (isLimitedTraining(machineName, c.lastName)) {
        issues.push(`${c.name} n'est pas encore suffisamment formé·e sur ce poste — à éviter seul·e ou régulièrement.`);
        score += 2;
      }
      if (isInTraining(machineName, c.lastName)) {
        score -= 1; // à positionner ponctuellement pour progresser
      }
      if (c.conflictingMachineThisWeek) {
        issues.push(`${c.name} a déjà été positionné·e cette semaine sur l'autre poste (Versa HD / Clinac) — à éviter dans la mesure du possible.`);
        score += 1;
      }
      if (machineKeyIsUnity(machineName) && c.unityNotDoneThisWeek) {
        score -= 1; // objectif : chacun passe au moins une fois par semaine sur l'Unity
      }
    }

    // Encadrement des nouveaux arrivants / personnes en formation.
    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        const a = combo[i];
        const b = combo[j];
        const aNew = needsExperiencedPartner(a.lastName);
        const bNew = needsExperiencedPartner(b.lastName);
        const aAvoid = avoidPairingWithNew(a.lastName);
        const bAvoid = avoidPairingWithNew(b.lastName);
        const aCalm = isCalmExperienced(a.lastName);
        const bCalm = isCalmExperienced(b.lastName);

        if (aNew && bNew) {
          issues.push(`${a.name} et ${b.name} sont tous les deux nouveaux/en formation — à éviter en binôme.`);
          score += 2;
        }
        if ((aNew && bAvoid) || (bNew && aAvoid)) {
          const newName = aNew ? a.name : b.name;
          const avoidName = aAvoid ? a.name : b.name;
          issues.push(`${avoidName} est à éviter en binôme avec ${newName}, qui est nouveau/en formation.`);
          score += 2;
        }
        if ((aNew && bCalm) || (bNew && aCalm)) {
          score -= 1; // binôme adapté : calme et expérimenté·e avec un nouvel arrivant
        }

        // Rotation : pénaliser les binômes déjà formés récemment sur ce poste.
        const freq = recentPairFrequency?.[pairKey(a.id, b.id)] || 0;
        if (freq > 0) {
          if (freq >= 2) issues.push(`${a.name} + ${b.name} ont déjà été binôme sur ce poste ${freq} fois récemment — favoriser une autre association si possible.`);
          score += freq;
        }
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

function machineKeyIsUnity(machineName: string): boolean {
  return machineName.trim().toLowerCase() === "unity";
}
