import "./fonts.css";   // self-hosted (+system fallback) — the build never touches the network
import "./globals.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import { AuthProvider } from "../components/AuthProvider";
config.autoAddCss = false; // FA CSS imported manually in globals.css

export const metadata = {
  title: "Gesturia — Live Sign Language Interpreter",
  description: "Real-time speech and video translated into a 3D sign-language interpreter for broadcast.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
