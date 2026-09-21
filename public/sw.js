// Service worker minimal : permet l'installation de l'application (PWA)
// sur téléphone et ordinateur. Ne met rien en cache pour l'instant afin que
// les données de planning restent toujours à jour.
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", () => {
  // Volontairement transparent : chaque requête va directement au serveur.
});
