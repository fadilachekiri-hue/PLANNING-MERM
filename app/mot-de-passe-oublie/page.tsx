"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [identifiant, setIdentifiant] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiant }),
      });
      const data = await res.json();
      setMessage(data.message || "Demande envoyée.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold mb-1">Mot de passe oublié</h1>
        <p className="text-sm text-slate-500 mb-6">
          Indiquez votre identifiant. Si une adresse e-mail est enregistrée pour votre compte, un lien de
          réinitialisation vous sera envoyé.
        </p>

        {message ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{message}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="field-label">Identifiant</label>
              <input className="input" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Envoi..." : "Recevoir le lien de réinitialisation"}
            </button>
          </form>
        )}

        <div className="text-center mt-4">
          <Link href="/connexion" className="text-sm text-brand-600 hover:underline">
            Retour à la connexion
          </Link>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Aucune adresse enregistrée ou aucun e-mail reçu ? Contactez une administratrice, elle peut générer un lien
          d'accès directement depuis la gestion de l'équipe.
        </p>
      </div>
    </div>
  );
}
