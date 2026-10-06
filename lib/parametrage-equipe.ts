// Paramétrage transmis par la cadre : horaires/effectifs par poste et
// habilitations/contraintes par manipulateur. Sert uniquement à
// /api/setup/parametrer-equipe (à usage unique, rejouable sans risque).

export const MACHINE_CONFIG: Record<
  string,
  { teamSize: number; minAutonomous: number; notes: string; minStaffing: { start: string; end: string; count: number } }
> = {
  Clinac: {
    teamSize: 2,
    minAutonomous: 1,
    notes: "2 manipulations : 8h00-15h00 (vacation 7h30). 4 manipulations : 8h00-18h00 (2 le matin + 2 le soir, vacations 7h30 chevauchantes).",
    minStaffing: { start: "08:00", end: "15:00", count: 2 },
  },
  Unity: {
    teamSize: 2,
    minAutonomous: 1,
    notes: "Fonctionnement identique au Clinac. 2 manipulations : 8h00-15h00. 4 manipulations : 8h00-18h00.",
    minStaffing: { start: "08:00", end: "15:00", count: 2 },
  },
  "Versa HD": {
    teamSize: 2,
    minAutonomous: 1,
    notes: "Maximum 4 personnes. Organisation privilégiée : 2 le matin + 2 le soir (8h00-20h00, vacations 7h30).",
    minStaffing: { start: "08:00", end: "20:00", count: 2 },
  },
  Scanner: {
    teamSize: 2,
    minAutonomous: 1,
    notes: "Utilisation ponctuelle, généralement 1 à 2 personnes selon les besoins. Horaires similaires au Clinac.",
    minStaffing: { start: "08:00", end: "15:00", count: 1 },
  },
  "X-STRAHL": {
    teamSize: 2,
    minAutonomous: 1,
    notes: "Fonctionnement similaire au Clinac. 2 manipulations : 8h00-15h00. 4 manipulations : 8h00-18h00.",
    minStaffing: { start: "08:00", end: "15:00", count: 2 },
  },
};

export type PersonConfig = {
  importKey: string; // nom d'origine du fichier Excel (clé stable)
  lastName: string; // nom de famille actuel attendu (après correction éventuelle)
  machines: string[]; // postes autorisés (noms exacts de MACHINE_CONFIG / table machines)
  notes: string;
};

export const PERSON_CONFIG: PersonConfig[] = [
  {
    importKey: "CAREMENTRANT",
    lastName: "Carementrant",
    machines: ["Clinac", "Unity", "Scanner", "Versa HD", "X-STRAHL"],
    notes:
      "Peut travailler sur toutes les machines. Mardi matin : Unity obligatoirement. Jeudi matin : Versa HD obligatoirement. Vendredi soir : Versa HD obligatoirement. Pendant les vacances scolaires : ne travaille pas le soir.",
  },
  {
    importKey: "CHARBONNEL",
    lastName: "Charbonnel",
    machines: ["Clinac", "Unity", "Scanner", "Versa HD", "X-STRAHL"],
    notes: "Peut travailler sur toutes les machines.",
  },
  {
    importKey: "CHAULIAC",
    lastName: "Chauliac",
    machines: ["Unity", "Versa HD", "Clinac"],
    notes: "Peut travailler uniquement sur : Unity, Versa HD, Clinac.",
  },
  {
    importKey: "DUMONT",
    lastName: "Dumont",
    machines: ["Unity", "Clinac"],
    notes: "Peut travailler uniquement sur : Unity, Clinac.",
  },
  {
    importKey: "GAUTIER",
    lastName: "Gautier",
    machines: ["Unity", "Clinac"],
    notes: "Peut travailler uniquement sur : Unity, Clinac.",
  },
  {
    importKey: "EL ZAYAT",
    lastName: "El Zayat",
    machines: ["Clinac", "Unity", "Scanner", "Versa HD", "X-STRAHL"],
    notes: "Peut travailler sur toutes les machines. Mercredi : TP. Pendant les vacances scolaires : ne travaille pas le soir.",
  },
  {
    importKey: "FONTENEAU",
    lastName: "Fonteneau",
    machines: ["Unity", "Versa HD", "Clinac"],
    notes: "Peut travailler sur : Unity, Versa HD, Clinac.",
  },
  {
    importKey: "GENET",
    lastName: "Genet",
    machines: ["Unity", "Versa HD"],
    notes: "Peut travailler uniquement sur : Unity, Versa HD.",
  },
  {
    importKey: "HICQUEL",
    lastName: "Hicquel",
    machines: ["Clinac", "Unity", "Scanner", "Versa HD", "X-STRAHL"],
    notes: "Peut travailler sur toutes les machines, mais uniquement le lundi, mardi et jeudi matin OU le petit soir (jusqu'à 18h max).",
  },
  {
    importKey: "LEDIEU",
    lastName: "Ledieu",
    machines: ["Unity", "Clinac", "Scanner"],
    notes: "Peut travailler sur : Unity, Clinac, Scanner. Scanner : uniquement le lundi et le mercredi matin.",
  },
  {
    importKey: "RENOU",
    lastName: "Renou",
    machines: ["Clinac", "Unity", "Scanner", "Versa HD", "X-STRAHL"],
    notes: "Peut travailler sur toutes les machines.",
  },
  {
    importKey: "VINCENOT",
    lastName: "Vincenot",
    machines: ["Clinac", "Unity", "Scanner", "Versa HD", "X-STRAHL"],
    notes: "Peut travailler sur toutes les machines.",
  },
  {
    importKey: "CHANEZ R",
    lastName: "Rahmani",
    machines: ["Clinac", "Scanner", "Versa HD", "X-STRAHL"],
    notes: "Peut travailler sur toutes les machines sauf l'Unity.",
  },
  {
    importKey: "FANTA C",
    lastName: "Coulibaly",
    machines: ["Clinac", "Scanner", "Versa HD", "X-STRAHL"],
    notes: "Peut travailler sur toutes les machines sauf l'Unity.",
  },
  {
    importKey: "JALALL B",
    lastName: "Jallal",
    machines: ["Versa HD"],
    notes: "Peut travailler uniquement sur le Versa HD, uniquement le matin.",
  },
];
