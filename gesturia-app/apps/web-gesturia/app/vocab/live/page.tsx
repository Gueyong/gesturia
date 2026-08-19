"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faSpinner, faCheck, faRotateLeft, faArrowLeft, faPlus, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../../components/MeshSigner";
import SignEvaluator from "../../../components/SignEvaluator";
import AuthButton from "../../../components/AuthButton";

/** VOCAB STUDIO · Live capture — perform a sign to the camera and OUR interpreter mirrors your whole body,
 *  hands and fingers live (MediaPipe → SMPL-X retarget). When you stop, the captured motion is retargeted,
 *  auto-trimmed to the signing window, replayed on the avatar to confirm, and added to the dictionary — all
 *  instantly (no upload, no waiting): the sign you saw going in IS the sign that's stored. */

const API = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

type Phase = "name" | "capture" | "fitting" | "preview" | "committing" | "done" | "error";
type Frame = { pose: number[][]; hand_l: number[][]; hand_r: number[][] };
type Motion = { pose: number[][][]; hand_l: number[][][]; hand_r: number[][][] };
type Smooth = { pose: number[][] | null; hl: number[][] | null; hr: number[][] | null };

const present = (h?: number[][]) => Array.isArray(h) && h.some((p) => p && (p[0] || p[1] || p[2]));

/** hold + light EMA: a missing hand keeps its last pose (stays quiet, no haphazard jumping); body and the
 *  hands (fingers/wrist) are smoothed frame-to-frame to kill jitter so the mirror looks clean. */
const ema = (prev: number[][] | null, cur: number[][], a: number) =>
  prev && prev.length === cur.length ? cur.map((p, i) => p.map((c, j) => prev[i][j] * (1 - a) + c * a)) : cur;

function processOne(s: Smooth, f: { pose: number[][]; hand_l?: number[][]; hand_r?: number[][] }): Frame {
  const pose = ema(s.pose, f.pose, 0.6); s.pose = pose;
  if (present(f.hand_l)) s.hl = ema(s.hl, f.hand_l!, 0.6);   // smooth while visible; hold last when it drops out
  if (present(f.hand_r)) s.hr = ema(s.hr, f.hand_r!, 0.6);
  return { pose, hand_l: s.hl || f.hand_l || [], hand_r: s.hr || f.hand_r || [] };
}

