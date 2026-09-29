import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
        poste: {
          clinac: "#c9a227",
          unity: "#1e3a8a",
          scanner: "#16a34a",
          versahd: "#ec4899",
          xstrahl: "#d6c7a1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
