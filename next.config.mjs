/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Next.js 14 garde en cache côté client (jusqu'à 30s) la page précédente
    // quand seul le paramètre d'URL change (ex. navigation "Semaine suivante"
    // sur /planning?semaine=...), ce qui donnait l'impression que le clic ne
    // faisait rien. On désactive ce cache pour les pages dynamiques.
    staleTimes: { dynamic: 0 },
  },
  async headers() {
    return [
      {
        // Empêche les téléphones de garder en cache une ancienne version
        // bogguée du service worker (voir public/sw.js).
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
