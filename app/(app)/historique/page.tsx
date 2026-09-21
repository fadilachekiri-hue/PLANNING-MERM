import { redirect } from "next/navigation";
import { getCurrentProfile, isAdminOrOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const ACTION_LABELS: Record<string, string> = {
  creation_membre: "Membre ajouté",
  modification_membre: "Membre modifié",
  suppression_membre: "Membre supprimé",
  desactivation_membre: "Membre désactivé",
  reactivation_membre: "Membre réactivé",
  promotion_administratrice: "Promue administratrice",
  retrait_administratrice: "Droits administratrice retirés",
  envoi_invitation: "Invitation envoyée",
  generation_lien_invitation: "Lien d'invitation généré",
  generation_lien_reinitialisation: "Lien de réinitialisation généré",
  activation_compte: "Compte activé",
  reinitialisation_mot_de_passe: "Mot de passe réinitialisé",
  creation_creneau: "Créneau ajouté",
  modification_creneau: "Créneau modifié",
  suppression_creneau: "Créneau supprimé",
  publication_planning: "Planning publié",
  ajout_membre_semaine: "Personne ajoutée à la semaine",
  retrait_membre_semaine: "Personne retirée de la semaine",
  creation_demande: "Demande créée",
  decision_demande: "Demande traitée",
  creation_recherche_remplacant: "Recherche de remplaçant créée",
  reponse_remplacement: "Réponse à un remplacement",
  confirmation_remplacement: "Remplacement confirmé",
  annulation_remplacement: "Recherche de remplaçant annulée",
  modification_competences: "Compétences modifiées",
  modification_regle_binome: "Règle de binôme modifiée",
  validation_binome: "Binôme validé",
  creation_regle_effectif: "Règle d'effectif créée",
  suppression_regle_effectif: "Règle d'effectif supprimée",
};

export default async function HistoriquePage() {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminOrOwner(profile)) redirect("/tableau-de-bord");

  const supabase = createClient();
  const { data: logs } = await supabase
    .from("audit_log")
    .select("*, profiles!audit_log_actor_id_fkey(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Historique</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Auteur</th>
              <th className="text-left px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {(logs || []).map((l: any) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-500">{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-2">{l.profiles ? `${l.profiles.first_name} ${l.profiles.last_name}` : "Système"}</td>
                <td className="px-4 py-2">{ACTION_LABELS[l.action] || l.action}</td>
              </tr>
            ))}
            {(!logs || logs.length === 0) && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Aucune action enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
