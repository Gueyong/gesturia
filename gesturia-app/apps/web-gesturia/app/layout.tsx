import "./globals.css";
import { Inter, Space_Grotesk } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import { AuthProvider } from "../components/AuthProvider";
config.autoAddCss = false; // FA CSS imported manually in globals.css

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });

export const metadata = {
  title: "Gesturia — Live Sign Language Interpreter",
  description: "Real-time speech and video translated into a 3D sign-language interpreter for broadcast.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
