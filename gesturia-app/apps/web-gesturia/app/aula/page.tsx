"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay, faPause, faRotateLeft, faPen, faCheck, faSpinner, faHandPointRight,
  faThumbtack, faHourglassHalf, faChalkboardUser, faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../components/MeshSigner";

// API reached on the same host that served the page — works on localhost AND from phones on the LAN
const API = typeof window !== "undefined" ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

/** GESTAULA — "A classroom where every child is fluent."  (Lea · emerald)
 *  The teacher's desk: write a lesson line by line, Lea signs it at the front of the class.
 *  Aesthetic: a well-kept teacher's desk — paper, ruled ink, emerald authority, a gold thread. */

type StepStatus = "waiting" | "preparing" | "ready" | "signing" | "done" | "missing" | "error";
type Step = { text: string; status: StepStatus; clip?: MeshClip; missing?: string[] };

const DRAFT_KEY = "gestaula.draft";
const SAMPLE_TITLE = "Leçon 12 — La famille";
const SAMPLE_TEXT = [
  "Welcome to class",
  "Today we learn about family",
  "Mother and father love you",
  "Thank you for coming",
].join("\n");

const ROSTER: { name: string; present: boolean; progress: number; note?: string; tone?: "gold" | "coral" }[] = [
  { name: "Léa A.",   present: true,  progress: 0.86 },
  { name: "Amina",    present: true,  progress: 0.58, note: "confuses MOTHER / FATHER — review Thursday", tone: "gold" },
  { name: "Nfor",     present: true,  progress: 0.63, note: "struggles with: handshape — slow the fingerspelling", tone: "gold" },
  { name: "Béatrice", present: true,  progress: 0.74 },
  { name: "Emmanuel", present: false, progress: 0.41, note: "absent today — back Monday", tone: "coral" },
  { name: "Chantal",  present: true,  progress: 0.79 },
  { name: "Divine",   present: true,  progress: 0.91 },
  { name: "Samuel",   present: true,  progress: 0.49, note: "location drifts on THANK-YOU — front row helps", tone: "gold" },
];

/* ---------- little hand-drawn things (SVG = schematic only) ---------- */

/** one confident emerald ink stroke under a heading — the teacher's underline */
function Ink({ width = 170 }: { width?: number }) {
  return (
    <svg className="aula-ink" width={width} height="10" viewBox="0 0 170 10" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block", marginTop: 4 }}>
      <path d="M3 6.8 C 34 3.2, 66 2.6, 96 4.6 S 150 7.6, 167 4.4" fill="none" stroke="var(--emerald)" strokeWidth="2.6" strokeLinecap="round" opacity=".92" />
    </svg>
  );
}

/** an underlined word inside running text — a parameter Lea grades */
function InkWord({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: "relative", whiteSpace: "nowrap", fontWeight: 600, color: "var(--emerald)" }}>
      {children}
      <svg className="aula-inkw" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"
        style={{ position: "absolute", left: 0, bottom: -4, width: "100%", height: 6 }}>
        <path d="M2 4.2 Q 26 1.4 51 3.1 T 98 2.4" fill="none" stroke="var(--emerald)" strokeWidth="1.8" strokeLinecap="round" opacity=".5" />
      </svg>
    </span>
  );
}

/** toghu-inspired embroidery thread — diamonds and gold knots, kept quiet */
function Toghu({ id }: { id: string }) {
  return (
    <svg width="100%" height="9" aria-hidden="true" style={{ display: "block", opacity: 0.55 }}>
      <defs>
        <pattern id={id} width="22" height="9" patternUnits="userSpaceOnUse">
          <path d="M1 4.5 L6 1 L11 4.5 L6 8 Z" fill="none" stroke="var(--emerald)" strokeWidth="1" />
          <circle cx="16.5" cy="4.5" r="1.4" fill="var(--gold)" />
        </pattern>
      </defs>
      <rect width="100%" height="9" fill={`url(#${id})`} />
    </svg>
  );
}

/** a pencil-line progress mark — no chart.js rainbow, just emerald graphite */
function PencilBar({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ position: "relative", width: 96, height: 8, flex: "none" }} aria-hidden="true">
        <span style={{ position: "absolute", left: 0, right: 0, top: 5, borderTop: "1px dotted var(--line-2)" }} />
        <span style={{ position: "absolute", left: 0, top: 3, height: 3, width: `${Math.round(value * 100)}%`, background: "var(--emerald)", borderRadius: 4, transform: "rotate(-0.7deg)", opacity: 0.85 }} />
      </span>
      <span className="aula-hand" style={{ fontSize: 15, color: "var(--emerald)", width: 22, textAlign: "right" }}>{Math.round(value * 100)}</span>
    </span>
  );
}

/* ---------- the page ---------- */

export default function AulaPage() {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [text, setText] = useState(SAMPLE_TEXT);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [dateLine, setDateLine] = useState("");

  const [mode, setMode] = useState<"edit" | "signing">("edit");
  const [steps, setSteps] = useState<Step[]>([]);
  const [queue, setQueue] = useState<MeshClip[]>([]);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [restartNonce, setRestartNonce] = useState(0);
  const [fetchDone, setFetchDone] = useState(false);
  const [apiDown, setApiDown] = useState(false);

  const runIdRef = useRef(0);
  const clipLineRef = useRef<Map<string, number>>(new Map());

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rate = slow ? 0.75 : 1;

  /* ----- the draft lives on this desk (localStorage) ----- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d?.title === "string") setTitle(d.title);
        if (typeof d?.text === "string") setText(d.text);
      }
    } catch { /* a torn page — start fresh */ }
    setDraftLoaded(true);
    try {
      setDateLine(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }));
    } catch { setDateLine(""); }
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, text })); } catch { /* full desk drawer */ }
    }, 400);
    return () => clearTimeout(t);
  }, [title, text, draftLoaded]);

  const mark = useCallback((idx: number, patch: Partial<Step>) => {
    setSteps((s) => s.map((st, i) => (i === idx ? { ...st, ...patch } : st)));
  }, []);

  /* ----- the working feature: each line goes through the pipeline, in order ----- */
  const startSigning = useCallback(async (sourceLines: string[]) => {
    if (!sourceLines.length) return;
    const run = ++runIdRef.current;
    clipLineRef.current = new Map();
    setSteps(sourceLines.map((t) => ({ text: t, status: "waiting" })));
    setQueue([]); setPaused(false); setFetchDone(false); setApiDown(false);
    setMode("signing");
    for (let i = 0; i < sourceLines.length; i++) {
      if (runIdRef.current !== run) return;
      setSteps((s) => s.map((st, j) => (j === i ? { ...st, status: "preparing" } : st)));
      try {
        const r = await fetch(`${API}/v1/smplx/translate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sourceLines[i] }),
        });
        if (runIdRef.current !== run) return;
        if (r.status === 422) {
          const e = await r.json().catch(() => ({} as any));
          const missing = e?.detail?.missing;
          setSteps((s) => s.map((st, j) => (j === i ? { ...st, status: "missing", missing: Array.isArray(missing) ? missing : [] } : st)));
          continue;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const m = await r.json();
        const clip: MeshClip = {
          vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`,
          facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`,
          frames: m.frames, nverts: m.nverts, fps: m.fps,
        };
        clipLineRef.current.set(clip.vertsUrl, i);
        setApiDown(false);
        setSteps((s) => s.map((st, j) => (j === i ? { ...st, status: "ready", clip } : st)));
        setQueue((q) => [...q, clip]);
      } catch {
        if (runIdRef.current !== run) return;
        setSteps((s) => s.map((st, j) => (j === i ? { ...st, status: "error" } : st)));
        if (clipLineRef.current.size === 0) setApiDown(true); // Lea can't reach the signing room at all
      }
    }
    if (runIdRef.current === run) setFetchDone(true);
  }, []);

  /* head of the queue = the line Lea is signing right now */
  useEffect(() => {
    const head = queue[0];
    if (!head) return;
    const idx = clipLineRef.current.get(head.vertsUrl);
    if (idx === undefined) return;
    setSteps((s) => s.map((st, i) => (i === idx && st.status !== "done" ? { ...st, status: "signing" } : st)));
  }, [queue]);

  /* a clip finished -> tick the line, advance the queue */
  const advance = useCallback((url: string) => {
    const idx = clipLineRef.current.get(url);
    if (idx !== undefined) mark(idx, { status: "done" });
    setQueue((q) => q.slice(1));
  }, [mark]);

  /* MeshSigner holds the LAST clip's final pose without firing onFinished — a quiet timer ticks it done */
  useEffect(() => {
    if (queue.length !== 1 || !fetchDone || paused) return;
    const c = queue[0];
    const ms = (c.frames / c.fps / rate) * 1000 + 900;
    const t = setTimeout(() => {
      const idx = clipLineRef.current.get(c.vertsUrl);
      if (idx !== undefined) mark(idx, { status: "done" });
      setQueue([]);
    }, ms);
    return () => clearTimeout(t);
  }, [queue, fetchDone, paused, rate, restartNonce, mark]);

  const backToEdit = useCallback(() => {
    runIdRef.current++;
    setMode("edit"); setQueue([]); setPaused(false); setFetchDone(false);
  }, []);

  const replay = useCallback(() => {
    const clips = steps.filter((s) => s.clip).map((s) => s.clip!) as MeshClip[];
    if (!clips.length) return;
    setSteps((s) => s.map((st) => (st.clip ? { ...st, status: "ready" } : st)));
    setQueue(clips); setPaused(false); setFetchDone(true); setRestartNonce((n) => n + 1);
  }, [steps]);

  /* derived: where is Lea in the lesson? */
  const signingIdx = queue[0] ? clipLineRef.current.get(queue[0].vertsUrl) : undefined;
  const preparingIdx = steps.findIndex((s) => s.status === "preparing");
  const lessonDone = mode === "signing" && fetchDone && queue.length === 0 && steps.length > 0
    && steps.every((s) => ["done", "missing", "error"].includes(s.status));
  const signedCount = steps.filter((s) => s.status === "done").length;
  const isSigning = signingIdx !== undefined;
  const waitingForPrep = mode === "signing" && queue.length === 0 && preparingIdx >= 0;

  const statusLine =
    mode === "edit" ? "" :
    apiDown && clipLineRef.current.size === 0 ? "Lea can't reach the signing room." :
    isSigning ? `Lea signs line ${signingIdx! + 1} of ${steps.length}` :
    waitingForPrep ? `Lea is preparing line ${preparingIdx + 1}…` :
    lessonDone ? `Lesson signed — ${signedCount} of ${steps.length} lines.` : "";

  return (
    <main className="aula-root">
      {/* Lora reads like print for lesson text; Caveat is the teacher's pen. Fonts only — no libraries. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: AULA_CSS }} />

      <div className="aula-wrap">

        {/* ================= HEADER — the school's front door ================= */}
        <header className="g-card aula-paper aula-header">
          <span className="aula-thread" aria-hidden="true" />
          <a href="/" className="aula-gmark display" title="Gesturia — home" aria-label="Back to Gesturia">G</a>
          <div style={{ minWidth: 0 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 19, lineHeight: 1.1 }}>
              Gestaula
              <span className="aula-serif" style={{ fontWeight: 400, fontStyle: "italic", fontSize: 15, color: "var(--ink-soft)", marginLeft: 10 }}>
                — a classroom where every child is fluent
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              Lea teaches at the front. You write the lesson.
            </div>
          </div>
          <div className="aula-headchips">
            <span className="g-chip"><span className="dot" style={{ background: "var(--emerald)" }} />INJS Yaoundé · pilot</span>
            <span className="g-chip g-chip-gold"><span className="dot" />MINESEC aligned</span>
          </div>
        </header>

        {/* ================= DESK — composer left, class right ================= */}
        <div className="aula-grid">

          {/* -------- the lesson composer : a sheet from the teacher's notebook -------- */}
          <section className="g-card aula-paper aula-rotL aula-composer" aria-label="Lesson composer">
            <span className="aula-thread" aria-hidden="true" />
            <div className="aula-pad">
              <div className="aula-labelrow">
                <span className="g-label" style={{ color: "var(--emerald)" }}>Cahier de préparation</span>
                <span className="aula-hand" style={{ fontSize: 16.5, color: "var(--muted)" }}>{dateLine || " "}</span>
              </div>

              <h1 className="display" style={{ margin: "10px 0 0", fontSize: 30, lineHeight: 1.08 }}>
                Write today&rsquo;s lesson.
              </h1>
              <Ink width={196} />
              <p className="aula-serif" style={{ margin: "10px 0 0", fontStyle: "italic", fontSize: 15.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                Lea signs it — line by line, at the front of the class. You don&rsquo;t need to know a single sign.
              </p>

              {mode === "edit" ? (
                <div className="aula-fade" style={{ marginTop: 18 }}>
                  <label className="g-label" htmlFor="aula-title">Titre de la leçon</label>
                  <input
                    id="aula-title" className="g-input aula-serif" style={{ marginTop: 6, fontSize: 17 }}
                    value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Leçon 12 — La famille"
                  />

                  <div className="aula-labelrow" style={{ marginTop: 16 }}>
                    <label className="g-label" htmlFor="aula-steps">Les étapes de la leçon</label>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>one line = one step Lea signs</span>
                  </div>
                  <textarea
                    id="aula-steps" className="g-input aula-serif aula-ruled" rows={7} spellCheck={false}
                    value={text} onChange={(e) => setText(e.target.value)}
                    placeholder={"Welcome to class\nToday we learn about family"}
                  />

                  <div className="aula-composer-foot">
                    <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                      <b style={{ color: "var(--ink-soft)" }}>{lines.length}</b> step{lines.length === 1 ? "" : "s"} ·
                      draft saved on this desk ✓
                    </div>
                    <button
                      className="g-pill g-emerald" onClick={() => startSigning(lines)} disabled={!lines.length}
                      title="Lea signs each line, in order, at the front of the class"
                    >
                      <FontAwesomeIcon icon={faPlay} /> Sign the lesson
                    </button>
                  </div>
                </div>
              ) : (
                <div className="aula-fade" style={{ marginTop: 18 }}>
                  <div className="aula-labelrow">
                    <span className="g-label">Plan au tableau</span>
                    <button className="g-pill g-soft aula-pill-sm" onClick={backToEdit}>
                      <FontAwesomeIcon icon={faPen} /> Edit lesson
                    </button>
                  </div>
                  <div className="aula-serif" style={{ fontWeight: 600, fontSize: 20, marginTop: 10 }}>
                    {title.trim() || "Leçon du jour"}
                  </div>
                  <Ink width={150} />

                  <ol className="aula-steps" aria-label="Lesson steps">
                    {steps.map((st, i) => {
                      const active = st.status === "signing";
                      return (
                        <li key={i} className={`aula-step ${active ? "is-active" : ""} is-${st.status}`}>
                          <span className="aula-step-no display" aria-hidden="true">
                            {active ? <FontAwesomeIcon icon={faHandPointRight} style={{ color: "var(--emerald)" }} /> : `${i + 1}.`}
                          </span>
                          <span className="aula-serif aula-step-text">
                            {st.text}
                            {st.status === "missing" && (
                              <span className="aula-hand aula-step-note" style={{ color: "#8A6410" }}>
                                Lea doesn&rsquo;t know{st.missing?.length ? `: ${st.missing.join(", ")}` : " some of these words"} — try simpler words
                              </span>
                            )}
                            {st.status === "error" && (
                              <span className="aula-hand aula-step-note" style={{ color: "var(--coral-600)" }}>
                                the signing service stumbled here — sign the lesson again
                              </span>
                            )}
                          </span>
                          <span className="aula-step-state">
                            {st.status === "waiting" && <span style={{ color: "var(--muted)" }}>…</span>}
                            {st.status === "preparing" && <span style={{ color: "var(--muted)" }}><FontAwesomeIcon icon={faSpinner} spin /> preparing</span>}
                            {st.status === "ready" && <span style={{ color: "var(--emerald)", opacity: 0.7 }}>ready</span>}
                            {st.status === "signing" && <span className="aula-signing-now"><span className="aula-pulse-dot" /> signing now</span>}
                            {st.status === "done" && <FontAwesomeIcon icon={faCheck} style={{ color: "var(--emerald)" }} />}
                            {st.status === "missing" && <span style={{ color: "#8A6410" }}>unknown signs</span>}
                            {st.status === "error" && <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: "var(--coral)" }} />}
                          </span>
                        </li>
                      );
                    })}
                  </ol>

                  {lessonDone && (
                    <div className="aula-fade" style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <button className="g-pill g-emerald aula-pill-sm" onClick={replay}>
                        <FontAwesomeIcon icon={faRotateLeft} /> Sign it again
                      </button>
                      <span className="aula-hand" style={{ fontSize: 17, color: "var(--emerald)" }}>
                        bien — la leçon est signée ✓
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* -------- the class : Lea at the board, the roster pinned below -------- */}
          <section className="aula-right" aria-label="The class">

            <div className="g-card aula-paper aula-stagecard">
              <span className="aula-thread" aria-hidden="true" />
              <div className="aula-pad" style={{ paddingBottom: 14 }}>
                <div className="aula-labelrow" style={{ marginBottom: 10 }}>
                  <span className="g-label" style={{ color: "var(--emerald)" }}>
                    <FontAwesomeIcon icon={faChalkboardUser} style={{ marginRight: 6 }} />Devant la classe
                  </span>
                  {isSigning && (
                    <span className="aula-liveline"><span className="aula-pulse-dot" /> line {signingIdx! + 1} / {steps.length}</span>
                  )}
                </div>

                {/* the board: a thin chalkboard-dark frame around the LIVE avatar */}
                <div className="aula-board">
                  <div className="aula-board-screen">
                    <MeshSigner queue={queue} loop={false} onFinished={advance} hint={false} paused={paused} rate={rate} restartNonce={restartNonce} />

                    {mode === "signing" && (
                      <div className="aula-chalk-title aula-hand" aria-hidden="true">{title.trim() || "Leçon du jour"}</div>
                    )}

                    {mode === "edit" && (
                      <div className="aula-board-msg">
                        <span className="aula-hand" style={{ fontSize: 22, color: "rgba(243,233,216,.85)" }}>
                          The board is ready.
                        </span>
                        <span style={{ fontSize: 13, color: "rgba(243,233,216,.55)", maxWidth: 300 }}>
                          Write your lesson in the composer, press &ldquo;Sign the lesson&rdquo; — Lea takes it from there.
                        </span>
                      </div>
                    )}

                    {mode === "signing" && apiDown && clipLineRef.current.size === 0 && (
                      <div className="aula-board-msg">
                        <span className="aula-hand" style={{ fontSize: 21, color: "rgba(243,233,216,.9)" }}>
                          Lea stepped out for a moment…
                        </span>
                        <span style={{ fontSize: 13, color: "rgba(243,233,216,.6)", maxWidth: 320 }}>
                          The signing service isn&rsquo;t reachable. Your lesson is saved on this desk — nothing is lost.
                        </span>
                        <button className="g-pill g-soft aula-pill-sm" style={{ marginTop: 6 }} onClick={() => startSigning(steps.map((s) => s.text))}>
                          <FontAwesomeIcon icon={faRotateLeft} /> Try again
                        </button>
                      </div>
                    )}

                    {waitingForPrep && !apiDown && (
                      <div className="aula-board-msg">
                        <span style={{ fontSize: 13.5, color: "rgba(243,233,216,.8)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span className="aula-pulse-dot" style={{ background: "var(--gold)" }} />
                          Lea is preparing line {preparingIdx + 1}…
                        </span>
                        <span className="aula-hand" style={{ fontSize: 18, color: "rgba(243,233,216,.6)", maxWidth: 320 }}>
                          Lea reads the whole line before she signs it — a moment.
                        </span>
                      </div>
                    )}

                    {lessonDone && (
                      <div className="aula-board-done aula-hand" role="status">leçon signée ✓</div>
                    )}

                    {isSigning && steps[signingIdx!] && (
                      <div className="aula-caption">
                        <span style={{ opacity: 0.6, marginRight: 8 }}>{signingIdx! + 1}.</span>
                        <span className="aula-serif" style={{ fontStyle: "italic" }}>{steps[signingIdx!].text}</span>
                      </div>
                    )}
                  </div>

                  {/* the chalk tray */}
                  <div className="aula-tray" aria-hidden="true">
                    <span className="aula-chalk" />
                    <span className="aula-chalk aula-chalk-em" />
                    <span className="aula-eraser" />
                    <span style={{ flex: 1 }} />
                    <span className="aula-hand" style={{ fontSize: 14, color: "rgba(243,233,216,.5)" }}>tableau · classe de 6e</span>
                  </div>
                </div>

                {/* playback: the teacher's remote */}
                <div className="aula-controls">
                  <button className="g-pill g-soft aula-pill-sm" onClick={() => setPaused((p) => !p)}
                    disabled={queue.length === 0} aria-label={paused ? "Resume signing" : "Pause signing"}>
                    <FontAwesomeIcon icon={paused ? faPlay : faPause} /> {paused ? "Resume" : "Pause"}
                  </button>
                  <button className={`g-pill aula-pill-sm ${slow ? "g-emerald" : "g-soft"}`} onClick={() => setSlow((s) => !s)}
                    disabled={queue.length === 0} aria-pressed={slow} title="Lea signs slower — good for new signs">
                    {slow ? "×0.75 on" : "Slower ×0.75"}
                  </button>
                  <button className="g-pill g-soft aula-pill-sm" onClick={() => setRestartNonce((n) => n + 1)}
                    disabled={queue.length === 0} aria-label="Restart the current line">
                    <FontAwesomeIcon icon={faRotateLeft} /> Restart line
                  </button>
                  <span role="status" aria-live="polite" className="aula-status">{statusLine}</span>
                </div>
              </div>
            </div>

            {/* -------- the roster : a page pinned to the desk -------- */}
            <div className="g-card aula-paper aula-rotR aula-roster">
              <span className="aula-pin" aria-hidden="true"><FontAwesomeIcon icon={faThumbtack} /></span>
              <div className="aula-pad" style={{ paddingTop: 22 }}>
                <div className="aula-labelrow">
                  <div>
                    <div className="aula-serif" style={{ fontWeight: 600, fontSize: 17 }}>Classe de 6e — INJS Yaoundé</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>8 élèves · {ROSTER.filter((r) => r.present).length} présents aujourd&rsquo;hui</div>
                  </div>
                  <span className="aula-hand" style={{ fontSize: 16, color: "var(--muted)" }}>carnet du maître</span>
                </div>

                <ul className="aula-roster-list">
                  {ROSTER.map((s) => (
                    <li key={s.name} className="aula-pupil">
                      <span className={`aula-dot ${s.present ? "is-here" : "is-away"}`}
                        title={s.present ? "présent" : "absent"} aria-label={s.present ? "present" : "absent"} />
                      <span style={{ minWidth: 0 }}>
                        <span className="aula-serif" style={{ fontSize: 15, fontWeight: 500 }}>{s.name}</span>
                        {s.note && (
                          <span className="aula-hand aula-pupil-note" style={{ color: s.tone === "coral" ? "var(--coral-600)" : "#7A5E10" }}>
                            {s.note}
                          </span>
                        )}
                      </span>
                      <PencilBar value={s.progress} />
                    </li>
                  ))}
                </ul>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
                  progress = signs recognised by the class evaluator · marks are the teacher&rsquo;s own
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ================= THE PROMISE — short, honest ================= */}
        <section className="g-card aula-paper aula-promise">
          <Toghu id="aula-tog-top" />
          <div className="aula-pad" style={{ paddingTop: 16, paddingBottom: 18 }}>
            <span className="g-label" style={{ color: "var(--emerald)" }}>La promesse</span>
            <p className="aula-serif" style={{ margin: "8px 0 0", fontSize: 18.5, lineHeight: 1.65, maxWidth: 860 }}>
              The teacher teaches. <b style={{ color: "var(--emerald)" }}>Lea signs.</b> The AI grades all five parameters
              — <InkWord>handshape</InkWord>, <InkWord>orientation</InkWord>, <InkWord>location</InkWord>, <InkWord>movement</InkWord>, <InkWord>expression</InkWord>.
            </p>
            <div className="g-chip" style={{ marginTop: 12, background: "var(--panel-2)" }}>
              <FontAwesomeIcon icon={faHourglassHalf} style={{ color: "var(--gold)", fontSize: 12 }} />
              Sign grading arrives with the GestSolo evaluator (in training).
            </div>
          </div>
        </section>

        {/* ================= FOOTER — quiet ================= */}
        <footer className="aula-footer">
          <span>Gestaula · part of <b style={{ color: "var(--ink-soft)" }}>Gesturia</b> — every sign belongs somewhere</span>
          <nav style={{ display: "flex", gap: 16 }} aria-label="Gesturia products">
            <a className="aula-navlink" href="/">Accueil</a>
            <a className="aula-navlink" href="/studio">Gestlingua Studio</a>
            <a className="aula-navlink" href="/solo">Gestsolo</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}

/* ================= the desk's own stylesheet (scoped by .aula-*) ================= */
const AULA_CSS = `
.aula-root { min-height: 100vh;
  background-image: radial-gradient(rgba(28,26,23,.03) 1px, transparent 1.3px);
  background-size: 23px 23px; }
.aula-wrap { max-width: 1200px; margin: 0 auto; padding: 18px 20px 40px; }
.aula-serif { font-family: Lora, Georgia, "Times New Roman", serif; }
.aula-hand  { font-family: Caveat, "Segoe Print", "Bradley Hand", cursive; }

.aula-paper { position: relative; overflow: hidden; }
.aula-thread { position: absolute; top: 0; left: 20px; right: 20px; height: 3px; border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--gold) 14%, #FFD76A 50%, var(--gold) 86%, transparent); }
.aula-pad { padding: 20px 22px; }
.aula-rotL { transform: rotate(-0.35deg); }
.aula-rotR { transform: rotate(0.45deg); }

.aula-header { display: flex; align-items: center; gap: 14px; padding: 14px 18px; }
.aula-gmark { width: 46px; height: 46px; border-radius: 14px; background: var(--ink); color: var(--gold);
  display: grid; place-items: center; font-weight: 800; font-size: 21px; text-decoration: none; flex: none;
  transition: transform .15s ease, box-shadow .15s ease; }
.aula-gmark:hover { transform: rotate(-3deg) scale(1.04); box-shadow: var(--shadow-soft); }
.aula-headchips { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

.aula-grid { display: grid; grid-template-columns: 0.97fr 1.03fr; gap: 22px; align-items: start; margin-top: 22px; }
.aula-right { display: grid; gap: 20px; }

.aula-labelrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

/* the exercise-book textarea: real ruled lines that scroll with the ink */
textarea.aula-ruled { margin-top: 6px; resize: vertical; min-height: 224px; line-height: 31px; font-size: 15.5px;
  padding: 5px 16px 12px 56px; border-radius: 14px; background-color: #FFFDF6;
  background-image:
    linear-gradient(90deg, transparent 0 42px, rgba(232,85,58,.30) 42px 43.5px, transparent 43.5px),
    repeating-linear-gradient(180deg, transparent 0 30px, rgba(28,26,23,.09) 30px 31px);
  background-attachment: local, local; }
textarea.aula-ruled:focus { border-color: var(--emerald); background-color: #fff; }
#aula-title:focus { border-color: var(--emerald); }

.aula-composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 16px; flex-wrap: wrap; }

/* the plan on the board */
.aula-steps { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 4px; }
.aula-step { display: grid; grid-template-columns: 30px 1fr auto; align-items: start; gap: 10px;
  padding: 9px 10px 9px 8px; border-radius: 11px; border-left: 3px solid transparent;
  font-size: 15.5px; line-height: 1.45; transition: background .2s ease, border-color .2s ease; }
.aula-step-no { color: var(--muted); font-weight: 600; font-size: 14px; padding-top: 1px; }
.aula-step-text { min-width: 0; }
.aula-step-state { font-size: 12px; font-weight: 600; white-space: nowrap; padding-top: 2px; }
.aula-step.is-active { background: rgba(62,142,90,.10); border-left-color: var(--emerald); }
.aula-step.is-active .aula-step-text { font-weight: 600; color: var(--ink); }
.aula-step.is-done .aula-step-text { opacity: .72; }
.aula-step.is-missing { background: rgba(244,184,31,.10); border-left-color: var(--gold); }
.aula-step.is-error { background: rgba(232,85,58,.08); border-left-color: var(--coral); }
.aula-step-note { display: block; font-size: 15px; line-height: 1.25; margin-top: 2px; }
.aula-signing-now { color: var(--emerald); display: inline-flex; align-items: center; gap: 6px; }
.aula-pulse-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--emerald); display: inline-block;
  animation: aulaPulse 1.4s ease-in-out infinite; }

/* the board — thin chalkboard-dark frame, wooden-dark tray */
.aula-board { border-radius: 16px; background: linear-gradient(180deg, #2B3A31, #22302A);
  padding: 8px 8px 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 16px 36px rgba(28,26,23,.16); }
.aula-board-screen { position: relative; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden;
  border: 1px solid rgba(255,255,255,.09); }
.aula-chalk-title { position: absolute; top: 8px; left: 14px; z-index: 2; font-size: 19px;
  color: rgba(243,233,216,.78); text-shadow: 0 1px 0 rgba(0,0,0,.4); pointer-events: none;
  max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aula-board-msg { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px; text-align: center; padding: 20px; pointer-events: none; }
.aula-board-msg button { pointer-events: auto; }
.aula-board-done { position: absolute; top: 10px; right: 12px; z-index: 2; font-size: 19px;
  color: #BFF0D4; background: rgba(10,14,26,.55); padding: 2px 12px; border-radius: 999px;
  border: 1px solid rgba(191,240,212,.35); animation: aulaFade .4s ease both; }
.aula-caption { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); z-index: 2;
  max-width: 88%; padding: 7px 16px; border-radius: 999px; background: rgba(10,14,26,.62);
  backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,.12);
  color: #fff; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  animation: aulaFade .3s ease both; }
.aula-tray { display: flex; align-items: center; gap: 9px; padding: 7px 12px 5px; }
.aula-chalk { width: 30px; height: 6px; border-radius: 3px; background: linear-gradient(180deg, #F7F2E7, #D9D2C2);
  transform: rotate(-1.5deg); box-shadow: 0 1px 2px rgba(0,0,0,.35); }
.aula-chalk-em { width: 22px; background: linear-gradient(180deg, #9CCDB0, #6FA786); transform: rotate(2deg); }
.aula-eraser { width: 34px; height: 11px; border-radius: 3px; background: linear-gradient(180deg, #4A4038, #332C25);
  box-shadow: 0 1px 2px rgba(0,0,0,.4); }

.aula-controls { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.aula-pill-sm { padding: .55rem .95rem; font-size: .84rem; }
.aula-status { margin-left: auto; font-size: 12.5px; color: var(--ink-soft); font-weight: 600; min-height: 1em; }
.aula-liveline { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700;
  color: var(--emerald); letter-spacing: .02em; }

/* the pinned roster */
.aula-roster { background:
  repeating-linear-gradient(180deg, transparent 0 34px, rgba(28,26,23,.05) 34px 35px), var(--panel); }
.aula-pin { position: absolute; top: 8px; left: 50%; transform: translateX(-50%) rotate(18deg); z-index: 2;
  color: var(--coral); font-size: 17px; filter: drop-shadow(0 2px 2px rgba(28,26,23,.35)); }
.aula-roster-list { list-style: none; margin: 14px 0 0; padding: 0; }
.aula-pupil { display: grid; grid-template-columns: 14px 1fr auto; align-items: center; gap: 10px;
  padding: 7px 8px; border-radius: 9px; }
.aula-pupil:hover { background: rgba(62,142,90,.06); }
.aula-dot { width: 9px; height: 9px; border-radius: 999px; justify-self: center; }
.aula-dot.is-here { background: var(--emerald); }
.aula-dot.is-away { background: transparent; border: 2px solid var(--coral); width: 8px; height: 8px; }
.aula-pupil-note { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  font-size: 15.5px; line-height: 1.15; margin-top: 1px; overflow: hidden; }

.aula-promise { margin-top: 22px; }
.aula-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px;
  margin-top: 18px; padding: 4px 6px; font-size: 13px; color: var(--muted); flex-wrap: wrap; }
.aula-navlink { color: var(--ink-soft); text-decoration: none; font-weight: 500; }
.aula-navlink:hover { color: var(--emerald); text-decoration: underline; text-underline-offset: 3px; }

/* ink that draws itself */
.aula-ink path, .aula-inkw path { stroke-dasharray: 320; stroke-dashoffset: 320; animation: aulaDraw .9s .25s ease forwards; }
@keyframes aulaDraw { to { stroke-dashoffset: 0; } }
@keyframes aulaFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.aula-fade { animation: aulaFade .35s ease both; }
@keyframes aulaPulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }

.aula-root button:focus-visible, .aula-root a:focus-visible,
.aula-root input:focus-visible, .aula-root textarea:focus-visible {
  outline: 2px solid var(--emerald); outline-offset: 2px; }

@media (max-width: 980px) {
  .aula-grid { grid-template-columns: 1fr; }
  .aula-rotL, .aula-rotR { transform: none; }
  .aula-header { flex-wrap: wrap; }
  .aula-headchips { margin-left: 60px; justify-content: flex-start; }
  .aula-status { flex-basis: 100%; margin-left: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .aula-root *, .aula-root *::before, .aula-root *::after { animation: none !important; transition: none !important; }
  .aula-ink path, .aula-inkw path { stroke-dashoffset: 0; }
}
`;
