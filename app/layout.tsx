import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "./RegisterSW";

export const metadata: Metadata = {
  title: "Planning MERM — Hôpital Henri-Mondor",
  description: "Gestion des plannings du service de radiothérapie",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
