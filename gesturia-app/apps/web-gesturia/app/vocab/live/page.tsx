"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faSpinner, faCheck, faRotateLeft, faArrowLeft, faPlus, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../../components/MeshSigner";
import SignEvaluator, { type CapturedMotion } from "../../../components/SignEvaluator";
import AuthButton from "../../../components/AuthButton";

/** VOCAB STUDIO · Live capture — you perform a sign to the camera, MediaPipe reads your body + hands, our
 *  fitter maps it onto the avatar (industry-standard optimization), you SEE it on the model, and if it's
 *  right you add it to the dictionary under its word. No gloves, no suit — the model does the capture. */

const API = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

type Phase = "name" | "capture" | "fitting" | "preview" | "committing" | "done" | "error";

export default function LiveCapture() {
  const [gloss, setGloss] = useState("");
  const [phase, setPhase] = useState<Phase>("name");
  const [jobId, setJobId] = useState<string | null>(null);
  const [clip, setClip] = useState<MeshClip | null>(null);
  const [err, setErr] = useState("");
  const pollRef = useRef<any>(null);

  const word = gloss.trim().toUpperCase();

  const startPreview = useCallback(async (id: string) => {
    try {
      const m = await fetch(`${API}/v1/vocab/motion/${id}/preview`).then((r) => r.json());
      if (!m?.token) throw new Error("preview render failed");
      setClip({ vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`,
        frames: m.frames, nverts: m.nverts, fps: m.fps });
      setPhase("preview");
    } catch (e: any) { setErr(e?.message || String(e)); setPhase("error"); }
  }, []);

  const onCaptured = useCallback(async (motion: CapturedMotion) => {
    setErr(""); setPhase("fitting");
    try {
      const r = await fetch(`${API}/v1/vocab/enroll-motion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gloss: word, pose: motion.pose, hand_l: motion.hand_l, hand_r: motion.hand_r }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.detail || `fit failed (${r.status})`); }
      const { job_id } = await r.json();
      setJobId(job_id);
      pollRef.current = setInterval(async () => {
        const j = await fetch(`${API}/v1/vocab/motion/${job_id}`).then((x) => x.json()).catch(() => null);
        if (!j) return;
        if (j.status === "done") { clearInterval(pollRef.current); startPreview(job_id); }
        else if (j.status === "error") { clearInterval(pollRef.current); setErr(j.error || "fit failed"); setPhase("error"); }
      }, 1500);
    } catch (e: any) { setErr(e?.message || String(e)); setPhase("error"); }
  }, [word, startPreview]);

  const commit = useCallback(async () => {
    if (!jobId) return;
    setPhase("committing");
    try {
      const r = await fetch(`${API}/v1/vocab/commit-motion`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: jobId, gloss: word }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.detail || `add failed (${r.status})`); }
      setPhase("done");
    } catch (e: any) { setErr(e?.message || String(e)); setPhase("error"); }
  }, [jobId, word]);

  const redo = useCallback(() => { setClip(null); setJobId(null); setErr(""); setPhase("capture"); }, []);
  const another = useCallback(() => { setGloss(""); setClip(null); setJobId(null); setErr(""); setPhase("name"); }, []);
  const queue = useMemo(() => (clip ? [clip] : []), [clip]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--panel-2,#F8F2E4)", padding: "22px 20px 44px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <a href="/vocab" className="g-pill g-soft" style={{ textDecoration: "none" }}><FontAwesomeIcon icon={faArrowLeft} /> Vocab Studio</a>
          <div>
            <div className="display" style={{ fontSize: 19, fontWeight: 800, lineHeight: 1 }}>Live capture</div>
            <div style={{ fontSize: 12.5, color: "var(--muted,#9C9179)" }}>you move · the model learns · you add the sign</div>
          </div>
          <span style={{ marginLeft: "auto" }}><AuthButton /></span>
        </header>

        {/* step 1 — name the sign (so we know what was added) */}
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

        {/* step 2 — perform it to the camera */}
        {phase === "capture" && (
          <section className="g-card" style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div className="g-label" style={{ marginBottom: 8 }}>Perform this sign</div>
              <div style={{ aspectRatio: "4 / 3", borderRadius: 16, border: "1px dashed var(--line,#E8DFC9)", display: "grid", placeItems: "center", textAlign: "center", padding: 20, background: "var(--panel-2,#F8F2E4)" }}>
                <div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8, letterSpacing: ".04em" }}>RECORDING</div>
                  <div className="display" style={{ fontSize: 38, fontWeight: 800 }}>{word.toLowerCase()}</div>
                  <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted)", maxWidth: 270 }}>
                    Stand back so your head, shoulders and both hands are in frame. Perform the sign clearly — MediaPipe
                    reads your body and hands, and we map the motion onto the avatar.
                  </p>
                </div>
              </div>
            </div>
            <div>
              <div className="g-label" style={{ marginBottom: 8 }}>Your camera</div>
              <SignEvaluator api={API} gloss={word} mode="capture" onCaptured={onCaptured} key={word} />
            </div>
          </section>
        )}

        {/* step 3 — fitting */}
        {(phase === "fitting" || phase === "committing") && (
          <section className="g-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28, color: "var(--coral)" }} />
            <p style={{ marginTop: 14, fontSize: 15 }}>{phase === "fitting" ? `Mapping your motion onto the avatar…` : `Adding “${word.toLowerCase()}” to the dictionary…`}</p>
            <p style={{ fontSize: 12.5, marginTop: 4 }}>{phase === "fitting" ? "fitting SMPL-X to your captured pose + hands (a few seconds)" : ""}</p>
          </section>
        )}

        {/* step 4 — preview on the model, then add */}
        {phase === "preview" && clip && (
          <section className="g-card" style={{ padding: 16 }}>
            <div className="g-label" style={{ marginBottom: 8 }}>This is “{word.toLowerCase()}” as you performed it</div>
            <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
              <MeshSigner queue={queue} loop rate={0.85} hint={false} />
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "12px 0", textAlign: "center" }}>
              Watch the avatar repeat your sign. If it looks right, add it — otherwise record it again.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="g-pill g-coral" onClick={commit}><FontAwesomeIcon icon={faPlus} /> Add “{word.toLowerCase()}” to dictionary</button>
              <button className="g-pill g-soft" onClick={redo}><FontAwesomeIcon icon={faRotateLeft} /> Record again</button>
            </div>
          </section>
        )}

        {/* step 5 — done */}
        {phase === "done" && (
          <section className="g-card" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(31,157,105,.12)", display: "grid", placeItems: "center", margin: "0 auto" }}>
              <FontAwesomeIcon icon={faCheck} style={{ fontSize: 26, color: "var(--emerald,#1f9d69)" }} />
            </div>
            <h2 className="display" style={{ fontSize: 22, margin: "14px 0 4px" }}>“{word.toLowerCase()}” added ✓</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", maxWidth: 440, margin: "0 auto 18px" }}>
              The interpreter can perform it now, and it joins the graded/challenge vocabulary. Every capture from a
              deaf signer makes Gesturia richer.
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
