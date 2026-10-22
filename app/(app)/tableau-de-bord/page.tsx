import Link from "next/link";
import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { mondayOf } from "@/lib/week";
import { DAY_LABELS, shiftPeriodLabel, SHIFT_TYPE_LABELS, LEAVE_TYPE_LABELS, LEAVE_TYPE_COLORS, type LeaveType, type ShiftType } from "@/lib/types";

const SHIFT_TYPE_COLORS: Record<string, string> = {
  conge: "bg-purple-50 text-purple-700 border-purple-200",
  rtt: "bg-indigo-50 text-indigo-700 border-indigo-200",
  repos: "bg-slate-100 text-slate-600 border-slate-200",
  absence: "bg-red-50 text-red-700 border-red-200",
  tp: "bg-amber-50 text-amber-700 border-amber-200",
  rr: "bg-cyan-50 text-cyan-700 border-cyan-200",
  fo: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
import { holidayName } from "@/lib/holidays";

function todayDowIndex(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function todayLabel(): string {
  const d = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const admin = isAdminOrOwner(profile);
  const supabase = createClient();
  const monday = mondayOf(new Date());
  const todayDow = todayDowIndex();

  const { data: week } = await supabase.from("weeks").select("*").eq("start_date", monday).maybeSingle();
  const todayHoliday = holidayName(new Date().toISOString().slice(0, 10));

  if (!admin) {
    let myShifts: any[] = [];
    if (week) {
      const { data } = await supabase.from("shifts").select("*, machines(name, color_hex)").eq("week_id", week.id).eq("profile_id", profile.id);
      myShifts = data || [];
    }
    const { data: pendingRequests } = await supabase.from("leave_requests").select("id").eq("profile_id", profile.id).eq("status", "pending");
    const { data: unread } = await supabase.from("notifications").select("id").eq("profile_id", profile.id).is("read_at", null);
    const todayShifts = myShifts.filter((s) => s.day_of_week === todayDow);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Bonjour {profile.first_name} 👋</h1>
          <p className="text-sm text-slate-400">{todayLabel()}</p>
        </div>
        {todayHoliday && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">🎌 {todayHoliday} — jour férié.</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Demandes en attente" value={pendingRequests?.length || 0} accent="amber" icon="📋" link="/demandes" />
          <StatCard label="Notifications non lues" value={unread?.length || 0} accent="blue" icon="🔔" link="/notifications" />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Aujourd'hui — {DAY_LABELS[todayDow]}</h2>
          {todayShifts.length === 0 && <p className="text-sm text-slate-400">Rien de prévu aujourd'hui.</p>}
          <div className="space-y-2">
            {todayShifts.map((s) => (
              <ShiftRow key={s.id} shift={s} />
            ))}
          </div>
          <Link href="/planning/postes" className="text-sm text-brand-600 hover:underline mt-3 inline-block">Voir tout le planning →</Link>
        </div>
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const [{ count: activeCount }, { data: pendingLeaves }, { data: openReplacements }, { data: minStaffing }, { data: todayClosures }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("leave_requests").select("id, profiles!leave_requests_profile_id_fkey(first_name, last_name), type, date_start, date_end").eq("status", "pending"),
    supabase.from("replacement_requests").select("id, day, start_time, end_time").eq("status", "open"),
    supabase.from("min_staffing").select("*, machines(name)"),
    supabase.from("machine_closures").select("*").eq("date", todayIso),
  ]);

  let todayPresent: any[] = [];
  let weekShifts: any[] = [];
  if (week) {
    const { data } = await supabase.from("shifts").select("*, profiles!shifts_profile_id_fkey(first_name, last_name), machines(name, color_hex)").eq("week_id", week.id);
    weekShifts = data || [];
    todayPresent = weekShifts.filter((s) => s.day_of_week === todayDow && s.shift_type === "work");
  }
  todayPresent.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  function overlaps(aS: string, aE: string, bS: string, bE: string) {
    return aS < bE && bS < aE;
  }
  const todayShortages = todayHoliday || weekShifts.length === 0
    ? []
    : (minStaffing || [])
    .filter((r) => r.day_of_week === todayDow)
    .filter((r) => {
      const closed = (todayClosures || []).some(
        (c) => c.machine_id === r.machine_id && (!c.start_time || overlaps(c.start_time, c.end_time, r.start_time, r.end_time))
      );
      if (closed) return false;
      const covering = todayPresent.filter((s) => s.machine_id === r.machine_id && overlaps(s.start_time, s.end_time, r.start_time, r.end_time));
      return covering.length < r.min_count;
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-slate-400">{todayLabel()}</p>
      </div>
      {todayHoliday && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          🎌 {todayHoliday} — jour férié, normalement fermé.
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Personnel actif" value={activeCount || 0} accent="slate" icon="👥" />
        <StatCard label="Présents aujourd'hui" value={todayPresent.length} accent="emerald" icon="✅" />
        <StatCard label="Demandes en attente" value={pendingLeaves?.length || 0} accent="amber" icon="📋" link="/demandes" />
        <StatCard label="Remplacements ouverts" value={openReplacements?.length || 0} accent="purple" icon="🔄" link="/remplacements" />
      </div>

      {todayShortages.length > 0 && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-700">⚠ Effectifs insuffisants aujourd'hui</p>
          <ul className="text-xs text-red-600 mt-1 list-disc pl-4">
            {todayShortages.map((s: any, i: number) => <li key={i}>{s.machines?.name || "Poste"} — créneau {shiftPeriodLabel(s.start_time)}</li>)}
          </ul>
          <Link href="/planning/postes" className="text-xs text-red-700 underline">Voir la vue par postes</Link>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Présents aujourd'hui — {DAY_LABELS[todayDow]}</h2>
        {todayPresent.length === 0 && <p className="text-sm text-slate-400">Aucun créneau de travail aujourd'hui.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {todayPresent.map((s: any) => {
            const isMatin = shiftPeriodLabel(s.start_time) === "Matin";
            return (
              <div
                key={s.id}
                className={`text-sm rounded-lg p-2.5 border ${isMatin ? "bg-amber-50/40 border-amber-100" : "bg-indigo-50/40 border-indigo-100"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.machines?.color_hex || "#94a3b8" }} />
                  <p className="font-medium">{s.profiles?.first_name} {s.profiles?.last_name}</p>
                </div>
                <p className={`text-xs mt-0.5 ${isMatin ? "text-amber-700" : "text-indigo-700"}`}>
                  {isMatin ? "☀️ Matin" : "🌙 Soir"} — {s.machines?.name || "Non affecté"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {pendingLeaves && pendingLeaves.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Demandes en attente</h2>
          <div className="space-y-2">
            {pendingLeaves.map((l: any) => {
              const type = l.type as LeaveType;
              return (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <span className={`badge border ${LEAVE_TYPE_COLORS[type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {LEAVE_TYPE_LABELS[type] || l.type}
                  </span>
                  <span>{l.profiles?.first_name} {l.profiles?.last_name}</span>
                  <span className="text-slate-400">— du {l.date_start} au {l.date_end}</span>
                </div>
              );
            })}
          </div>
          <Link href="/demandes" className="text-sm text-brand-600 hover:underline mt-3 inline-block">Traiter les demandes →</Link>
        </div>
      )}
    </div>
  );
}

const ACCENT: Record<string, { bg: string; text: string }> = {
  slate: { bg: "bg-slate-100", text: "text-slate-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
};

function StatCard({ label, value, accent, icon, link }: { label: string; value: number; accent: string; icon: string; link?: string }) {
  const a = ACCENT[accent] || ACCENT.slate;
  const content = (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${a.bg}`}>{icon}</div>
      <div>
        <p className={`text-2xl font-semibold leading-tight ${a.text}`}>{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
  return link ? <Link href={link}>{content}</Link> : content;
}

function ShiftRow({ shift }: { shift: any }) {
  if (shift.shift_type !== "work") {
    const type = shift.shift_type as ShiftType;
    return (
      <p className="text-sm">
        <span className={`badge border ${SHIFT_TYPE_COLORS[type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
          {SHIFT_TYPE_LABELS[type] || shift.shift_type}
        </span>
      </p>
    );
  }
  const isMatin = shiftPeriodLabel(shift.start_time) === "Matin";
  return (
    <div className={`text-sm rounded-lg p-2.5 border inline-flex items-center gap-2 ${isMatin ? "bg-amber-50/40 border-amber-100" : "bg-indigo-50/40 border-indigo-100"}`}>
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: shift.machines?.color_hex || "#94a3b8" }} />
      <span className={isMatin ? "text-amber-700" : "text-indigo-700"}>{isMatin ? "☀️ Matin" : "🌙 Soir"}</span>
      <span>— {shift.machines?.name || "Non affecté"}</span>
    </div>
  );
}