export default function LiveCapture() {
  const [gloss, setGloss] = useState("");
  const [phase, setPhase] = useState<Phase>("name");
  const [clip, setClip] = useState<MeshClip | null>(null);         // preview of the finished (retargeted) sign
  const [mirror, setMirror] = useState<MeshClip[]>([]);            // live full-body+hands mirror queue
  const [err, setErr] = useState("");
  const [take, setTake] = useState(0);                            // bump to remount the camera on "record again"
  const bufRef = useRef<Frame[]>([]);
  const smoothRef = useRef<Smooth>({ pose: null, hl: null, hr: null });
  const paramsRef = useRef<number[][] | null>(null);             // retargeted (T,182) to store on commit
  const word = gloss.trim().toUpperCase();
  const wordRef = useRef(word); wordRef.current = word;

  const streamFrame = useCallback((f: Frame) => {
    bufRef.current.push(processOne(smoothRef.current, f));       // feed the live mirror window
  }, []);

  // live mirror: every ~160ms retarget the buffered window (body + hands) on the server and enqueue the clip
  useEffect(() => {
    if (phase !== "capture") { bufRef.current = []; return; }
    smoothRef.current = { pose: null, hl: null, hr: null };      // fresh continuity each capture
    let alive = true;
    const iv = setInterval(async () => {
      const w = bufRef.current.splice(0, bufRef.current.length);
      if (w.length < 3) return;
      try {
        const m = await fetch(`${API}/v1/vocab/mirror`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pose: w.map((f) => f.pose), hand_l: w.map((f) => f.hand_l), hand_r: w.map((f) => f.hand_r) }),
        }).then((r) => r.json());
        if (alive && m?.token) setMirror((q) => [...q.slice(-2), {
          vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`,
          frames: m.frames, nverts: m.nverts, fps: m.fps }]);
      } catch { /* drop this window */ }
    }, 160);   // round-trip is ~80ms, so a tight window keeps the mirror ~0.24s behind — feels live
    return () => { alive = false; clearInterval(iv); };
  }, [phase]);

  const advanceMirror = useCallback((url: string) => setMirror((q) => (q.length && q[0].vertsUrl === url ? q.slice(1) : q)), []);

  // finished performing -> retarget the WHOLE captured motion (trimmed to the signing window) and replay it
  const finalize = useCallback(async (m: Motion) => {
    setPhase("fitting"); setErr("");
    try {
      const r = await fetch(`${API}/v1/vocab/mirror`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pose: m.pose, hand_l: m.hand_l, hand_r: m.hand_r, trim: true }),
      }).then((res) => res.json());
      if (!r?.token || !r?.params) throw new Error("couldn't read the motion — step back so your hands are in frame and try again");
      paramsRef.current = r.params;
      setClip({ vertsUrl: `${API}/v1/smplx/mesh/${r.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${r.token}/faces`, frames: r.frames, nverts: r.nverts, fps: r.fps });
      setPhase("preview");
    } catch (e: any) { setErr(e?.message || String(e)); setPhase("error"); }
  }, []);

  const commit = useCallback(async () => {
    if (!paramsRef.current) return;
    setPhase("committing");
    try {
      const res = await fetch(`${API}/v1/vocab/commit-params`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gloss: word, params: paramsRef.current }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.detail || `add failed (${res.status})`); }
      setPhase("done");
    } catch (e: any) { setErr(e?.message || String(e)); setPhase("error"); }
  }, [word]);

  const redo = useCallback(() => { setClip(null); setMirror([]); setErr(""); paramsRef.current = null; setTake((t) => t + 1); setPhase("capture"); }, []);
  const another = useCallback(() => { setGloss(""); setClip(null); setMirror([]); setErr(""); paramsRef.current = null; setTake((t) => t + 1); setPhase("name"); }, []);
  const previewQ = useMemo(() => (clip ? [clip] : []), [clip]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--panel-2,#F8F2E4)", padding: "22px 20px 44px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <a href="/vocab" className="g-pill g-soft" style={{ textDecoration: "none" }}><FontAwesomeIcon icon={faArrowLeft} /> Vocab Studio</a>
          <div>
            <div className="display" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1 }}>Live capture</div>
            <div style={{ fontSize: 12.5, color: "var(--muted,#9C9179)" }}>you move · the interpreter follows · you add the sign</div>
          </div>
          <span style={{ marginLeft: "auto" }}><AuthButton /></span>
        </header>

        {phase === "name" && (
          <section className="g-card" style={{ padding: 24, textAlign: "center" }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} style={{ fontSize: 26, color: "var(--coral)", opacity: .8 }} />
            <h2 className="display" style={{ fontSize: 22, margin: "12px 0 4px" }}>What sign are you recording?</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 460, margin: "0 auto 16px" }}>
              Type the word first — we label the capture with it, so you always know which sign was just added.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <input className="g-input" value={gloss} onChange={(e) => setGloss(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && word && setPhase("capture")}
                placeholder="e.g. cameroon" style={{ padding: ".6rem .9rem", fontSize: 15, minWidth: 240 }} autoFocus />
              <button className="g-pill g-coral" disabled={!word} onClick={() => setPhase("capture")}>
                <FontAwesomeIcon icon={faVideo} /> Start recording
              </button>
            </div>
          </section>
        )}

        {phase === "capture" && (
          <section className="g-card g-split" style={{ padding: 16 }}>
            <div>
              <div className="g-label" style={{ marginBottom: 8 }}>Perform “{word.toLowerCase()}”</div>
              <SignEvaluator api={API} gloss={word} mode="capture" onFrame={streamFrame} onCaptured={finalize} key={`${word}-${take}`} />
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                Stand back so your head, shoulders and both hands are in frame. The move to lower your hands at the end
                is trimmed automatically.
              </p>
            </div>
            <div>
              <div className="g-label" style={{ marginBottom: 8 }}>The interpreter follows you</div>
              <div style={{ position: "relative", aspectRatio: "3 / 4", borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
                <MeshSigner queue={mirror} loop={false} onFinished={advanceMirror} hint={false} />
                {mirror.length === 0 && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#5b6b8c", fontSize: 13, textAlign: "center", padding: 20, pointerEvents: "none" }}>
                    Move — the avatar mirrors your body and hands here in real time.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {(phase === "fitting" || phase === "committing") && (
          <section className="g-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28, color: "var(--coral)" }} />
            <p style={{ marginTop: 14, fontSize: 15 }}>{phase === "fitting" ? "Reading your sign…" : `Adding “${word.toLowerCase()}” to the dictionary…`}</p>
          </section>
        )}

        {phase === "preview" && clip && (
          <section className="g-card" style={{ padding: 16 }}>
            <div className="g-label" style={{ marginBottom: 8 }}>This is “{word.toLowerCase()}” as you performed it</div>
            <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
              <MeshSigner queue={previewQ} loop rate={0.85} hint={false} />
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "12px 0", textAlign: "center" }}>
              If it looks right, add it — otherwise record it again.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="g-pill g-coral" onClick={commit}><FontAwesomeIcon icon={faPlus} /> Add “{word.toLowerCase()}” to dictionary</button>
              <button className="g-pill g-soft" onClick={redo}><FontAwesomeIcon icon={faRotateLeft} /> Record again</button>
            </div>
          </section>
        )}

        {phase === "done" && (
          <section className="g-card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(31,157,105,.12)", display: "grid", placeItems: "center", margin: "0 auto" }}>
              <FontAwesomeIcon icon={faCheck} style={{ fontSize: 26, color: "var(--emerald,#1f9d69)" }} />
            </div>
            <h2 className="display" style={{ fontSize: 22, margin: "14px 0 4px" }}>“{word.toLowerCase()}” added ✓</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 440, margin: "0 auto 18px" }}>
              The interpreter can perform it now, and it joins the graded/challenge vocabulary.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="g-pill g-coral" onClick={another}><FontAwesomeIcon icon={faVideo} /> Record another sign</button>
              <a className="g-pill g-soft" href="/evaluate" style={{ textDecoration: "none" }}>Grade it on camera →</a>
            </div>
          </section>
        )}

        {phase === "error" && (
          <section className="g-card" style={{ padding: 30, textAlign: "center" }}>
            <p style={{ color: "var(--coral)", fontSize: 14 }}>{err || "Something went wrong."}</p>
            <button className="g-pill g-soft" style={{ marginTop: 12 }} onClick={redo}><FontAwesomeIcon icon={faRotateLeft} /> Try again</button>
          </section>
        )}
      </div>
    </main>
  );
}
