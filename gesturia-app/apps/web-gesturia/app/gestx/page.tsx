"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPuzzlePiece, faLock, faXmark, faRotateRight, faSpinner,
  faHandsAslInterpreting, faArrowDown, faDownload,
} from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../components/MeshSigner";

/** GEST-X — "The internet, signed. Everywhere. Automatically."   route /gestx
 *  Olo's page (indigo · the quiet layer). The page proves the product live:
 *  a fake news page + the REAL floating interpreter signing whatever you select.
 *  Canonical identity: docs/GESTURIA_SOUL.md. */

const API = typeof window !== "undefined" ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

const P1 = "The Healing Streams Live Healing Services with Pastor Chris drew millions of viewers this weekend, with participation reported from more than a hundred nations. In Cameroon, community centres opened their halls so whole neighbourhoods could watch together.";
const P2 = "For deaf viewers, every word of the broadcast was carried by a live sign-language interpreter — a first for the country, and a glimpse of an internet that signs back.";

/* clamp the demo request to ~200 chars, cutting on a word boundary */
function clamp200(s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= 200) return t;
  const cut = t.slice(0, 200);
  const i = cut.lastIndexOf(" ");
  return i > 120 ? cut.slice(0, i) : cut;
}

/* ---------- tiny CSS scenes for the four vignettes (schematic, no icons-in-circles) ---------- */

function GTile({ size = 22, font = 11 }: { size?: number; font?: number }) {
  return (
    <span className="display" style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), background: "#0E1B38", color: "var(--gold)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: font, flex: "none" }}>G</span>
  );
}

