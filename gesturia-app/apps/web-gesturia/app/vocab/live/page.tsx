"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faSpinner, faCheck, faRotateLeft, faArrowLeft, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../../components/MeshSigner";
import SignEvaluator, { type CapturedMotion, type FaceFrame, type LiveFrame } from "../../../components/SignEvaluator";
import ClipStudio from "../../../components/ClipStudio";
import AuthButton from "../../../components/AuthButton";

/** VOCAB STUDIO · Live capture — perform a sign and OUR interpreter mirrors your body, hands, fingers AND
 *  FACE in real time. When you stop, the capture becomes an editable clip (scrub, trim, review) and you add
 *  it two ways: instantly (the retargeted motion you just saw), or in studio quality — the recorded video is
 *  re-lifted with the WiLoR hand model (the dictionary pipeline) and your live face is merged in. */

const API = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

type Phase = "name" | "capture" | "fitting" | "edit" | "committing" | "done" | "error";
type Smooth = { pose: number[][] | null; hl: number[][] | null; hr: number[][] | null; face: FaceFrame };

const present = (h?: number[][]) => Array.isArray(h) && h.some((p) => p && (p[0] || p[1] || p[2]));
const ema = (prev: number[][] | null, cur: number[][], a: number) =>
  prev && prev.length === cur.length ? cur.map((p, i) => p.map((c, j) => prev[i][j] * (1 - a) + c * a)) : cur;

/** hold + light EMA: a missing hand/face keeps its last state (stays quiet); everything is smoothed. */
function processOne(s: Smooth, f: LiveFrame) {
  const pose = ema(s.pose, f.pose, 0.6); s.pose = pose;
  if (present(f.hand_l)) s.hl = ema(s.hl, f.hand_l, 0.6);
  if (present(f.hand_r)) s.hr = ema(s.hr, f.hand_r, 0.6);
  if (f.face) {
    const prev = s.face;
    if (prev) {
      const blend: Record<string, number> = {};
      for (const k of Object.keys(f.face.blend)) blend[k] = (prev.blend[k] ?? f.face.blend[k]) * 0.5 + f.face.blend[k] * 0.5;
      s.face = { blend, head: f.face.head || prev.head };
    } else s.face = f.face;
  }
  return { pose, hand_l: s.hl || f.hand_l || [], hand_r: s.hr || f.hand_r || [], face: s.face, ts: f.ts };
}

