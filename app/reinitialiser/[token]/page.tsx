import Link from "next/link";
import { lookupAccessToken } from "@/lib/tokens";
import ResetForm from "./ResetForm";

export default async function ResetPage({ params }: { params: { token: string } }) {
  const lookup = await lookupAccessToken(params.token, "reset");

  let content: React.ReactNode;
  if (lookup.status === "ok") {
    content = <ResetForm token={params.token} />;
  } else {
    const message =
      lookup.status === "expired"
        ? "Ce lien de réinitialisation a expiré (validité : 2 heures). Refaites une demande."
        : lookup.status === "used"
        ? "Ce lien a déjà été utilisé."
        : "Ce lien est introuvable.";
    content = (
      <div className="text-center">
        <h1 className="text-lg font-semibold mb-2">Lien invalide</h1>
        <p className="text-sm text-slate-600 mb-4">{message}</p>
        <Link href="/mot-de-passe-oublie" className="btn-primary w-full inline-flex">
          Refaire une demande
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">{content}</div>
    </div>
  );
}
