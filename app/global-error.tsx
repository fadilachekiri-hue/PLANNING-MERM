"use client";

import { useEffect } from "react";

// Filet de secours si l'erreur se produit dans la mise en page racine
// elle-même (RegisterSW, etc.), en dehors de ce que app/error.tsx peut
// attraper.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "sans-serif" }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Une erreur est survenue</h1>
            <p style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
              Veuillez réessayer. Si le problème persiste, communiquez ce message :
            </p>
            <p style={{ fontSize: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", wordBreak: "break-word" }}>
              {error.message || "Erreur inconnue"}
            </p>
            <button
              onClick={() => reset()}
              style={{ marginTop: 16, background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer" }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