export default function LiveCapture() {
  const [gloss, setGloss] = useState("");
  const [phase, setPhase] = useState<Phase>("name");
  const [mirror, setMirror] = useState<MeshClip[]>([]);            // live mirror queue
  const [clip, setClip] = useState<MeshClip | null>(null);         // editable clip meta
  const [span, setSpan] = useState<[number, number]>([0, 1]);
  const [busy, setBusy] = useState<string | null>(null);           // "quick" | "studio" while committing
  const [studioState, setStudioState] = useState("");
  const [err, setErr] = useState("");
  const [take, setTake] = useState(0);
  const bufRef = useRef<ReturnType<typeof processOne>[]>([]);
  const smoothRef = useRef<Smooth>({ pose: null, hl: null, hr: null, face: null });
  const paramsRef = useRef<number[][] | null>(null);               // full (T,182) of the editable clip
  const capMetaRef = useRef<{ ts0: number; c0: number } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);               // raw webcam, for the studio lift
  const chunksRef = useRef<Blob[]>([]);
  const vidTimesRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const word = gloss.trim().toUpperCase();
  const wordRef = useRef(word); wordRef.current = word;

  const streamFrame = useCallback((f: LiveFrame) => {
    bufRef.current.push(processOne(smoothRef.current, f));
  }, []);

  // record the raw webcam alongside — it feeds the optional studio-quality (WiLoR) lift
  const onStream = useCallback((stream: MediaStream) => {
    try {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      recRef.current = rec;
      rec.start(250);
      vidTimesRef.current.start = performance.now();
    } catch { recRef.current = null; }
  }, []);

  // live mirror: every ~160ms retarget the buffered window (body + hands + face) and enqueue the clip
  useEffect(() => {
    if (phase !== "capture") { bufRef.current = []; return; }
    smoothRef.current = { pose: null, hl: null, hr: null, face: null };
    let alive = true;
    const iv = setInterval(async () => {
      const w = bufRef.current.splice(0, bufRef.current.length);
      if (w.length < 3) return;
      try {
        const m = await fetch(`${API}/v1/vocab/mirror`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pose: w.map((f) => f.pose), hand_l: w.map((f) => f.hand_l),
            hand_r: w.map((f) => f.hand_r), face: w.map((f) => f.face) }),
        }).then((r) => r.json());
        if (alive && m?.token) setMirror((q) => [...q.slice(-2), {
          vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`,
          frames: m.frames, nverts: m.nverts, fps: m.fps }]);
      } catch { /* drop this window */ }
    }, 160);
    return () => { alive = false; clearInterval(iv); };
  }, [phase]);

  const advanceMirror = useCallback((url: string) => setMirror((q) => (q.length && q[0].vertsUrl === url ? q.slice(1) : q)), []);

  // capture finished -> retarget the whole motion into an EDITABLE CLIP (trim/review before saving)
  const finalize = useCallback(async (m: CapturedMotion) => {
    setPhase("fitting"); setErr("");
    try { recRef.current?.stop(); vidTimesRef.current.end = performance.now(); } catch { /* optional */ }
    try {
      const r = await fetch(`${API}/v1/vocab/mirror`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pose: m.pose, hand_l: m.hand_l, hand_r: m.hand_r, face: m.face, ts: m.ts, trim: true }),
      }).then((res) => res.json());
      if (!r?.token || !r?.params) throw new Error("couldn't read the motion — step back so your hands are in frame and try again");
      paramsRef.current = r.params;
      capMetaRef.current = { ts0: m.ts[0] ?? 0, c0: r.c0 ?? 0 };
      setSpan(Array.isArray(r.span) && r.span.length === 2 ? [r.span[0], Math.max(r.span[0] + 1, r.span[1] - 1)] : [0, r.frames - 1]);
      setClip({ vertsUrl: `${API}/v1/smplx/mesh/${r.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${r.token}/faces`, frames: r.frames, nverts: r.nverts, fps: r.fps || 30 });
      setPhase("edit");
    } catch (e: any) { setErr(e?.message || String(e)); setPhase("error"); }
  }, []);

  // add the trimmed selection — instantly, or through the studio-quality WiLoR lift
  const onAdd = useCallback(async (range: [number, number], mode: "quick" | "studio") => {
    const P = paramsRef.current; if (!P) return;
    const [s, e] = range;
    const slice = P.slice(Math.max(0, s), Math.min(P.length, e + 1));
    if (slice.length < 4) { setErr("selection too short — keep at least 4 frames"); setPhase("error"); return; }
    setBusy(mode);
    try {
      if (mode === "quick") {
        const res = await fetch(`${API}/v1/vocab/commit-params`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gloss: wordRef.current, params: slice }),
        });
        if (!res.ok) { const x = await res.json().catch(() => ({})); throw new Error(x?.detail || `add failed (${res.status})`); }
        setPhase("done"); return;
      }
      // studio: send the recorded video through the WiLoR lifter, trimmed to the same window
      setStudioState("Preparing your video…");
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      if (blob.size < 2000) throw new Error("no video was recorded — use the instant add");
      const b64: string = await new Promise((res, rej) => {
        const rd = new FileReader(); rd.onerror = () => rej(new Error("read failed")); rd.onloadend = () => res(String(rd.result)); rd.readAsDataURL(blob);
      });
      const { ts0, c0 } = capMetaRef.current || { ts0: 0, c0: 0 };
      const { start, end } = vidTimesRef.current;
      const dur = Math.max(1, end - start);
      const tAbs = (f: number) => ts0 + (c0 + f) * (1000 / 30);
      const frac = (t: number) => Math.max(0, Math.min(1, (t - start) / dur));
      setStudioState("Lifting with the WiLoR hand model — about a minute…");
      const { job_id } = await fetch(`${API}/v1/vocab/lift-video`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gloss: wordRef.current, video_b64: b64, trim_start: frac(tAbs(s)), trim_end: frac(tAbs(e + 1)) }),
      }).then((r) => r.json());
      if (!job_id) throw new Error("the studio lift did not start");
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const j = await fetch(`${API}/v1/vocab/lift-video/${job_id}`).then((r) => r.json()).catch(() => null);
        if (!j) continue;
        if (j.status === "loading-model") setStudioState("Warming the hand model…");
        if (j.status === "lifting") setStudioState("Lifting your sign with real hands…");
        if (j.status === "done") {
          setStudioState("Merging your face and saving…");
          const res = await fetch(`${API}/v1/vocab/commit-lift`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id, gloss: wordRef.current, face_params: slice }),
          });
          if (!res.ok) { const x = await res.json().catch(() => ({})); throw new Error(x?.detail || `save failed (${res.status})`); }
          setPhase("done"); return;
        }
        if (j.status === "error") throw new Error(j.error || "the studio lift failed");
      }
      throw new Error("the studio lift timed out");
    } catch (e: any) { setErr(e?.message || String(e)); setPhase("error"); }
    finally { setBusy(null); setStudioState(""); }
  }, []);

  const redo = useCallback(() => {
    setClip(null); setMirror([]); setErr(""); setBusy(null); setStudioState("");
    paramsRef.current = null; chunksRef.current = [];
    setTake((t) => t + 1); setPhase("capture");
  }, []);
  const another = useCallback(() => { setGloss(""); setClip(null); setMirror([]); setErr(""); setBusy(null); paramsRef.current = null; chunksRef.current = []; setTake((t) => t + 1); setPhase("name"); }, []);

  return (
    <main style={{ minHeight: "100vh", background: "var(--panel-2,#F8F2E4)", padding: "22px 20px 44px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <a href="/vocab" className="g-pill g-soft" style={{ textDecoration: "none" }}><FontAwesomeIcon icon={faArrowLeft} /> Vocab Studio</a>
          <div>
            <div className="display" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1 }}>Live capture</div>
            <div style={{ fontSize: 12.5, color: "var(--muted,#9C9179)" }}>you move · the interpreter follows · you edit · you add the sign</div>
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
              <SignEvaluator api={API} gloss={word} mode="capture" onFrame={streamFrame} onCaptured={finalize} onStream={onStream} key={`${word}-${take}`} />
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                Face the camera with your head, shoulders and both hands in frame — expression and mouth
                movements are captured too. You'll trim the clip before it's saved.
              </p>
            </div>
            <div>
              <div className="g-label" style={{ marginBottom: 8 }}>The interpreter follows you</div>
              <div style={{ position: "relative", aspectRatio: "3 / 4", borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
                <MeshSigner queue={mirror} loop={false} onFinished={advanceMirror} hint={false} />
                {mirror.length === 0 && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#5b6b8c", fontSize: 13, textAlign: "center", padding: 20, pointerEvents: "none" }}>
                    Move — the avatar mirrors your body, hands and face here in real time.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {phase === "fitting" && (
          <section className="g-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28, color: "var(--coral)" }} />
            <p style={{ marginTop: 14, fontSize: 15 }}>Building your editable clip…</p>
          </section>
        )}

        {phase === "edit" && clip && (
          <section className="g-card" style={{ padding: 16 }}>
            <div className="g-label" style={{ marginBottom: 8 }}>“{word.toLowerCase()}” — review, trim, then add</div>
            <ClipStudio clip={clip} span={span} word={word} busy={busy}
              studioAvailable={chunksRef.current.length > 0} onAdd={onAdd} onRedo={redo} />
            {busy === "studio" && studioState && (
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
                <FontAwesomeIcon icon={faSpinner} spin /> {studioState}
              </p>
            )}
          </section>
        )}

        {phase === "committing" && (
          <section className="g-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28, color: "var(--coral)" }} />
            <p style={{ marginTop: 14, fontSize: 15 }}>Adding “{word.toLowerCase()}” to the dictionary…</p>
          </section>
        )}

        {phase === "done" && (
          <section className="g-card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(31,157,105,.12)", display: "grid", placeItems: "center", margin: "0 auto" }}>
              <FontAwesomeIcon icon={faCheck} style={{ fontSize: 26, color: "var(--emerald,#1f9d69)" }} />
            </div>
            <h2 className="display" style={{ fontSize: 22, margin: "14px 0 4px" }}>“{word.toLowerCase()}” added ✓</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 440, margin: "0 auto 18px" }}>
              The interpreter can perform it now — with your hands and your face — and it joins the
              graded/challenge vocabulary.
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