function PhoneScene() {
  return (
    <div style={{ width: 86, height: 152, borderRadius: 20, border: "2px solid var(--line-2)", background: "linear-gradient(165deg,#E9DFC9 0%,#D9CDB2 55%,#C9BB9C 100%)", position: "relative", boxShadow: "var(--shadow-soft)" }}>
      <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", width: 26, height: 4, borderRadius: 99, background: "rgba(28,26,23,.18)" }} />
      <div style={{ position: "absolute", right: 6, bottom: 42, display: "grid", gap: 7 }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(28,26,23,.28)" }} />)}
      </div>
      {/* the interpreter, floating in the corner of the video */}
      <div style={{ position: "absolute", left: 7, bottom: 42, width: 30, height: 38, borderRadius: 8, background: "#0E1B38", border: "1px solid rgba(255,255,255,.25)", display: "grid", placeItems: "center", boxShadow: "0 6px 14px rgba(10,15,35,.35)" }}>
        <span className="display" style={{ color: "var(--gold)", fontWeight: 800, fontSize: 11 }}>G</span>
      </div>
      <div style={{ position: "absolute", left: 8, bottom: 30, width: 46, height: 4, borderRadius: 99, background: "rgba(255,255,255,.75)" }} />
      <div style={{ position: "absolute", left: 8, bottom: 22, width: 30, height: 4, borderRadius: 99, background: "rgba(255,255,255,.5)" }} />
    </div>
  );
}

function ArticleScene() {
  return (
    <div style={{ width: 172, height: 118, borderRadius: 12, background: "#fff", border: "1px solid var(--line)", position: "relative", padding: 12, boxShadow: "var(--shadow-soft)" }}>
      <div style={{ width: "62%", height: 7, borderRadius: 99, background: "rgba(28,26,23,.5)", marginBottom: 9 }} />
      {[92, 100, 78].map((w, i) => (
        <div key={i} style={{ width: `${w}%`, height: 4.5, borderRadius: 99, background: i === 1 ? "rgba(46,95,163,.32)" : "rgba(28,26,23,.13)", marginBottom: 6 }} />
      ))}
      {/* right-click menu, the real menu item highlighted */}
      <div style={{ position: "absolute", right: 8, bottom: 8, width: 116, background: "#fff", border: "1px solid var(--line-2)", borderRadius: 9, boxShadow: "var(--shadow-pop)", overflow: "hidden", fontSize: 9, lineHeight: 1 }}>
        <div style={{ padding: "6px 9px", color: "var(--muted)" }}>Copy</div>
        <div style={{ padding: "6px 9px", color: "var(--muted)", borderTop: "1px solid var(--line)" }}>Search the web…</div>
        <div style={{ padding: "6px 9px", color: "#fff", background: "var(--indigo)", fontWeight: 700 }}>Sign with Gesturia ✋</div>
      </div>
    </div>
  );
}

function CallScene() {
  return (
    <div style={{ width: 176, height: 118, borderRadius: 12, background: "#12151F", padding: 8, position: "relative", boxShadow: "var(--shadow-soft)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, height: 80 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ background: "#1B2130", borderRadius: 7, display: "grid", placeItems: "center" }}>
            <span style={{ width: 16, height: 16, borderRadius: 99, background: `rgba(255,255,255,${0.16 + i * 0.05})` }} />
          </div>
        ))}
        {/* the fourth participant is the interpreter */}
        <div style={{ background: "var(--indigo)", borderRadius: 7, display: "grid", placeItems: "center", position: "relative" }}>
          <span className="display" style={{ color: "#FFF3D0", fontWeight: 800, fontSize: 12 }}>G</span>
          <span style={{ position: "absolute", top: 4, right: 4, width: 5, height: 5, borderRadius: 99, background: "var(--gold)" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, display: "flex", justifyContent: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(255,255,255,.22)" }} />
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(255,255,255,.22)" }} />
        <span style={{ width: 8, height: 8, borderRadius: 99, background: "#D24B38" }} />
      </div>
    </div>
  );
}

function ChatScene() {
  return (
    <div style={{ width: 180, height: 118, borderRadius: 12, background: "var(--panel-2)", border: "1px solid var(--line)", padding: 9, display: "flex", gap: 8, boxShadow: "var(--shadow-soft)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
        {/* the voice note */}
        <div style={{ alignSelf: "flex-start", background: "#fff", border: "1px solid var(--line)", borderRadius: "10px 10px 10px 3px", padding: "6px 9px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "8px solid var(--indigo)" }} />
          <span className="meter" style={{ color: "var(--indigo)", height: 16 }}>
            {[7, 13, 9, 15, 6, 11, 8].map((h, i) => <i key={i} style={{ height: h }} />)}
          </span>
        </div>
        <div style={{ alignSelf: "flex-end", background: "#E2EEE0", borderRadius: "10px 10px 3px 10px", padding: "7px 9px", width: 62 }}>
          <div style={{ height: 4, borderRadius: 99, background: "rgba(28,26,23,.2)" }} />
        </div>
        <div style={{ alignSelf: "flex-start", background: "#fff", border: "1px solid var(--line)", borderRadius: "10px 10px 10px 3px", padding: "7px 9px", width: 78 }}>
          <div style={{ height: 4, borderRadius: 99, background: "rgba(28,26,23,.16)", marginBottom: 4 }} />
          <div style={{ height: 4, width: "68%", borderRadius: 99, background: "rgba(28,26,23,.16)" }} />
        </div>
      </div>
      {/* the sidebar where the note plays as signed video */}
      <div style={{ width: 42, borderRadius: 9, background: "#0E1B38", display: "grid", placeItems: "center", position: "relative", flex: "none" }}>
        <span className="display" style={{ color: "var(--gold)", fontWeight: 800, fontSize: 12 }}>G</span>
        <div style={{ position: "absolute", bottom: 6, left: 7, right: 7, height: 3, borderRadius: 99, background: "rgba(255,255,255,.35)" }} />
      </div>
    </div>
  );
}

/* =============================================================== */

export default function GestX() {
  const [selText, setSelText] = useState("");
  const [floatOpen, setFloatOpen] = useState(false);
  const [phase, setPhase] = useState<"loading" | "signing" | "error">("loading");
  const [queue, setQueue] = useState<MeshClip[]>([]);
  const [signed, setSigned] = useState("");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const lastReq = useRef("");

  /* track selection inside the fake article only */
  useEffect(() => {
    const onSel = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed) return;
      const t = s.toString().replace(/\s+/g, " ").trim();
      if (t && articleRef.current?.contains(s.anchorNode)) setSelText(t);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  /* the extension's core interaction, reproduced in-page */
  const sign = useCallback(async (raw?: string) => {
    const text = clamp200(raw ?? (selText || P1));
    if (!text) return;
    lastReq.current = text;
    setFloatOpen(true); setPhase("loading"); setSigned(text); setQueue([]);
    try {
      const r = await fetch(`${API}/v1/smplx/translate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const m = await r.json();
      setQueue([{ vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`, frames: m.frames, nverts: m.nverts, fps: m.fps }]);
      setPhase("signing");
    } catch {
      setPhase("error");            // warm fallback — the engine is local; Olo waits
    }
  }, [selText]);

  const goTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const preview = selText.length > 64 ? selText.slice(0, 64) + "…" : selText;

  const vignettes = [
    { name: "TikTok", today: true, scene: <PhoneScene />, line: "A creator posts, no captions. Uria signs it in the corner. You never miss a beat." },
    { name: "The article", today: true, scene: <ArticleScene />, line: "Right-click. “Sign this.” Every nuance — the brow raise on the question mark is right." },
    { name: "The Zoom call", today: false, scene: <CallScene />, line: "A hearing-deaf conversation with no interpreter, on a stock call." },
    { name: "The voice note", today: false, scene: <ChatScene />, line: "Played as signed video, silently, in a sidebar." },
  ];

  return (
    <main style={{ minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @keyframes gxTwinkle { 0%,100% { opacity: .9 } 50% { opacity: .3 } }
        @keyframes gxRise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
        @keyframes gxPop { from { opacity: 0; transform: scale(.92) translateY(10px) } to { opacity: 1; transform: none } }
        .gx-rise { animation: gxRise .65s ease both }
        .gx-article ::selection { background: rgba(46,95,163,.28) }
        .gx-article::selection { background: rgba(46,95,163,.28) }
        .gx-float { right: -16px; bottom: -22px; width: 236px }
        .gx-vign { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
        .gx-steps { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px }
        .gx-pillghost:hover { background: rgba(255,255,255,.12) }
        a.gx-navlink { color: #C9D6EA; text-decoration: none; font-size: 14px }
        a.gx-navlink:hover { color: #fff }
        .gx-code { background: var(--panel-3); border: 1px solid var(--line-2); border-radius: 6px; padding: 2px 7px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; white-space: nowrap }
        @media (max-width: 760px) {
          .gx-vign, .gx-steps { grid-template-columns: 1fr }
          /* lifted clear of the "Sign this" action row that launches it */
          .gx-float { right: 8px; bottom: 118px; width: 205px }
          .gx-hide-sm { display: none }
        }
      `}</style>

      {/* ================= HERO — the indigo night, softening into cream ================= */}
      <header style={{ position: "relative", overflow: "hidden", paddingBottom: 190, background: "linear-gradient(180deg,#0A1428 0%,#12264C 40%,#2E5FA3 74%,#91A9CC 89%,#F3E9D8 100%)" }}>
        {/* stars — two layers, slow twinkle, fading toward the horizon */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: "gxTwinkle 5.5s ease-in-out infinite",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,.7) 42%, transparent 68%)",
          maskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,.7) 42%, transparent 68%)",
          backgroundImage: "radial-gradient(1.6px 1.6px at 8% 18%, rgba(255,255,255,.9) 40%, transparent 60%), radial-gradient(1.4px 1.4px at 23% 33%, rgba(255,255,255,.7) 40%, transparent 60%), radial-gradient(1.8px 1.8px at 37% 11%, rgba(255,255,255,.85) 40%, transparent 60%), radial-gradient(1.3px 1.3px at 55% 27%, rgba(255,255,255,.6) 40%, transparent 60%), radial-gradient(1.7px 1.7px at 71% 15%, rgba(255,255,255,.85) 40%, transparent 60%), radial-gradient(1.3px 1.3px at 86% 29%, rgba(255,255,255,.65) 40%, transparent 60%), radial-gradient(1.5px 1.5px at 94% 9%, rgba(255,255,255,.8) 40%, transparent 60%)" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: "gxTwinkle 7.5s ease-in-out 1.4s infinite",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,.6) 40%, transparent 64%)",
          maskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,.6) 40%, transparent 64%)",
          backgroundImage: "radial-gradient(1.4px 1.4px at 14% 46%, rgba(255,255,255,.6) 40%, transparent 60%), radial-gradient(1.8px 1.8px at 46% 8%, rgba(244,184,31,.85) 40%, transparent 60%), radial-gradient(1.3px 1.3px at 64% 38%, rgba(255,255,255,.55) 40%, transparent 60%), radial-gradient(1.5px 1.5px at 79% 45%, rgba(255,255,255,.6) 40%, transparent 60%), radial-gradient(1.6px 1.6px at 30% 24%, rgba(244,184,31,.5) 40%, transparent 60%)" }} />

        <div style={{ position: "relative", maxWidth: 1040, margin: "0 auto", padding: "0 20px" }}>
          {/* nav */}
          <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0" }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
              <div className="display" style={{ width: 40, height: 40, borderRadius: 13, background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18 }}>G</div>
              <div>
                <div className="display" style={{ fontWeight: 700, fontSize: 16, lineHeight: 1, color: "#FFF9EC" }}>Gesturia <span style={{ color: "#8FA9CE", fontWeight: 500 }}>/</span> Gest-X</div>
                <div style={{ fontSize: 11, color: "#8FA9CE", marginTop: 3 }}>the quiet layer over the web</div>
              </div>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <a className="gx-navlink gx-hide-sm" href="/">Home</a>
              <a className="gx-navlink gx-hide-sm" href="/studio">Studio</a>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid rgba(243,233,216,.3)", color: "#D7E1F2", borderRadius: 999, padding: "5px 12px", fontSize: 11.5, fontWeight: 600, letterSpacing: ".05em" }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--gold)" }} />BETA
              </span>
            </div>
          </nav>

          {/* hero copy — the calmest launch */}
          <div style={{ textAlign: "center", paddingTop: 58 }}>
            <div className="gx-rise" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#9FB4D8", fontSize: 12.5, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase" }}>
              <FontAwesomeIcon icon={faPuzzlePiece} style={{ fontSize: 12 }} /> The browser extension
            </div>
            <h1 className="display gx-rise" style={{ margin: "16px auto 0", maxWidth: 860, fontSize: "clamp(36px, 6.2vw, 60px)", lineHeight: 1.06, color: "#FFF9EC", animationDelay: ".08s" }}>
              The internet, <span style={{ color: "var(--gold)" }}>signed.</span><br />Everywhere. Automatically.
            </h1>
            <div className="gx-rise" style={{ marginTop: 24, animationDelay: ".18s" }}>
              <p style={{ margin: "0 auto", maxWidth: 460, color: "#C9D6EA", fontSize: 17.5, lineHeight: 1.6 }}>
                “Install me once. I’ll be here — I’ll sign whatever you need.”
              </p>
              <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "#8FA9CE" }}>
                Olo · 42 · the anchor
              </div>
            </div>
            <div className="gx-rise" style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 30, flexWrap: "wrap", animationDelay: ".28s" }}>
              <a href="#install" onClick={goTo("install")} className="g-pill" style={{ background: "#FFF9EC", color: "#14213D", textDecoration: "none", fontWeight: 700 }}>
                <FontAwesomeIcon icon={faDownload} /> Get Gest-X (beta)
              </a>
              <a href="#demo" onClick={goTo("demo")} className="g-pill gx-pillghost" style={{ background: "transparent", border: "1px solid rgba(255,255,255,.38)", color: "#EDE6D6", textDecoration: "none" }}>
                See it work <FontAwesomeIcon icon={faArrowDown} />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ================= THE LIVE DEMO — a webpage inside the webpage ================= */}
      <section id="demo" style={{ position: "relative", zIndex: 2, maxWidth: 780, margin: "-148px auto 0", padding: "0 20px", scrollMarginTop: 24 }}>
        <div style={{ position: "relative" }}>
          <span className="g-chip" style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", zIndex: 6, boxShadow: "var(--shadow-soft)", fontWeight: 600 }}>
            <span className="dot" style={{ background: "var(--indigo)" }} />Live demo — nothing to install
          </span>

          {/* the fake browser window */}
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "var(--shadow-pop)" }}>
            {/* chrome */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--line)", background: "var(--panel-2)", borderRadius: "16px 16px 0 0" }}>
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <span style={{ width: 11, height: 11, borderRadius: 99, background: "var(--coral)" }} />
                <span style={{ width: 11, height: 11, borderRadius: 99, background: "var(--gold)" }} />
                <span style={{ width: 11, height: 11, borderRadius: 99, background: "var(--emerald)" }} />
              </div>
              <div style={{ flex: 1, maxWidth: 400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#fff", border: "1px solid var(--line)", borderRadius: 999, padding: "6px 14px", fontSize: 12.5, color: "var(--ink-soft)" }}>
                <FontAwesomeIcon icon={faLock} style={{ fontSize: 10, color: "var(--muted)" }} /> anywebsite.com/news
              </div>
              <div style={{ position: "relative", flex: "none", color: "var(--muted)" }} title="Gest-X is installed here">
                <FontAwesomeIcon icon={faPuzzlePiece} style={{ fontSize: 15 }} />
                <span style={{ position: "absolute", top: -2, right: -3, width: 7, height: 7, borderRadius: 99, background: "var(--indigo)", border: "1.5px solid var(--panel-2)" }} />
              </div>
            </div>

            {/* the extension's quiet toast */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", background: "#EFF3FA", borderBottom: "1px solid #DCE4F2", fontSize: 13, color: "#274F89" }}>
              <GTile size={20} font={10} />
              <span><b>Gest-X is active on this demo.</b> Select any sentence below, then press “Sign this” — exactly what right-click does once installed.</span>
            </div>

            {/* the fake article — deliberately serif: it's Anyone's website, not ours */}
            <div className="gx-article" ref={articleRef} style={{ padding: "26px 30px 26px", fontFamily: "Georgia, 'Times New Roman', serif" }}>
              <div style={{ fontFamily: "var(--font-sans, Inter), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--coral-600)" }}>World · Faith</div>
              <h2 style={{ margin: "8px 0 6px", fontSize: "clamp(20px, 3.2vw, 26px)", lineHeight: 1.22, color: "#1e1c19", fontWeight: 700 }}>
                Healing Streams live services draw millions across a hundred nations
              </h2>
              <div style={{ fontFamily: "var(--font-sans, Inter), sans-serif", fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
                News desk · anywebsite.com · 4 July 2026
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 16, lineHeight: 1.68, color: "#262421" }}>{P1}</p>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.68, color: "#262421" }}>{P2}</p>

              {/* the action row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)", fontFamily: "var(--font-sans, Inter), sans-serif" }}>
                <button className="g-pill g-indigo" onMouseDown={(e) => e.preventDefault()} onClick={() => sign()} aria-label="Sign the selected text">
                  <FontAwesomeIcon icon={faHandsAslInterpreting} /> {selText ? "Sign this" : "Sign this paragraph"}
                </button>
                <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 180 }}>
                  {selText ? <>“{preview}” · {clamp200(selText).length} chars</> : <>Nothing selected yet — I’ll sign the first paragraph.</>}
                </span>
              </div>
            </div>

            {/* ============ THE FLOATING INTERPRETER — the real thing, over the article's corner ============ */}
            {floatOpen && (
              <div className="gx-float" style={{ position: "absolute", zIndex: 7, transform: `translate(${pos.x}px, ${pos.y}px)` }}>
                <div style={{ borderRadius: 14, overflow: "hidden", background: "#080b16", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 26px 60px rgba(10,15,35,.5)", animation: dragging ? "none" : "gxPop .32s ease both" }}>
                  {/* title bar = drag handle */}
                  <div
                    onPointerDown={(e) => { dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
                    onPointerMove={(e) => { const d = dragRef.current; if (d) setPos({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }); }}
                    onPointerUp={() => { dragRef.current = null; setDragging(false); }}
                    onPointerCancel={() => { dragRef.current = null; setDragging(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 6px 0 9px", background: "#0E1526", borderBottom: "1px solid rgba(255,255,255,.08)", cursor: dragging ? "grabbing" : "grab", userSelect: "none", touchAction: "none" }}>
                    <GTile size={20} font={10} />
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 11.5, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {phase === "signing" ? "Gest-X — signing" : phase === "loading" ? "Gest-X — warming up" : "Gest-X — offline"}
                    </span>
                    <button onClick={() => { setFloatOpen(false); setQueue([]); }} onPointerDown={(e) => e.stopPropagation()} aria-label="Close the interpreter"
                      style={{ width: 22, height: 22, borderRadius: 7, border: "none", cursor: "pointer", background: "rgba(255,255,255,.14)", color: "#fff", fontSize: 11, display: "grid", placeItems: "center", flex: "none" }}>
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>

                  {/* body: loading / error / signing */}
                  <div style={{ height: 246, position: "relative" }}>
                    {phase === "loading" && (
                      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#8ea0c8", fontSize: 12.5 }}>
                        <div style={{ textAlign: "center", display: "grid", gap: 10, justifyItems: "center", padding: "0 18px" }}>
                          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 20 }} />
                          Olo is getting ready…
                          <span style={{ color: "#C9D4EA", fontSize: 12, lineHeight: 1.55, fontStyle: "italic" }}>
                            “First time takes a breath — after this I’m quick.”
                          </span>
                        </div>
                      </div>
                    )}
                    {phase === "error" && (
                      <div style={{ position: "absolute", inset: 0, padding: "18px 16px", color: "#C9D4EA", fontSize: 12.5, lineHeight: 1.65 }}>
                        Olo can’t reach his engine right now. The interpreter runs on the local Gesturia engine (port 8020) — start it, and he’ll be here. He’ll wait.
                        <div style={{ marginTop: 14 }}>
                          <button onClick={() => sign(lastReq.current)} className="g-pill" style={{ background: "rgba(255,255,255,.14)", color: "#fff", padding: ".55rem 1rem", fontSize: 12.5 }}>
                            <FontAwesomeIcon icon={faRotateRight} /> Try again
                          </button>
                        </div>
                      </div>
                    )}
                    {phase === "signing" && (
                      <>
                        <MeshSigner queue={queue} loop hint={false} />
                        <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, zIndex: 3, background: "rgba(10,14,26,.66)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "6px 10px" }}>
                          <div style={{ color: "#fff", fontSize: 11.5, lineHeight: 1.45, maxHeight: 67, overflowY: "auto", overscrollBehavior: "contain" }}>{signed}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--muted)", marginTop: 40 }}>
          The demo clamps to 200 characters. The installed extension signs full articles — and live-interprets any tab’s audio.
        </p>
      </section>

      {/* ================= FOUR VIGNETTES — where Olo shows up ================= */}
      <section style={{ maxWidth: 960, margin: "72px auto 0", padding: "0 20px" }}>
        <div className="g-label" style={{ color: "var(--indigo)", marginBottom: 5 }}>Where Olo shows up</div>
        <h2 className="display" style={{ margin: "0 0 18px", fontSize: "clamp(24px, 3.4vw, 30px)" }}>Four places. One quiet layer.</h2>
        <div className="gx-vign">
          {vignettes.map((v) => (
            <article key={v.name} className="g-card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span className="display" style={{ fontWeight: 700, fontSize: 15.5 }}>{v.name}</span>
                {v.today
                  ? <span className="g-chip g-chip-used" style={{ fontSize: ".72rem" }}><span className="dot" />today</span>
                  : <span className="g-chip g-chip-gold" style={{ fontSize: ".72rem" }}><span className="dot" />coming</span>}
              </div>
              <div className="g-inset" style={{ height: 158, display: "grid", placeItems: "center" }}>{v.scene}</div>
              <p style={{ margin: "13px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>{v.line}</p>
            </article>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 14 }}>
          The honest ledger — <b style={{ color: "var(--ink-soft)" }}>today</b>: sign any selected text, live-interpret any tab’s audio.{" "}
          <b style={{ color: "var(--ink-soft)" }}>Coming</b>: the sign-back camera, cross-device sync.
        </p>
      </section>

      {/* ================= INSTALL (BETA) ================= */}
      <section id="install" style={{ maxWidth: 960, margin: "72px auto 0", padding: "0 20px", scrollMarginTop: 24 }}>
        <div className="g-card" style={{ padding: "28px 28px 26px" }}>
          <div className="g-label" style={{ color: "var(--indigo)", marginBottom: 5 }}>Install · beta</div>
          <h2 className="display" style={{ margin: "0 0 6px", fontSize: "clamp(24px, 3.4vw, 30px)" }}>Three quiet steps.</h2>
          <p style={{ margin: "0 0 22px", fontSize: 14.5, color: "var(--ink-soft)" }}>No store yet. No account. Two minutes.</p>
          <div className="gx-steps">
            {[
              { t: "Open the door", d: <>Go to <span className="gx-code">chrome://extensions</span> and switch on <b>Developer mode</b>, top right.</> },
              { t: "Load unpacked", d: <>Click <b>Load unpacked</b> in the toolbar that appears.</> },
              { t: "Point at Olo", d: <>Choose the folder <span className="gx-code">gesturia-app/apps/gest-x</span>. He appears in your toolbar — and every page becomes signable.</> },
            ].map((s, i) => (
              <div key={s.t} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div className="display" style={{ width: 34, height: 34, borderRadius: 99, border: "1.5px solid var(--indigo)", color: "var(--indigo)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 15, flex: "none" }}>{i + 1}</div>
                <div>
                  <div className="display" style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{s.t}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--ink-soft)" }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
            <span className="g-chip g-chip-gold"><span className="dot" />Chrome Web Store release — after the 6th</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Then: right-click any selected text → <b style={{ color: "var(--ink-soft)" }}>Sign with Gesturia</b> · click the toolbar icon → live-interpret the tab’s audio.
            </span>
          </div>
        </div>
      </section>

      {/* ================= THE VISION LINE + FOOTER ================= */}
      <section style={{ maxWidth: 960, margin: "72px auto 0", padding: "0 20px" }}>
        <div className="g-card" style={{ padding: "48px 36px", textAlign: "center", background: "linear-gradient(140deg, var(--ink) 0%, #23283C 100%)", border: "none" }}>
          <h2 className="display" style={{ margin: "0 auto", maxWidth: 640, fontSize: "clamp(23px, 3.6vw, 34px)", lineHeight: 1.3, color: "#FFF9EC" }}>
            We are not asking the internet to change.{" "}
            <span style={{ color: "#9FB4D8" }}>We made it signable from the outside.</span>
          </h2>
        </div>
        <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "22px 4px 40px", color: "var(--muted)", fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <GTile size={26} font={13} />
            Gesturia — a country of gestures. Olo keeps the layer.
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <a href="/" style={{ color: "var(--indigo)", textDecoration: "none", fontWeight: 600 }}>Home</a>
            <a href="/studio" style={{ color: "var(--indigo)", textDecoration: "none", fontWeight: 600 }}>Gestlingua Studio</a>
            <a href="/solo" style={{ color: "var(--indigo)", textDecoration: "none", fontWeight: 600 }}>Gestsolo</a>
          </div>
        </footer>
      </section>
    </main>
  );
}
