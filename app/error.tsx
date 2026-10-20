"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold mb-2">Une erreur est survenue</h1>
        <p className="text-sm text-slate-600 mb-4">
          Quelque chose s'est mal passé pendant l'affichage de cette page. Vous pouvez réessayer, ou revenir au tableau de bord.
        </p>
        <p className="text-xs text-left text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 break-words">
          {error.message || "Erreur inconnue"}
        </p>
        <div className="flex gap-2 justify-center">
          <button className="btn-secondary" onClick={() => (window.location.href = "/tableau-de-bord")}>
            Tableau de bord
          </button>
          <button className="btn-primary" onClick={() => reset()}>
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}
