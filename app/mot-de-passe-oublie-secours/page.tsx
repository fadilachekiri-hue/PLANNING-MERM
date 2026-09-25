"use client";

import { useState } from "react";

export default function MotDePasseOublieSecoursPage() {
  const [form, setForm] = useState({ secret: "", identifiant: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup/lien-reinitialisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setLink(data.link);
    } finally {
      setSaving(false);
    }
  }

  if (link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
        <div className="card w-full max-w-md p-8">
          <h1 className="text-lg font-semibold mb-2">Lien généré ✅</h1>
          <p className="text-sm text-slate-600 mb-4">
            Cliquez sur ce lien (valable 2 heures, à usage unique) pour définir un nouveau mot de passe :
          </p>
          <a href={link} className="btn-primary w-full block text-center">Réinitialiser mon mot de passe</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold mb-1">Mot de passe oublié (secours)</h1>
        <p className="text-sm text-slate-500 mb-6">
          Utilisez ceci si vous êtes bloquée hors de l'application (identifiant/mot de passe oubliés) et que
          l'envoi d'e-mail n'est pas disponible.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Code d'installation</label>
            <input className="input" type="password" required value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Identifiant de connexion</label>
            <input className="input" required value={form.identifiant} onChange={(e) => setForm({ ...form, identifiant: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? "Génération..." : "Générer le lien"}</button>
        </form>
      </div>
    </div>
  );
}
