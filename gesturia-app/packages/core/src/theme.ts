// Gesturia design tokens — one brand, three product skins. Shared by web (Tailwind) + native.

export const brand = {
  gest: "#E8553A",   // coral — action / the explorer (GestSolo accent)
  uria: "#F4B81F",   // sun-gold — light / companion
  lea: "#3E8E5A",    // emerald — growth / school (GestLea accent)
  olo: "#2E5FA3",    // indigo — trust / translation (Gesturia accent)
  cream: "#F3E9D8",  // warm background
  ink: "#1C1A17",    // toghu-black
};

export type AppKey = "gestsolo" | "gesturia" | "gestlea";

export interface AppTheme {
  key: AppKey;
  name: string;
  tagline: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  icon: string; // fontawesome name
}

export const themes: Record<AppKey, AppTheme> = {
  gestsolo: {
    key: "gestsolo", name: "GestSolo", tagline: "Learn sign language, one sign at a time",
    primary: brand.gest, secondary: brand.uria, accent: brand.lea,
    bg: "#FFFBF5", surface: "#FFFFFF", text: brand.ink, muted: "#7A736B", icon: "graduation-cap",
  },
  gesturia: {
    key: "gesturia", name: "Gesturia", tagline: "Real-time speech & text to sign",
    primary: brand.olo, secondary: brand.gest, accent: brand.uria,
    bg: "#0B1020", surface: "#121a30", text: "#E8EEF8", muted: "#93a4bf", icon: "language",
  },
  gestlea: {
    key: "gestlea", name: "GestLea", tagline: "Sign-language classrooms & schools",
    primary: brand.lea, secondary: brand.olo, accent: brand.gest,
    bg: "#F6FBF7", surface: "#FFFFFF", text: brand.ink, muted: "#6b7a70", icon: "school",
  },
};

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };
