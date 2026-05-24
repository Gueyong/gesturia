"use client";
/** Gestify — shared visual parts for the /verify surface only.
 *  ToghuBand   — restrained ink+gold geometric border band (national-document cue)
 *  GoldSeal    — the layered gold seal: G + two hands, circular legend (the screenshot)
 *  ScanPattern — honest QR-like block, deterministically derived from the serial
 *  PageShell   — quiet nav + partner footer shared by /verify and /verify/[id]   */

import { useId, useMemo } from "react";
import { mulberry32, seedFrom } from "./registry";

/* ============================================================
   Toghu-inspired border band — ink ground, gold geometry.
   ============================================================ */
export function ToghuBand({ height = 22, style }: { height?: number; style?: React.CSSProperties }) {
  const uid = useId().replace(/[:]/g, "");
  const s = height / 22;
  return (
    <svg width="100%" height={height} aria-hidden="true" style={{ display: "block", ...style }}>
      <defs>
        <pattern id={`${uid}-toghu`} patternUnits="userSpaceOnUse" width={44 * s} height={22 * s}
          patternTransform={`scale(${s})`}>
          <rect width="44" height="22" fill="#1C1A17" />
          {/* hairline rails */}
          <rect x="0" y="1.6" width="44" height="0.9" fill="#F4B81F" opacity="0.5" />
          <rect x="0" y="19.5" width="44" height="0.9" fill="#F4B81F" opacity="0.5" />
          {/* central open diamond */}
          <path d="M22 4.4 L31 11 L22 17.6 L13 11 Z" fill="none" stroke="#F4B81F" strokeWidth="1.4" />
          {/* solid heart of the diamond */}
          <path d="M22 8.6 L25.2 11 L22 13.4 L18.8 11 Z" fill="#F4B81F" />
          {/* flanking chevrons (looped toghu stitch, abstracted) */}
          <path d="M4.5 6.5 L0.5 11 L4.5 15.5" fill="none" stroke="#F4B81F" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M39.5 6.5 L43.5 11 L39.5 15.5" fill="none" stroke="#F4B81F" strokeWidth="1.2" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${uid}-toghu)`} />
    </svg>
  );
}

/* ============================================================
   The GOLD SEAL — layered circles, rosette edge, G held by two hands.
   ============================================================ */
function SealHand({ mirror = false }: { mirror?: boolean }) {
  // Schematic open hand, palm up, fingers fanned — they SIGN, so fingers are separate.
  // Three bold fingers, wide-spread: thin×4 turned to blobs below ~160px; this reads at 132px.
  const fingers = [-30, 0, 30];
  return (
    <g transform={mirror ? "scale(-1,1)" : undefined} fill="#6B4E0B">
      <ellipse cx="0" cy="6" rx="7" ry="8" />
      {fingers.map((a) => (
        <rect key={a} x="-2.1" y="-15" width="4.2" height="14.5" rx="2.1" transform={`rotate(${a} 0 2)`} />
      ))}
      {/* thumb */}
      <rect x="-2.1" y="-9.5" width="4.2" height="10.5" rx="2.1" transform="rotate(64 0 5)" />
    </g>
  );
}

export function GoldSeal({ size = 168, flat = false }: { size?: number; flat?: boolean }) {
  const uid = useId().replace(/[:]/g, "");
  const teeth = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        // fixed decimals: identical strings on server and client (no hydration drift)
        return { cx: (100 + Math.cos(a) * 88).toFixed(2), cy: (100 + Math.sin(a) * 88).toFixed(2) };
      }),
    []
  );
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img"
      aria-label="Gold seal of Gesturia — the letter G held up by two signing hands"
      style={flat ? { display: "block" } : { display: "block", filter: "drop-shadow(0 10px 22px rgba(170,120,10,.35))" }}>
      <defs>
        <radialGradient id={`${uid}-gold`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FCE29A" />
          <stop offset="52%" stopColor="#F4B81F" />
          <stop offset="100%" stopColor="#D69A10" />
        </radialGradient>
        <radialGradient id={`${uid}-disc`} cx="42%" cy="32%" r="78%">
          <stop offset="0%" stopColor="#F9CF56" />
          <stop offset="70%" stopColor="#EFB325" />
          <stop offset="100%" stopColor="#DCA114" />
        </radialGradient>
        <path id={`${uid}-arc`} d="M 100 33 A 67 67 0 1 1 99.99 33" fill="none" />
      </defs>

      {/* rosette teeth */}
      {teeth.map((t, i) => (
        <circle key={i} cx={t.cx} cy={t.cy} r="8.5" fill={`url(#${uid}-gold)`} stroke="#C8940F" strokeWidth="0.5" />
      ))}
      {/* body */}
      <circle cx="100" cy="100" r="88" fill={`url(#${uid}-gold)`} stroke="#C8940F" strokeWidth="1" />
      <circle cx="100" cy="100" r="77" fill="none" stroke="#8A6410" strokeWidth="1.4" opacity="0.85" />
      <circle cx="100" cy="100" r="57.5" fill="none" stroke="#8A6410" strokeWidth="1.1" opacity="0.85" />

      {/* circular legend */}
      <text fontFamily="var(--font-display, 'Space Grotesk'), sans-serif" fontSize="10" fontWeight="600"
        fill="#6B4E0B" letterSpacing="1.6">
        <textPath href={`#${uid}-arc`} startOffset="0">
          GESTURIA · PROOF THAT SPEAKS FOR ITSELF · GESTIFY · MMXXVI ·
        </textPath>
      </text>

      {/* inner disc */}
      <circle cx="100" cy="100" r="54" fill={`url(#${uid}-disc)`} stroke="#C8940F" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="54" fill="none" stroke="#FCE29A" strokeWidth="1" opacity="0.55"
        strokeDasharray="4 7" />

      {/* the G */}
      <text x="100" y="97" textAnchor="middle" dominantBaseline="middle"
        fontFamily="var(--font-display, 'Space Grotesk'), sans-serif" fontWeight="700" fontSize="52"
        fill="#6B4E0B">G</text>

      {/* two hands holding it up */}
      <g transform="translate(84.5 130) rotate(-16) scale(0.92)"><SealHand /></g>
      <g transform="translate(115.5 130) rotate(16) scale(0.92)"><SealHand mirror /></g>
    </svg>
  );
}

