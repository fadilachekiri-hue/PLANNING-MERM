"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PremiereConfigurationPage() {
  const router = useRouter();
  const [form, setForm] = useState({ secret: "", firstName: "", lastName: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ identifiant: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/setup/proprietaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setResult({ identifiant: data.identifiant });
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <h1 className="text-lg font-semibold mb-2">Compte propriétaire créé ✅</h1>
          <p className="text-sm text-slate-600 mb-2">Votre identifiant de connexion (à conserver) :</p>
          <p className="text-xl font-mono bg-slate-100 rounded-lg py-2 px-3 mb-6">{result.identifiant}</p>
          <button className="btn-primary w-full" onClick={() => router.push("/tableau-de-bord")}>Accéder à l'application</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold mb-1">Première configuration</h1>
        <p className="text-sm text-slate-500 mb-6">Cette page ne peut être utilisée qu'une seule fois, pour créer le compte propriétaire.</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="field-label">Code d'installation</label>
            <input className="input" type="password" required value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
            <p className="text-xs text-slate-400 mt-1">Défini dans les paramètres du projet (SETUP_SECRET).</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Prénom</label>
              <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Nom</label>
              <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Mot de passe</label>
            <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Confirmer le mot de passe</label>
            <input className="input" type="password" required minLength={8} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button className="btn-primary w-full" disabled={saving}>{saving ? "Création..." : "Créer le compte propriétaire"}</button>
        </form>
      </div>
    </div>
  );
}
