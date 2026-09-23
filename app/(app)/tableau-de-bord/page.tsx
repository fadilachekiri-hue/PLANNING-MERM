import Link from "next/link";
import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { mondayOf } from "@/lib/week";
import { computeWorkedHours } from "@/lib/hours";
import { DAY_LABELS } from "@/lib/types";

function todayDowIndex(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const admin = isAdminOrOwner(profile);
  const supabase = createClient();
  const monday = mondayOf(new Date());
  const todayDow = todayDowIndex();

  const { data: week } = await supabase.from("weeks").select("*").eq("start_date", monday).maybeSingle();

  if (!admin) {
    let myShifts: any[] = [];
    if (week) {
      const { data } = await supabase.from("shifts").select("*, machines(name, color_hex)").eq("week_id", week.id).eq("profile_id", profile.id);
      myShifts = data || [];
    }
    const { data: pendingRequests } = await supabase.from("leave_requests").select("id").eq("profile_id", profile.id).eq("status", "pending");
    const { data: unread } = await supabase.from("notifications").select("id").eq("profile_id", profile.id).is("read_at", null);
    const worked = computeWorkedHours(myShifts);

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Bonjour {profile.first_name} 👋</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Heures planifiées cette semaine" value={`${worked}h / ${profile.contracted_hours}h`} />
          <Stat label="Demandes en attente" value={String(pendingRequests?.length || 0)} />
          <Stat label="Notifications non lues" value={String(unread?.length || 0)} />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-3">Aujourd'hui — {DAY_LABELS[todayDow]}</h2>
          {myShifts.filter((s) => s.day_of_week === todayDow).length === 0 && <p className="text-sm text-slate-400">Rien de prévu aujourd'hui.</p>}
          {myShifts.filter((s) => s.day_of_week === todayDow).map((s) => (
            <p key={s.id} className="text-sm">
              {s.shift_type === "work" ? `${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)} — ${s.machines?.name || "Non affecté"}` : s.shift_type}
            </p>
          ))}
          <Link href="/planning" className="text-sm text-brand-600 hover:underline mt-3 inline-block">Voir tout le planning →</Link>
        </div>
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const [{ count: activeCount }, { data: pendingLeaves }, { data: openReplacements }, { data: minStaffing }, { data: todayClosures }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("leave_requests").select("id, profiles(first_name, last_name), type, date_start, date_end").eq("status", "pending"),
    supabase.from("replacement_requests").select("id, day, start_time, end_time").eq("status", "open"),
    supabase.from("min_staffing").select("*, machines(name)"),
    supabase.from("machine_closures").select("*").eq("date", todayIso),
  ]);

  let todayPresent: any[] = [];
  let weekShifts: any[] = [];
  if (week) {
    const { data } = await supabase.from("shifts").select("*, profiles(first_name, last_name), machines(name, color_hex)").eq("week_id", week.id);
    weekShifts = data || [];
    todayPresent = weekShifts.filter((s) => s.day_of_week === todayDow && s.shift_type === "work");
  }

  function overlaps(aS: string, aE: string, bS: string, bE: string) {
    return aS < bE && bS < aE;
  }
  const todayShortages = (minStaffing || [])
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
      <h1 className="text-xl font-semibold">Tableau de bord</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Personnel actif" value={String(activeCount || 0)} />
        <Stat label="Présents aujourd'hui" value={String(todayPresent.length)} />
        <Stat label="Demandes en attente" value={String(pendingLeaves?.length || 0)} link="/demandes" />
        <Stat label="Remplacements ouverts" value={String(openReplacements?.length || 0)} link="/remplacements" />
      </div>

      {todayShortages.length > 0 && (
        <div className="card p-4 border-red-200 bg-red-50">
          <p className="text-sm font-medium text-red-700">⚠ Effectifs insuffisants aujourd'hui</p>
          <ul className="text-xs text-red-600 mt-1 list-disc pl-4">
            {todayShortages.map((s: any, i: number) => <li key={i}>{s.machines?.name || "Poste"} — créneau {s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)}</li>)}
          </ul>
          <Link href="/planning/postes" className="text-xs text-red-700 underline">Voir la vue par postes</Link>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-semibold mb-3">Présents aujourd'hui — {DAY_LABELS[todayDow]}</h2>
        {todayPresent.length === 0 && <p className="text-sm text-slate-400">Aucun créneau de travail aujourd'hui.</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {todayPresent.map((s: any) => (
            <div key={s.id} className="text-sm border border-slate-100 rounded-lg p-2">
              <p className="font-medium">{s.profiles?.first_name} {s.profiles?.last_name}</p>
              <p className="text-xs text-slate-500">{s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)} — {s.machines?.name || "Non affecté"}</p>
            </div>
          ))}
        </div>
      </div>

      {pendingLeaves && pendingLeaves.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Demandes en attente</h2>
          {pendingLeaves.map((l: any) => (
            <p key={l.id} className="text-sm">{l.profiles?.first_name} {l.profiles?.last_name} — {l.type} du {l.date_start} au {l.date_end}</p>
          ))}
          <Link href="/demandes" className="text-sm text-brand-600 hover:underline mt-2 inline-block">Traiter les demandes →</Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, link }: { label: string; value: string; link?: string }) {
  const content = (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
  return link ? <Link href={link}>{content}</Link> : content;
}
