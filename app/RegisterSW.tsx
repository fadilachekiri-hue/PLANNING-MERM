"use client";

import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.update())
        .catch(() => {
          // L'application reste utilisable dans le navigateur même si
          // l'installation en PWA échoue.
        });
    }
  }, []);
  return null;
}
