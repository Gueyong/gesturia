"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "./SignEvaluator.css";

/**
 * SignEvaluator — webcam judge with a LIVE COACH and a visible skeleton.
 * MediaPipe tracks BODY (pose) + HANDS; the body is essential because "is the hand raised?" is judged
 * relative to the shoulders/torso. We draw the tracked skeleton over the video so framing is obvious,
 * and refuse to grade frames where the upper body isn't visible (coaching "step back" instead). Over a
 * timed window it coaches live (raise/lower/turn palm/on-track), counts corrections, then grades the
 * attempt with the correction count lowering the mark (mastery) and Qwen writing a short bilingual review.
 */

export type EvalResult = {
  overall: number; mark?: number; technique?: number; mastery?: number; corrections?: number;
  scores: Record<string, number>; distances: Record<string, number>; feedback: string[]; gloss: string;
};

const PARAM_LABEL: Record<string, string> = {
  handshape: "Handshape", location: "Location", movement: "Movement", orientation: "Palm orientation",
};
const WINDOW_MS = 12000;
const LOC_THRESH = 0.33;
const ORI_THRESH = 1.0;

// draw sets — upper-body pose skeleton + full hand skeleton
const POSE_CONN = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];
const POSE_PTS = [0, 11, 12, 13, 14, 15, 16, 23, 24];
const HAND_CONN = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11],
  [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

type Phase = "loading" | "denied" | "ready" | "count" | "recording" | "scoring" | "result" | "error";

// ── vector helpers (mirror evaluator/features.py body-normal frame) ──
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: number[]) => Math.hypot(a[0], a[1], a[2]) || 1e-8;
const unit = (a: number[]) => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };

function bodyFrame(pose: number[][]) {
  const head = pose[0], sl = pose[11], sr = pose[12];
  const origin = [(sl[0] + sr[0]) / 2, (sl[1] + sr[1]) / 2, (sl[2] + sr[2]) / 2];
  const scale = norm(sub(sl, sr));
  const x = unit(sub(sl, sr));
  let up = unit(sub(head, origin));
  up = unit(sub(up, x.map((c) => c * dot(up, x))));
  const z = unit(cross(x, up));
  return { x, up, z, origin, scale };
}
const toLocal = (p: number[], f: any) => { const d = sub(p, f.origin); return [dot(d, f.x) / f.scale, dot(d, f.up) / f.scale, dot(d, f.z) / f.scale]; };
const toLocalDir = (d: number[], f: any) => unit([dot(d, f.x), dot(d, f.up), dot(d, f.z)]);

