"use client";

import { useState } from "react";

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      const res = await fetch("/api/auth/reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur.");
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold mb-2">Mot de passe mis à jour ✅</h1>
        <button className="btn-primary w-full mt-4" onClick={() => (window.location.href = "/tableau-de-bord")}>
          Accéder à l'application
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold mb-1">Nouveau mot de passe</h1>
      <form onSubmit={onSubmit} className="space-y-4 mt-4">
        <div>
          <label className="field-label">Nouveau mot de passe</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div>
          <label className="field-label">Confirmer</label>
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Enregistrement..." : "Valider"}
        </button>
      </form>
    </>
  );
}
