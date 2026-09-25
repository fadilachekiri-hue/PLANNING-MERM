"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, Machine, CompetencyLevel, Role } from "@/lib/types";

type Competency = { profile_id: string; machine_id: string; level: CompetencyLevel };

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente d'activation", className: "bg-amber-50 text-amber-700" },
  active: { label: "Actif", className: "bg-green-50 text-green-700" },
  disabled: { label: "Désactivé", className: "bg-slate-200 text-slate-600" },
};

const LEVEL_LABEL: Record<CompetencyLevel, string> = {
  none: "Non formé",
  training: "En formation",
  autonomous: "Formé et autonome",
};

const emptyForm = {
  firstName: "",
  lastName: "",
  jobTitle: "",
  contactEmail: "",
  phone: "",
  contractedHours: 35,
  usualDays: "",
  usualHours: "",
  shiftPreference: "none",
  overtimeOk: false,
  notes: "",
};

export default function EquipeClient({
  currentProfileId,
  currentRole,
  membres,
  machines,
  competences,
}: {
  currentProfileId: string;
  currentRole: Role;
  membres: Profile[];
  machines: Machine[];
  competences: Competency[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Profile | null>(null);
  const [competencesFor, setCompetencesFor] = useState<Profile | null>(null);
  const [toDelete, setToDelete] = useState<Profile | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rowMessage, setRowMessage] = useState<Record<string, { text: string; ok: boolean; link?: string }>>({});

  function refresh() {
    router.refresh();
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/membres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Erreur lors de l'ajout.");
        return;
      }
      setShowAdd(false);
      setForm(emptyForm);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/membres/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editing.first_name,
          lastName: editing.last_name,
          jobTitle: editing.job_title,
          contactEmail: editing.contact_email,
          phone: editing.phone,
          contractedHours: editing.contracted_hours,
          usualDays: editing.usual_days,
          usualHours: editing.usual_hours,
          shiftPreference: editing.shift_preference,
          overtimeOk: editing.overtime_ok,
          notes: editing.notes,
        }),
      });
      if (res.ok) {
        setEditing(null);
        refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function invite(profile: Profile) {
    setRowMessage((m) => ({ ...m, [profile.id]: { text: "Envoi en cours...", ok: true } }));
    const res = await fetch(`/api/membres/${profile.id}/inviter`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setRowMessage((m) => ({ ...m, [profile.id]: { text: `E-mail envoyé à ${data.sentTo}`, ok: true } }));
    } else {
      setRowMessage((m) => ({ ...m, [profile.id]: { text: data.error, ok: false, link: data.link } }));
    }
  }

  async function createLink(profile: Profile) {
    const res = await fetch(`/api/membres/${profile.id}/lien-invitation`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setRowMessage((m) => ({ ...m, [profile.id]: { text: "Lien créé (à copier et transmettre vous-même) :", ok: true, link: data.link } }));
    } else {
      setRowMessage((m) => ({ ...m, [profile.id]: { text: data.error, ok: false } }));
    }
  }

  async function createResetLink(profile: Profile) {
    const res = await fetch(`/api/membres/${profile.id}/lien-reinitialisation`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setRowMessage((m) => ({ ...m, [profile.id]: { text: "Lien de réinitialisation :", ok: true, link: data.link } }));
    } else {
      setRowMessage((m) => ({ ...m, [profile.id]: { text: data.error, ok: false } }));
    }
  }

  async function toggleStatus(profile: Profile) {
    const disabled = profile.status !== "disabled";
    await fetch(`/api/membres/${profile.id}/statut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    });
    refresh();
  }

  async function toggleRole(profile: Profile) {
    const newRole = profile.role === "admin" ? "member" : "admin";
    await fetch(`/api/membres/${profile.id}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/membres/${toDelete.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToDelete(null);
        refresh();
      } else {
        setDeleteError(data.error || "Erreur lors de la suppression.");
      }
    } finally {
      setDeleting(false);
    }
  }

  function copy(link: string) {
    navigator.clipboard.writeText(link).catch(() => {});
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Équipe</h1>
          <p className="text-sm text-slate-500">{membres.length} membre(s)</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          + Ajouter un membre
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Fonction</th>
              <th className="text-left px-4 py-3">Identifiant</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Rôle</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {membres.map((m) => {
              const status = STATUS_LABEL[m.status];
              const msg = rowMessage[m.id];
              return (
                <tr key={m.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium">
                    {m.first_name} {m.last_name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{m.job_title || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.identifiant}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${status.className}`}>{status.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    {m.role !== "member" && (
                      <span className="badge bg-brand-50 text-brand-700">{m.role === "owner" ? "Propriétaire" : "Administratrice"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button className="btn-secondary text-xs" onClick={() => setEditing(m)}>Modifier</button>
                      <button className="btn-secondary text-xs" onClick={() => setCompetencesFor(m)}>Compétences</button>
                      {m.status !== "active" && (
                        <>
                          <button className="btn-secondary text-xs" onClick={() => invite(m)}>Envoyer une invitation</button>
                          <button className="btn-secondary text-xs" onClick={() => createLink(m)}>Créer un lien d'accès</button>
                        </>
                      )}
                      {m.status === "active" && (
                        <button className="btn-secondary text-xs" onClick={() => createResetLink(m)}>Lien de réinitialisation</button>
                      )}
                      {m.id !== currentProfileId && m.role !== "owner" && (
                        <button className="btn-secondary text-xs" onClick={() => toggleStatus(m)}>
                          {m.status === "disabled" ? "Réactiver" : "Désactiver"}
                        </button>
                      )}
                      {currentRole === "owner" && m.id !== currentProfileId && m.role !== "owner" && (
                        <button className="btn-secondary text-xs" onClick={() => toggleRole(m)}>
                          {m.role === "admin" ? "Retirer droits admin" : "Promouvoir administratrice"}
                        </button>
                      )}
                      {m.id !== currentProfileId && m.role !== "owner" && (
                        <button className="btn-danger text-xs" onClick={() => setToDelete(m)}>Supprimer</button>
                      )}
                    </div>
                    {msg && (
                      <div className={`mt-2 text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>
                        <p>{msg.text}</p>
                        {msg.link && (
                          <div className="flex items-center gap-2 mt-1">
                            <input readOnly className="input text-xs py-1" value={msg.link} onFocus={(e) => e.target.select()} />
                            <button className="btn-secondary text-xs" onClick={() => copy(msg.link!)}>Copier</button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {membres.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Aucun membre pour l'instant. Cliquez sur « Ajouter un membre » pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="Ajouter un membre" onClose={() => setShowAdd(false)}>
          <form onSubmit={submitAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom"><input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
              <Field label="Nom"><input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
            </div>
            <Field label="Fonction"><input className="input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adresse e-mail"><input type="email" className="input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
              <Field label="Téléphone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heures contractuelles / semaine"><input type="number" step="0.5" className="input" value={form.contractedHours} onChange={(e) => setForm({ ...form, contractedHours: Number(e.target.value) })} /></Field>
              <Field label="Préférence">
                <select className="input" value={form.shiftPreference} onChange={(e) => setForm({ ...form, shiftPreference: e.target.value })}>
                  <option value="none">Aucune</option>
                  <option value="morning">Matin</option>
                  <option value="evening">Soir</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jours habituels"><input className="input" placeholder="ex : Lundi-Vendredi" value={form.usualDays} onChange={(e) => setForm({ ...form, usualDays: e.target.value })} /></Field>
              <Field label="Horaires habituels"><input className="input" placeholder="ex : 8h-16h" value={form.usualHours} onChange={(e) => setForm({ ...form, usualHours: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.overtimeOk} onChange={(e) => setForm({ ...form, overtimeOk: e.target.checked })} />
              Peut effectuer des heures supplémentaires
            </label>
            <Field label="Informations utiles"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

            {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Annuler</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Enregistrement..." : "Ajouter"}</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title={`Modifier ${editing.first_name} ${editing.last_name}`} onClose={() => setEditing(null)}>
          <form onSubmit={submitEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom"><input className="input" value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></Field>
              <Field label="Nom"><input className="input" value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></Field>
            </div>
            <Field label="Fonction"><input className="input" value={editing.job_title || ""} onChange={(e) => setEditing({ ...editing, job_title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Adresse e-mail"><input type="email" className="input" value={editing.contact_email || ""} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} /></Field>
              <Field label="Téléphone"><input className="input" value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heures contractuelles / semaine"><input type="number" step="0.5" className="input" value={editing.contracted_hours} onChange={(e) => setEditing({ ...editing, contracted_hours: Number(e.target.value) })} /></Field>
              <Field label="Préférence">
                <select className="input" value={editing.shift_preference} onChange={(e) => setEditing({ ...editing, shift_preference: e.target.value as any })}>
                  <option value="none">Aucune</option>
                  <option value="morning">Matin</option>
                  <option value="evening">Soir</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jours habituels"><input className="input" value={editing.usual_days || ""} onChange={(e) => setEditing({ ...editing, usual_days: e.target.value })} /></Field>
              <Field label="Horaires habituels"><input className="input" value={editing.usual_hours || ""} onChange={(e) => setEditing({ ...editing, usual_hours: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.overtime_ok} onChange={(e) => setEditing({ ...editing, overtime_ok: e.target.checked })} />
              Peut effectuer des heures supplémentaires
            </label>
            <Field label="Informations utiles"><textarea className="input" rows={2} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Annuler</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
            </div>
          </form>
        </Modal>
      )}

      {competencesFor && (
        <CompetencesModal
          profile={competencesFor}
          machines={machines}
          competences={competences.filter((c) => c.profile_id === competencesFor.id)}
          onClose={() => setCompetencesFor(null)}
          onSaved={refresh}
        />
      )}

      {toDelete && (
        <Modal title="Confirmer la suppression" onClose={() => { setToDelete(null); setDeleteError(null); }}>
          <p className="text-sm text-slate-600 mb-4">
            Supprimer définitivement <strong>{toDelete.first_name} {toDelete.last_name}</strong> ? Cette action est irréversible
            (compte, historique de connexion). Pour simplement le retirer d'une semaine de planning, utilisez plutôt « Retirer du
            planning » depuis la page Planning.
          </p>
          {deleteError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{deleteError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => { setToDelete(null); setDeleteError(null); }}>Annuler</button>
            <button className="btn-danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Suppression..." : "Confirmer la suppression"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CompetencesModal({
  profile,
  machines,
  competences,
  onClose,
  onSaved,
}: {
  profile: Profile;
  machines: Machine[];
  competences: Competency[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [levels, setLevels] = useState<Record<string, CompetencyLevel>>(() => {
    const map: Record<string, CompetencyLevel> = {};
    for (const m of machines) {
      map[m.id] = competences.find((c) => c.machine_id === m.id)?.level || "none";
    }
    return map;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/membres/${profile.id}/competences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levels: Object.entries(levels).map(([machineId, level]) => ({ machineId, level })) }),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Compétences — ${profile.first_name} ${profile.last_name}`} onClose={onClose}>
      <div className="space-y-3">
        {machines.map((m) => (
          <div key={m.id} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color_hex }} />
              {m.name}
            </span>
            <select className="input w-56" value={levels[m.id]} onChange={(e) => setLevels({ ...levels, [m.id]: e.target.value as CompetencyLevel })}>
              {(["none", "training", "autonomous"] as CompetencyLevel[]).map((l) => (
                <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
              ))}
            </select>
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-3">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