/* ============================================================
   Honest scan pattern — deterministic from the serial, encodes nothing.
   Labelled on the certificate: "verify at gesturia.cm/verify/<serial>".
   ============================================================ */
function buildScanCells(serial: string): string {
  const N = 21;
  const dark: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  const reserved: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  const placeFinder = (x0: number, y0: number) => {
    for (let dy = -1; dy <= 7; dy++)
      for (let dx = -1; dx <= 7; dx++) {
        const x = x0 + dx, y = y0 + dy;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        reserved[y][x] = true;
        if (dx < 0 || dy < 0 || dx > 6 || dy > 6) continue; // separator stays light
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        dark[y][x] = ring || core ? 1 : 0;
      }
  };
  placeFinder(0, 0);
  placeFinder(N - 7, 0);
  placeFinder(0, N - 7);

  for (let i = 8; i <= N - 9; i++) {
    dark[6][i] = i % 2 === 0 ? 1 : 0; reserved[6][i] = true;
    dark[i][6] = i % 2 === 0 ? 1 : 0; reserved[i][6] = true;
  }

  const rnd = mulberry32(seedFrom(serial));
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (!reserved[y][x]) dark[y][x] = rnd() < 0.46 ? 1 : 0;

  let d = "";
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (dark[y][x]) d += `M${x} ${y}h1v1h-1z`;
  return d;
}

export function ScanPattern({ serial, size = 92 }: { serial: string; size?: number }) {
  const d = useMemo(() => buildScanCells(serial), [serial]);
  return (
    <svg viewBox="-1 -1 23 23" width={size} height={size} aria-hidden="true"
      style={{ display: "block", shapeRendering: "crispEdges" }}
      // honest: this pattern is decorative — verification is by serial, online
      data-note="decorative scan pattern derived from the serial; encodes nothing">
      <rect x="-1" y="-1" width="23" height="23" fill="#FFFDF8" />
      <path d={d} fill="#1C1A17" />
    </svg>
  );
}

/* ============================================================
   Page shell — quiet nav, partner footer, shared micro-styles.
   ============================================================ */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="gfy-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        .gfy-link { color: var(--ink-soft); text-decoration: none; border-bottom: 1px solid transparent; transition: color .15s, border-color .15s; }
        .gfy-link:hover { color: var(--ink); border-bottom-color: var(--gold); }
        .gfy-shell a:focus-visible, .gfy-shell button:focus-visible, .gfy-shell input:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; border-radius: 4px; }
        /* one ring only: the indigo trust outline — quiet the coral focus border from globals */
        .gfy-shell .g-input:focus, .gfy-shell .g-input:focus-visible { border-color: var(--line); border-radius: var(--radius-md); }
        @media (max-width: 430px) { .gfy-chrome .g-chip { font-size: .72rem; padding: .3rem .6rem; } }
        @keyframes gfyIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .gfy-in { animation: gfyIn .5s cubic-bezier(.2,.7,.3,1) both; }
        @keyframes gfyPulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        .gfy-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
        @media print { .gfy-chrome { display: none !important; } }
      `}</style>

      {/* national-document cue: one restrained band across the very top */}
      <div className="gfy-chrome"><ToghuBand height={14} /></div>

      <div style={{ maxWidth: 900, width: "100%", margin: "0 auto", padding: "0 20px",
        flex: 1, display: "flex", flexDirection: "column" }}>
        <header className="gfy-chrome" style={{ display: "flex", alignItems: "center", flexWrap: "wrap",
          justifyContent: "space-between", gap: 12, padding: "18px 0 8px" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "inherit" }}>
            <span className="display" aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12,
              background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center",
              fontWeight: 800, fontSize: 18 }}>G</span>
            <span>
              <span className="display" style={{ display: "block", fontWeight: 700, fontSize: 16.5, lineHeight: 1 }}>
                Gestify
              </span>
              <span style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                Gesturia · public registry · registre public
              </span>
            </span>
          </a>
          <span className="g-chip" style={{ background: "transparent" }}>
            <span className="dot" style={{ background: "var(--emerald)" }} />
            No login · Public record
          </span>
        </header>

        {children}
      </div>

      <footer className="gfy-chrome" style={{ borderTop: "1px solid var(--line)", marginTop: 34 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 20px 22px", display: "flex",
          flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10,
          fontSize: 12.5, color: "var(--muted)" }}>
          <span>In partnership with <strong style={{ color: "var(--ink-soft)" }}>MINESEC</strong> · <strong style={{ color: "var(--ink-soft)" }}>INJS Yaoundé</strong></span>
          <span style={{ display: "flex", gap: 16 }}>
            <a className="gfy-link" href="/">Gesturia</a>
            <a className="gfy-link" href="/solo">Learn on Gestsolo</a>
            <a className="gfy-link" href="/verify">Verify a Gestificate</a>
          </span>
        </div>
      </footer>
    </main>
  );
}