export default function SignEvaluator({ api, gloss, language = "en", onScored }:
  { api: string; gloss: string; language?: string; onScored?: (r: EvalResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef<any>(null);
  const poseRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const sessRef = useRef<any>(null);
  const finishedRef = useRef<any>(null);   // the loop stashes the finished session here for record()
  const refTrack = useRef<{ location: number[][]; orientation: number[][] } | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [err, setErr] = useState("");
  const [result, setResult] = useState<EvalResult | null>(null);
  const [review, setReview] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [hint, setHint] = useState<{ msg: string; ok: boolean }>({ msg: "", ok: false });
  const [bodySeen, setBodySeen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // ── draw the tracked skeleton so the user can SEE body + hands are tracked ──
  const draw = (pr: any, hr: any) => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
    const P = pr?.landmarks?.[0];
    if (P) {
      ctx.strokeStyle = "rgba(244,184,31,.92)"; ctx.lineWidth = 3;
      for (const [a, b] of POSE_CONN) if (P[a] && P[b]) { ctx.beginPath(); ctx.moveTo(P[a].x * W, P[a].y * H); ctx.lineTo(P[b].x * W, P[b].y * H); ctx.stroke(); }
      ctx.fillStyle = "#F4B81F";
      for (const i of POSE_PTS) if (P[i]) { ctx.beginPath(); ctx.arc(P[i].x * W, P[i].y * H, 4, 0, 6.29); ctx.fill(); }
    }
    ctx.strokeStyle = "rgba(232,85,58,.92)"; ctx.lineWidth = 2.5; ctx.fillStyle = "#E8553A";
    for (const hand of (hr?.landmarks || [])) {
      for (const [a, b] of HAND_CONN) { ctx.beginPath(); ctx.moveTo(hand[a].x * W, hand[a].y * H); ctx.lineTo(hand[b].x * W, hand[b].y * H); ctx.stroke(); }
      for (const p of hand) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 3, 0, 6.29); ctx.fill(); }
    }
  };

  const bodyVisible = (pr: any) => {
    const P = pr?.landmarks?.[0]; if (!P) return false;
    const vis = (i: number) => (P[i]?.visibility ?? 0);
    return vis(11) > 0.5 && vis(12) > 0.5 && vis(0) > 0.4;   // both shoulders + head
  };

  const readFrame = (pr: any, hr: any) => {
    const pw = pr?.worldLandmarks?.[0]; const pImg = pr?.landmarks?.[0];
    if (!pw || !pImg) return null;
    const pose = pw.map((p: any) => [p.x, p.y, p.z]);
    const zeros = () => Array.from({ length: 21 }, () => [0, 0, 0]);
    const hl = zeros(), hr2 = zeros();
    const hands = hr?.worldLandmarks || []; const handsImg = hr?.landmarks || [];
    for (let i = 0; i < hands.length; i++) {
      const wImg = handsImg[i]?.[0]; if (!wImg) continue;
      const dL = Math.hypot(wImg.x - pImg[15].x, wImg.y - pImg[15].y);
      const dR = Math.hypot(wImg.x - pImg[16].x, wImg.y - pImg[16].y);
      const pts = hands[i].map((p: any) => [p.x, p.y, p.z]);
      if (dL <= dR) hl.splice(0, 21, ...pts); else hr2.splice(0, 21, ...pts);
    }
    return { pose, hl, hr2 };
  };

  const localPose = (pose: number[][], hl: number[][], hr: number[][]) => {
    const f = bodyFrame(pose);
    const wri = [toLocal(pose[15], f), toLocal(pose[16], f)];
    const palm: (number[] | null)[] = [null, null];
    [hl, hr].forEach((h, hi) => {
      if (!h[5] || (!h[5][0] && !h[5][1] && !h[5][2])) return;
      const rel = (j: number) => sub(h[j], h[0]);
      palm[hi] = unit(cross(toLocalDir(rel(5), f), toLocalDir(rel(17), f)));
    });
    return { wri, palm };
  };

  const coachHint = (wri: number[][], palm: (number[] | null)[]) => {
    const ref = refTrack.current; if (!ref) return null;
    let bi = 0, bd = 1e9;
    for (let f = 0; f < ref.location.length; f++) {
      const rl = ref.location[f];
      const dd = norm(sub(wri[0], rl.slice(0, 3))) + norm(sub(wri[1], rl.slice(3, 6)));
      if (dd < bd) { bd = dd; bi = f; }
    }
    const rl = ref.location[bi], ro = ref.orientation[bi];
    const refWri = [rl.slice(0, 3), rl.slice(3, 6)]; const hands = ["left", "right"];
    let best = 0, msg: string | null = null;
    for (let h = 0; h < 2; h++) {
      const d = sub(refWri[h], wri[h]); const mag = norm(d);
      if (mag > LOC_THRESH && mag > best) {
        best = mag; const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
        if (ay >= ax && ay >= az) msg = d[1] > 0 ? `Raise your ${hands[h]} hand` : `Lower your ${hands[h]} hand`;
        else if (az >= ax) msg = d[2] > 0 ? `Reach your ${hands[h]} hand forward` : `Pull your ${hands[h]} hand back`;
        else msg = d[0] > 0 ? `Move your ${hands[h]} hand to your left` : `Move your ${hands[h]} hand to your right`;
      }
    }
    if (!msg) for (let h = 0; h < 2; h++) {
      const pu = palm[h]; if (!pu) continue;
      const pr = ro.slice(h * 3, h * 3 + 3);
      if (Math.acos(Math.max(-1, Math.min(1, dot(unit(pu), unit(pr))))) > ORI_THRESH) { msg = `Turn your ${hands[h]} palm`; break; }
    }
    return msg;
  };

  // ── persistent detect + draw loop (runs whenever the camera is live) ──
  const startLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    let lastMsg = "", lastSec = -1, lastBody = false;
    const loop = () => {
      if (!runningRef.current) return;
      const v = videoRef.current, P = poseRef.current, H = handRef.current;
      if (v && v.readyState >= 2 && P && H) {
        const ts = Math.round(performance.now());
        let pr: any, hr: any;
        try { pr = P.detectForVideo(v, ts); hr = H.detectForVideo(v, ts); } catch { /* skip */ }
        draw(pr, hr);
        const bodyOK = bodyVisible(pr);
        if (bodyOK !== lastBody) { lastBody = bodyOK; setBodySeen(bodyOK); }
        const s = sessRef.current;
        if (s) {
          const now = performance.now();
          if (!bodyOK) {
            s.badRun++;
            if (lastMsg !== "frame") { lastMsg = "frame"; setHint({ msg: "Step back — I need to see your head & shoulders", ok: false }); }
          } else {
            const fr = readFrame(pr, hr);
            if (fr) {
              s.poseSeq.push(fr.pose); s.hlSeq.push(fr.hl); s.hrSeq.push(fr.hr2);
              const { wri, palm } = localPose(fr.pose, fr.hl, fr.hr2);
              const msg = coachHint(wri, palm);
              s.total++;
              if (msg) { s.offRun++; s.onRun = 0; s.offFrames++; if (s.offRun === 6 && !s.counted) { s.corrections++; s.counted = true; } }
              else { s.onRun++; s.offRun = 0; if (s.onRun >= 5) s.counted = false; }
              const key = msg || "ok";
              if (key !== lastMsg) { lastMsg = key; setHint({ msg: msg || "On track — hold it", ok: !msg }); }
            }
          }
          const sec = Math.max(0, Math.ceil((WINDOW_MS - (now - s.start)) / 1000));
          if (sec !== lastSec) { lastSec = sec; setTimeLeft(sec); }
          if (now - s.start >= WINDOW_MS) { finishedRef.current = s; const r = s.resolve; sessRef.current = null; lastMsg = ""; r(); }
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fs = await vision.FilesetResolver.forVisionTasks(`${location.origin}/mediapipe/wasm`);
        const mk = async (delegate: "GPU" | "CPU") => ({
          hand: await vision.HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate }, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.4, minTrackingConfidence: 0.4 }),
          pose: await vision.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3, minTrackingConfidence: 0.3 }),
        });
        let m; try { m = await mk("GPU"); } catch { m = await mk("CPU"); }
        if (!alive) return;
        handRef.current = m.hand; poseRef.current = m.pose;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current!; v.srcObject = stream; await v.play().catch(() => {});
        setPhase("ready"); startLoop();
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === "NotAllowedError") setPhase("denied");
        else { setErr(e?.message || String(e)); setPhase("error"); }
      }
    })();
    return () => { alive = false; runningRef.current = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach((t) => t.stop()); try { handRef.current?.close?.(); poseRef.current?.close?.(); } catch {} };
  }, [startLoop]);

  useEffect(() => {
    refTrack.current = null;
    fetch(`${api}/v1/eval/reference/${encodeURIComponent(gloss)}`).then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j) refTrack.current = { location: j.location, orientation: j.orientation }; }).catch(() => {});
  }, [api, gloss]);

  const record = useCallback(async () => {
    if (!poseRef.current || !handRef.current) return;
    setResult(null); setReview("");
    for (let c = 3; c >= 1; c--) { setCountdown(c); setPhase("count"); await new Promise((r) => setTimeout(r, 700)); }
    setCountdown(0); setPhase("recording");
    await new Promise<void>((resolve) => {
      sessRef.current = { poseSeq: [], hlSeq: [], hrSeq: [], total: 0, offFrames: 0, offRun: 0, onRun: 0, counted: false, corrections: 0, badRun: 0, start: performance.now(), resolve };
    });
    const data = finishedRef.current; finishedRef.current = null;
    if (!data || data.poseSeq.length < 8) { setErr("I couldn't see your upper body — step back so your head, shoulders and hands are all in frame."); setPhase("error"); return; }
    setPhase("scoring");
    const off_track = data.total ? data.offFrames / data.total : 1;
    try {
      const r = await fetch(`${api}/v1/eval/score`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gloss, pose: data.poseSeq, hand_l: data.hlSeq, hand_r: data.hrSeq, corrections: data.corrections, off_track }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.detail || `score failed (${r.status})`); }
      const res: EvalResult = await r.json();
      setResult(res); setPhase("result"); onScored?.(res);
      fetch(`${api}/v1/eval/review`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gloss, scores: res.scores, corrections: data.corrections, language }) })
        .then((x) => x.json()).then((j) => setReview(j.review || "")).catch(() => {});
    } catch (e: any) { setErr(e?.message || String(e)); setPhase("error"); }
  }, [api, gloss, language, onScored]);

  const band = (s: number) => (s >= 85 ? "var(--emerald,#1f9d69)" : s >= 65 ? "var(--gold)" : "var(--coral)");
  const mark = result ? Math.round(result.mark ?? result.overall) : 0;

  return (
    <div className="signeval">
      <div className="signeval-stage">
        <video ref={videoRef} playsInline muted className="signeval-video" style={{ transform: "scaleX(-1)" }} />
        <canvas ref={canvasRef} width={640} height={480} className="signeval-skel" style={{ transform: "scaleX(-1)" }} />
        {(phase === "ready" || phase === "count") && (
          <div className={`signeval-frameflag ${bodySeen ? "ok" : ""}`}>
            {bodySeen ? "✓ body tracked" : "step back — show head & shoulders"}
          </div>
        )}
        {countdown > 0 && <div className="signeval-count">{countdown}</div>}
        {phase === "recording" && (
          <>
            <div className="signeval-rec"><span className="dot" /> {timeLeft}s</div>
            <div className={`signeval-hint ${hint.ok ? "ok" : ""}`}>{hint.msg}</div>
          </>
        )}
        {phase === "loading" && <div className="signeval-overlay">Loading the vision model…</div>}
        {phase === "scoring" && <div className="signeval-overlay">Grading your sign…</div>}
        {phase === "denied" && <div className="signeval-overlay">Camera blocked — allow access and reload.</div>}
        {phase === "error" && <div className="signeval-overlay signeval-err">{err}</div>}

        {result && (
          <div className="signeval-scorecard">
            <div className="signeval-overall" style={{ borderColor: band(mark) }}>
              <b style={{ color: band(mark) }}>{mark}</b><span>/ 100</span>
            </div>
            <div className="signeval-meta">
              <span>technique {Math.round(result.technique ?? result.overall)}</span><span>·</span>
              <span>{result.corrections ? `${result.corrections} correction${result.corrections > 1 ? "s" : ""}` : "clean — no corrections"}</span>
            </div>
            <div className="signeval-bars">
              {["handshape", "location", "movement", "orientation"].map((k) => (
                <div key={k} className="signeval-bar">
                  <label>{PARAM_LABEL[k]}</label>
                  <div className="track"><i style={{ width: `${result.scores[k]}%`, background: band(result.scores[k]) }} /></div>
                  <b>{Math.round(result.scores[k])}</b>
                </div>
              ))}
            </div>
            <div className="signeval-review">{review || (result.feedback?.[0] ?? "")}</div>
          </div>
        )}
      </div>

      <div className="signeval-controls">
        <button className="g-pill g-coral" onClick={record}
          disabled={!(phase === "ready" || phase === "result" || phase === "error")}>
          {phase === "recording" ? "Signing…" : phase === "scoring" ? "Grading…"
            : result ? "Try again" : `Sign “${gloss}” — start (${WINDOW_MS / 1000}s)`}
        </button>
      </div>
    </div>
  );
}
