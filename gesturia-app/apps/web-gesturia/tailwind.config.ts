import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { coral: "#E8553A", gold: "#F4B81F", emerald: "#3E8E5A", indigo: "#2E5FA3", cream: "#F3E9D8", ink: "#1C1A17" },
        bg: "#0B1020", surface: "#121a30", muted: "#93a4bf",
      },
      fontFamily: { sans: ["system-ui", "Segoe UI", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
