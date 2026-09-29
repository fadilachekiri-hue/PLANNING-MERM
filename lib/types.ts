export type Role = "owner" | "admin" | "member";
export type ProfileStatus = "pending" | "active" | "disabled";
export type ShiftPreference = "morning" | "evening" | "none";
export type CompetencyLevel = "none" | "training" | "autonomous";
export type ShiftType = "work" | "conge" | "rtt" | "repos" | "absence" | "tp" | "rr" | "fo";
export type WeekStatus = "draft" | "published";
export type LeaveType = "conge" | "rtt" | "absence" | "indisponibilite";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  identifiant: string;
  auth_email: string;
  contact_email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  role: Role;
  status: ProfileStatus;
  job_title: string | null;
  contracted_hours: number;
  usual_days: string | null;
  usual_hours: string | null;
  shift_preference: ShiftPreference;
  overtime_ok: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  name: string;
  color_hex: string;
  active: boolean;
  position: number;
  requires_machine_id: string | null;
}

export interface Shift {
  id: string;
  week_id: string;
  profile_id: string;
  day_of_week: number; // 0 = lundi
  start_time: string | null;
  end_time: string | null;
  shift_type: ShiftType;
  machine_id: string | null;
  pair_id: string | null;
  notes: string | null;
}

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  work: "Travail",
  conge: "Congé",
  rtt: "RTT",
  repos: "Repos",
  absence: "Absence",
  tp: "TP",
  rr: "RR",
  fo: "FO",
};

export const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export const MORNING_SHIFT = { start: "08:00", end: "15:36" };
export const EVENING_SHIFT = { start: "13:24", end: "21:00" };

/** "Matin" ou "Soir" à partir d'une heure de début, sans exposer l'horaire exact. */
export function shiftPeriodLabel(startTime: string | null | undefined): string {
  if (!startTime) return "";
  return startTime.slice(0, 5) < "12:00" ? "Matin" : "Soir";
}
