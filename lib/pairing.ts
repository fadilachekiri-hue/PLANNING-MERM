import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToIso } from "@/lib/week";
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
  /**
   * Continuité des binômes sur ce poste : clé = pairKey(idA, idB), valeur =
   * nombre de semaines consécutives (en remontant depuis la semaine qui
   * précède immédiatement celle-ci) où ce binôme exact a été formé sur ce
   * poste. La cadre souhaite reconduire les mêmes binômes le plus souvent
   * possible (au moins 2 semaines d'affilée) tant que les disponibilités
   * (congés) le permettent — voir computePairContinuity.
   */
  pairContinuity?: Record<string, number>;
  /**
   * Personnes déjà confirmées sur ce créneau (ex. le reste d'un binôme dont
   * un membre est absent) : à garder dans chaque combinaison proposée, sans
   * les reproposer comme candidates. `candidates` ne doit alors contenir que
   * les remplaçant·e·s possibles, et `openSeats` le nombre de places à
   * pourvoir (par défaut teamSize - mustInclude.length).
   */
  mustInclude?: Candidate[];
  openSeats?: number;
}): { combos: Combo[]; diagnostic: string | null } {
  const { candidates, teamSize, minAutonomous, allowTrainingWithSupervisor, slotHours, slotIsMorning, machineName, pairContinuity } = params;
  const mustInclude = params.mustInclude || [];
  const openSeats = params.openSeats ?? Math.max(teamSize - mustInclude.length, 0);

  if (openSeats === 0) {
    return { combos: [], diagnostic: "Aucune place à pourvoir : l'équipe déjà en place suffit pour ce créneau." };
  }

  const mustAutonomous = mustInclude.filter((c) => c.level === "autonomous").length;
  const autonomous = candidates.filter((c) => c.level === "autonomous");

  if (mustAutonomous + autonomous.length < minAutonomous) {
    return {
      combos: [],
      diagnostic: `Seulement ${mustAutonomous + autonomous.length} personne(s) autonome(s) disponible(s) au total, alors que la règle exige au moins ${minAutonomous}.`,
    };
  }

  const pool = allowTrainingWithSupervisor ? candidates : autonomous;
  if (pool.length < openSeats) {
    return { combos: [], diagnostic: `Pas assez de personnes formées et disponibles pour pourvoir ${openSeats} place(s) sur ce créneau.` };
  }

  // Limite raisonnable pour éviter une explosion combinatoire.
  const limitedPool = pool.slice(0, 20);
  const raw = combinations(limitedPool, openSeats);

  const combos: Combo[] = [];
  for (const picked of raw) {
    const combo = [...mustInclude, ...picked];
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

        // Continuité : reconduire un binôme déjà formé la/les semaine(s)
        // précédente(s) sur ce poste, plutôt que de le dissoudre (consigne de
        // la cadre). Plus le binôme a duré longtemps, plus le bonus est fort.
        const streak = pairContinuity?.[pairKey(a.id, b.id)] || 0;
        if (streak > 0) {
          score -= Math.min(2 + (streak - 1), 5);
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

/**
 * Pour un poste donné, calcule depuis combien de semaines consécutives
 * (en remontant depuis la semaine qui précède immédiatement `monday`)
 * chaque binôme exact a été reconduit sur ce poste. Utilisé pour favoriser
 * la continuité des binômes (consigne de la cadre), plutôt que la rotation.
 */
export async function computePairContinuity(
  admin: SupabaseClient,
  machineId: string,
  monday: string,
  lookbackWeeks = 6
): Promise<Record<string, number>> {
  const sinceIso = addDaysToIso(monday, -7 * lookbackWeeks);
  const { data: recentWeeks } = await admin
    .from("weeks")
    .select("id, start_date")
    .lt("start_date", monday)
    .gte("start_date", sinceIso)
    .order("start_date", { ascending: false });
  const weeks = recentWeeks || [];
  if (weeks.length === 0) return {};

  const weekIds = weeks.map((w: any) => w.id);
  const { data: recentShifts } = await admin
    .from("shifts")
    .select("profile_id, pair_id, week_id")
    .eq("machine_id", machineId)
    .in("week_id", weekIds)
    .not("pair_id", "is", null);

  const profilesByWeekPair = new Map<string, Map<string, string[]>>();
  for (const w of weeks) profilesByWeekPair.set(w.id, new Map());
  for (const s of recentShifts || []) {
    const perWeek = profilesByWeekPair.get(s.week_id as string);
    if (!perWeek) continue;
    const arr = perWeek.get(s.pair_id as string) || [];
    arr.push(s.profile_id as string);
    perWeek.set(s.pair_id as string, arr);
  }

  const pairKeysByWeek = new Map<string, Set<string>>();
  for (const w of weeks) {
    const keys = new Set<string>();
    for (const profileIds of profilesByWeekPair.get(w.id)!.values()) {
      for (let i = 0; i < profileIds.length; i++) {
        for (let j = i + 1; j < profileIds.length; j++) {
          keys.add(pairKey(profileIds[i], profileIds[j]));
        }
      }
    }
    pairKeysByWeek.set(w.id, keys);
  }

  // weeks est déjà trié du plus récent au plus ancien.
  const orderedWeekIds = weeks.map((w: any) => w.id);
  const streakByPair: Record<string, number> = {};
  const lastWeekKeys = pairKeysByWeek.get(orderedWeekIds[0]) || new Set<string>();
  for (const key of lastWeekKeys) {
    let streak = 1;
    for (let i = 1; i < orderedWeekIds.length; i++) {
      const keys = pairKeysByWeek.get(orderedWeekIds[i]);
      if (keys && keys.has(key)) streak++;
      else break;
    }
    streakByPair[key] = streak;
  }
  return streakByPair;
}
