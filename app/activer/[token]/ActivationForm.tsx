"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivationForm({ token, firstName }: { token: string; firstName: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ identifiant: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/activer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'activation.");
        return;
      }
      setResult({ identifiant: data.identifiant });
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold mb-2">Compte activé ✅</h1>
        <p className="text-sm text-slate-600 mb-4">Votre identifiant de connexion, à conserver pour vos prochaines connexions :</p>
        <p className="text-xl font-mono bg-slate-100 rounded-lg py-2 px-3 mb-6">{result.identifiant}</p>
        <button className="btn-primary w-full" onClick={() => router.push("/tableau-de-bord")}>
          Accéder à l'application
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Bonjour {firstName} 👋</h1>
      <p className="text-sm text-slate-500 mb-6">Choisissez le mot de passe que vous utiliserez à chaque connexion.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="field-label">Nouveau mot de passe</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <p className="text-xs text-slate-400 mt-1">8 caractères minimum.</p>
        </div>
        <div>
          <label className="field-label">Confirmer le mot de passe</label>
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Activation..." : "Activer mon compte"}
        </button>
      </form>
    </>
  );
}
