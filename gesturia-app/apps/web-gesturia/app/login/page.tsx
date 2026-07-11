"use client";
/** /login — sign in or create a Gesturia account. On success, redirects to ?next=… (default /solo). */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { ApiError } from "@gesturia/core";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const next = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("next")) || "/solo";

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim() || email.split("@")[0]);
      router.push(next);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20,
      background: "radial-gradient(120% 90% at 50% 0%, #fbf3e2 0%, var(--panel-2,#F8F2E4) 55%)" }}>
      <div className="g-card" style={{ width: "100%", maxWidth: 400, padding: 28 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 18 }}>
          <span className="display" style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center",
            color: "#fff", fontWeight: 800, fontSize: 20, background: "linear-gradient(135deg,var(--coral,#E8553A),var(--gold,#F4B81F))" }}>G</span>
          <span className="display" style={{ fontSize: 20, fontWeight: 800, color: "var(--ink,#1C1A17)" }}>Gesturia</span>
        </a>

        <h1 className="display" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p style={{ color: "var(--muted,#9C9179)", fontSize: 13.5, margin: "0 0 18px" }}>
          {mode === "login" ? "Sign in to keep your progress, XP and certificates." : "Learn sign language and keep every step you take."}
        </p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {mode === "signup" && (
            <input className="g-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="name" style={{ padding: ".7rem .85rem", fontSize: 14 }} />
          )}
          <input className="g-input" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" style={{ padding: ".7rem .85rem", fontSize: 14 }} />
          <input className="g-input" type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} style={{ padding: ".7rem .85rem", fontSize: 14 }} />

          {err && <div className="signeval-err" style={{ color: "var(--coral,#CF4629)", fontSize: 13, fontWeight: 600 }}>{err}</div>}

          <button type="submit" className="g-pill g-coral" disabled={busy}
            style={{ justifyContent: "center", padding: ".7rem", fontSize: 15, fontWeight: 700, marginTop: 4, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13.5, color: "var(--ink-soft,#6C6455)" }}>
          {mode === "login" ? "New to Gesturia? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(null); }}
            style={{ background: "none", border: "none", color: "var(--coral,#E8553A)", fontWeight: 700, cursor: "pointer", padding: 0 }}>
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
