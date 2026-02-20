"use client";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone, faGraduationCap, faHandsAslInterpreting, faPuzzlePiece,
  faArrowRight, faHeart, faGlobe, faCirclePlay, faCertificate, faGamepad,
} from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../components/MeshSigner";

const API = typeof window !== "undefined" ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

/** Gesturia — the website. "A country of gestures. Every sign belongs somewhere."
 *  Canonical identity: docs/GESTURIA_SOUL.md — five products, one AI, one family
 *  (Gest coral · Uria gold · Lea emerald · Olo indigo · cream · ink). */
export default function Home() {
  const [demo, setDemo] = useState<MeshClip[]>([]);
  const [vocab, setVocab] = useState(0);

  useEffect(() => {
    fetch(`${API}/v1/smplx/vocab`).then((r) => r.json()).then((v) => setVocab(v.count || 0)).catch(() => {});
    fetch(`${API}/v1/smplx/translate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "jesus loves you" }),
    }).then((r) => (r.ok ? r.json() : null)).then((m) => {
      if (m) setDemo([{ vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`, frames: m.frames, nverts: m.nverts, fps: m.fps }]);
    }).catch(() => {});
  }, []);

  const products = [
    { icon: faMicrophone, tile: "tile-gold", name: "Gestlingua", tag: "Say anything. See it signed.", live: true, href: "/studio",
      text: "The translator. Speak, type, or drop a live stream — the interpreter signs it back in real time, in real 3D. Nobody signs at scale on the internet. We do." },
    { icon: faGraduationCap, tile: "tile-emerald", name: "Gestaula", tag: "A classroom where every child is fluent.", live: true, href: "/aula",
      text: "The LMS where the medium of instruction IS sign language. A hearing teacher runs a fully-signed lesson — the avatars do the signing, the AI grades the students' signs." },
    { icon: faGamepad, tile: "tile-coral", name: "Gestsolo", tag: "Duolingo for hands.", live: true, href: "/solo",
      text: "Streaks, hearts, XP, story mode. The playful way a deaf child — or their hearing parents — learn sign language. The same energy hearing kids get for Spanish." },
    { icon: faCertificate, tile: "tile-emerald", name: "Gestify", tag: "Proof that speaks for itself.", live: true, href: "/verify",
      text: "Verifiable certification. Every Gestificate is uniquely numbered and publicly checkable in seconds — turning signed-language proficiency into a real credential." },
    { icon: faPuzzlePiece, tile: "tile-indigo", name: "Gest-X", tag: "The internet, signed. Everywhere.", live: true, href: "/gestx",
      text: "The browser extension. TikTok, news, Zoom, WhatsApp — a floating interpreter that makes every website signable, without the website changing a thing." },
    { icon: faHandsAslInterpreting, tile: "tile-ink", name: `${(vocab || 3600).toLocaleString("en-US")}+ real signs`, tag: "One AI under everything.", live: true, href: "/studio",
      text: "A growing 3D dictionary lifted from real human signers — not invented gestures. One pipeline powers all five products: improve it once, everything gets better." },
  ];

  const family = [
    { name: "Gest", color: "var(--coral)", role: "The explorer", home: "/solo", homeName: "Gestsolo", text: "11. Curious, brave, big-hearted. The friend who learns alongside you — and fights anyone who teases his sister." },
    { name: "Uria", color: "var(--gold)", role: "The light", home: "/studio", homeName: "Gestlingua", text: "10. Radiant, quick-witted. The face of the translator — when meaning clicks, that’s Uria." },
    { name: "Lea", color: "var(--emerald)", role: "The teacher", home: "/aula", homeName: "Gestaula", text: "38. Warm, patient, quietly powerful. Learned to sign because her children needed her to — and is proud of it." },
    { name: "Olo", color: "var(--indigo)", role: "The anchor", home: "/gestx", homeName: "Gest‑X", text: "42. Steady, gentle, dependable. The father who shows up. Every day. The quiet layer that is always there." },
  ];

  return (
    <main style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 20px 40px" }}>

        {/* ============ NAV ============ */}
        <nav className="g-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="display" style={{ width: 44, height: 44, borderRadius: 14, background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20 }}>G</div>
            <div>
              <div className="display" style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>Gesturia</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>A country of gestures</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 14, color: "var(--ink-soft)" }}>
            <a href="#products" style={{ color: "inherit", textDecoration: "none" }}>Products</a>
            <a href="#family" style={{ color: "inherit", textDecoration: "none" }}>The family</a>
            <a href="#mission" style={{ color: "inherit", textDecoration: "none" }}>Mission</a>
            <a href="/studio" className="g-pill g-coral" style={{ padding: ".6rem 1.1rem", textDecoration: "none" }}>
              Open Gestlingua <FontAwesomeIcon icon={faArrowRight} />
            </a>
          </div>
        </nav>

        {/* ============ HERO ============ */}
        <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "center", marginBottom: 30 }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <span className="g-chip"><span className="dot" />Live 3D interpreter</span>
              <span className="g-chip g-chip-gold"><span className="dot" />Realtime</span>
            </div>
            <h1 className="display" style={{ margin: 0, fontSize: 52, lineHeight: 1.03 }}>
              A country of <span style={{ color: "var(--coral)" }}>gestures.</span>
            </h1>
            <p style={{ color: "var(--ink-soft)", fontSize: 17, marginTop: 14, maxWidth: 540, lineHeight: 1.55 }}>
              A world where sign language is a first‑class citizen of the internet. Gesturia turns speech,
              text and live streams into fluent 3D sign language — generated fresh, in real time, by an
              interpreter the community can trust.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <a href="/studio" className="g-pill g-coral" style={{ textDecoration: "none" }}>
                <FontAwesomeIcon icon={faMicrophone} /> Start interpreting
              </a>
              <a href="#mission" className="g-pill g-soft" style={{ textDecoration: "none" }}>
                <FontAwesomeIcon icon={faCirclePlay} /> Why we exist
              </a>
            </div>
            <div style={{ display: "flex", gap: 22, marginTop: 26 }}>
              {[[`${(vocab || 3600).toLocaleString("en-US")}+`, "3D signs", "var(--coral)"], ["300k+", "deaf Cameroonians we serve", "var(--emerald)"], ["5", "products, one AI", "var(--indigo)"]].map(([n, l, c]) => (
                <div key={l as string}>
                  <div className="display" style={{ fontSize: 26, fontWeight: 800, color: c as string }}>{n}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", maxWidth: 130 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* the REAL interpreter, signing live on the landing page */}
          <div className="g-card" style={{ padding: 10, borderRadius: 26 }}>
            <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: 18, overflow: "hidden" }}>
              <MeshSigner queue={demo} loop hint={false} />
              <div style={{ position: "absolute", left: 12, top: 12 }}>
                <span className="g-live" style={{ background: "rgba(12,17,32,.6)", color: "#fff", border: "1px solid rgba(255,255,255,.14)" }}>
                  <span className="pulse" />LIVE · SIGNING “JESUS LOVES YOU”
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ============ PRODUCTS ============ */}
        <section id="products" style={{ marginBottom: 30 }}>
          <div className="g-label" style={{ marginBottom: 4 }}>One platform · one AI · one family</div>
          <h2 className="display" style={{ margin: "0 0 14px", fontSize: 28 }}>Five ways home</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {products.map((p) => (
              <a key={p.name} href={p.href} className="g-card" style={{ padding: 18, position: "relative", textDecoration: "none", color: "inherit", display: "block" }}>
                {p.live && <span className="g-chip g-chip-used" style={{ position: "absolute", top: 14, right: 14, fontSize: ".7rem" }}><span className="dot" />live</span>}
                <div className={`tile ${p.tile}`}><FontAwesomeIcon icon={p.icon} /></div>
                <div className="display" style={{ fontWeight: 700, fontSize: 17, marginTop: 12 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--coral-600)", marginTop: 2 }}>{p.tag}</div>
                <p style={{ color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.55, marginTop: 8, marginBottom: 0 }}>{p.text}</p>
                <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "var(--coral)" }}>Enter →</div>
              </a>
            ))}
          </div>
        </section>

        {/* ============ THE FAMILY ============ */}
        <section id="family" style={{ marginBottom: 30 }}>
          <div className="g-label" style={{ marginBottom: 4 }}>Gest · Uria · Lea · Olo</div>
          <h2 className="display" style={{ margin: "0 0 14px", fontSize: 28 }}>One family. Every sign belongs to them.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {family.map((f) => (
              <a key={f.name} href={f.home} className="g-card" style={{ padding: 18, borderTop: `4px solid ${f.color}`, textDecoration: "none", color: "inherit", display: "block" }}>
                <div className="display" style={{ fontWeight: 800, fontSize: 20, color: f.color }}>{f.name}</div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--muted)", marginTop: 2 }}>{f.role}</div>
                <p style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.55, marginTop: 8, marginBottom: 0 }}>{f.text}</p>
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: f.color }}>Visit {f.homeName} →</div>
              </a>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
            Most deaf children in Cameroon have hearing parents. The Gesturia family models the future — a home where everyone signs.
          </p>
        </section>

        {/* ============ MISSION ============ */}
        <section id="mission" className="g-card" style={{ padding: "30px 34px", marginBottom: 26, background: "linear-gradient(135deg, var(--ink) 0%, #2A2419 100%)", color: "#F3E9D8" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <FontAwesomeIcon icon={faHeart} style={{ color: "var(--coral)" }} />
                <span className="g-label" style={{ color: "var(--gold)" }}>Why Gesturia exists</span>
              </div>
              <h2 className="display" style={{ margin: 0, fontSize: 30, lineHeight: 1.15, color: "#FFF9EC" }}>
                The disability was never in the person. It was in the software.
              </h2>
              <p style={{ color: "#D8CDB4", fontSize: 15, lineHeight: 1.6, marginTop: 12, maxWidth: 760 }}>
                In Cameroon, more than <b style={{ color: "#F3E9D8" }}>300,000 deaf people</b> live with less than 1% full access to formal
                education. Gesturia rebuilds the software that excluded them — starting now, by interpreting
                <b style={{ color: "#F3E9D8" }}> The Healing Streams Live Healing Services with Pastor Chris</b> live for deaf viewers,
                and next, with our partners <b style={{ color: "#F3E9D8" }}>MINESEC</b> and <b style={{ color: "#F3E9D8" }}>INJS Yaoundé</b>, by
                delivering deaf education at national scale.
              </p>
            </div>
            <FontAwesomeIcon icon={faGlobe} style={{ fontSize: 84, color: "rgba(244,184,31,.25)" }} />
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 4px", color: "var(--muted)", fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="display" style={{ width: 26, height: 26, borderRadius: 8, background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>G</div>
            Gesturia — a country of gestures. Every sign belongs somewhere.
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span>MINESEC · INJS Yaoundé</span>
            <a href="/studio" style={{ color: "var(--coral)", textDecoration: "none", fontWeight: 600 }}>Gestlingua</a>
            <span>gesturia.cm (soon)</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
