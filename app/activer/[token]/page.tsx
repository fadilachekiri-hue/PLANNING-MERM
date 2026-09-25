import Link from "next/link";
import { lookupAccessToken } from "@/lib/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import ActivationForm from "./ActivationForm";

export default async function ActivationPage({ params }: { params: { token: string } }) {
  const lookup = await lookupAccessToken(params.token, "invite");

  let content: React.ReactNode;

  if (lookup.status === "not_found") {
    content = (
      <ErrorState
        title="Lien introuvable"
        message="Ce lien d'invitation n'existe pas ou a été mal recopié. Demandez à votre administratrice de vous en envoyer un nouveau."
      />
    );
  } else if (lookup.status === "used") {
    content = (
      <ErrorState
        title="Lien déjà utilisé"
        message="Ce lien d'invitation a déjà servi à activer le compte. Si vous avez oublié votre mot de passe, utilisez « Mot de passe oublié »."
        showLogin
      />
    );
  } else if (lookup.status === "expired") {
    content = (
      <ErrorState
        title="Lien expiré"
        message="Ce lien d'invitation a expiré (validité : 7 jours). Demandez à votre administratrice de vous renvoyer une invitation."
      />
    );
  } else {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("first_name, status")
      .eq("id", lookup.profileId)
      .single();

    if (!profile) {
      content = <ErrorState title="Compte introuvable" message="Ce compte n'existe plus. Contactez votre administratrice." />;
    } else if (profile.status === "active") {
      content = (
        <ErrorState
          title="Compte déjà activé"
          message="Ce compte est déjà actif. Connectez-vous avec votre identifiant et votre mot de passe."
          showLogin
        />
      );
    } else {
      content = <ActivationForm token={params.token} firstName={profile.first_name} />;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">{content}</div>
    </div>
  );
}

function ErrorState({ title, message, showLogin }: { title: string; message: string; showLogin?: boolean }) {
  return (
    <div className="text-center">
      <h1 className="text-lg font-semibold mb-2">{title}</h1>
      <p className="text-sm text-slate-600">{message}</p>
      {showLogin && (
        <Link href="/connexion" className="btn-primary w-full mt-6 inline-flex">
          Aller à la connexion
        </Link>
      )}
    </div>
  );
}
