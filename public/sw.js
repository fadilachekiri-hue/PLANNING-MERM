// Service worker minimal : permet l'installation de l'application (PWA)
// sur téléphone et ordinateur. Pas d'écouteur "fetch" : un écouteur vide
// suffit à perturber la navigation interne de Next.js (App Router) sur
// certains navigateurs (notamment Safari iOS), qui provoquait le plantage
// "t.parallelRoutes is not an object". Ne rien intercepter est le plus sûr.
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
