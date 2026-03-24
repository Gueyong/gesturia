"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone, faStop, faKeyboard, faPaperPlane, faSpinner,
  faGear, faHandsAslInterpreting, faWaveSquare, faBolt, faCircleNodes,
  faUpRightFromSquare, faBroom, faExpand, faCompress, faTowerBroadcast, faShareNodes,
  faPause, faPlay, faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import { faYoutube } from "@fortawesome/free-brands-svg-icons";
import { useSpeech } from "../../components/useSpeech";
import MeshSigner, { type MeshClip } from "../../components/MeshSigner";

const AvatarPip = dynamic(() => import("../../components/AvatarPip"), { ssr: false });
// API reached on the same host that served this page — works on localhost AND from phones on the LAN
// "localhost" resolves to IPv6 ::1 first on Windows; the API binds IPv4, so every call wasted ~2s
// failing over. Force 127.0.0.1 on the same machine (LAN/phone hostnames pass through untouched).
const API = typeof window !== "undefined" ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

type Meta = { token: string; frames: number; nverts: number; fps: number; used: string[]; missing: string[]; glosses: string[] };
type Mode = "mic" | "text" | "stream";
type Chips = { used: string[]; missing: string[] };
type Phrase = { text: string; at: number };

/** The interpreter INSIDE the stage: fullscreen when he's the show; when a program plays he is a
 *  draggable, corner-resizable overlay — exactly like a broadcast interpreter box. */
function StageInterpreter({ queue, loop, onFinished, overlay, live, onPopOut, paused, rate, restartNonce }: {
  queue: MeshClip[]; loop: boolean; onFinished: (u: string) => void; overlay: boolean; live: boolean; onPopOut: () => void;
  paused?: boolean; rate?: number; restartNonce?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const rez = useRef<{ x0: number; w0: number } | null>(null);

  useEffect(() => {
    if (!overlay || box) return;
    const p = ref.current?.parentElement?.getBoundingClientRect();
    if (p) setBox({ x: p.width * 0.70, y: p.height * 0.34, w: p.width * 0.26 });
  }, [overlay, box]);

  const clamp = useCallback((x: number, y: number, w: number) => {
    const p = ref.current?.parentElement?.getBoundingClientRect();
    if (!p) return { x, y, w };
    const h = w * 4 / 3;
    return {
      x: Math.max(4, Math.min(x, p.width - w - 4)),
      y: Math.max(4, Math.min(y, p.height - h - 4)),
      w,
    };
  }, []);

  if (!overlay) {
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <MeshSigner queue={queue} loop={loop} onFinished={onFinished} paused={paused} rate={rate} restartNonce={restartNonce} />
        <button onClick={onPopOut} title="Pop the interpreter out"
          style={{ position: "absolute", top: 8, right: 8, zIndex: 3, ...stageBtn }}>
          <FontAwesomeIcon icon={faUpRightFromSquare} />
        </button>
      </div>
    );
  }
  if (!box) return <div ref={ref} style={{ position: "absolute", right: 12, bottom: 12, width: 1, height: 1 }} />;

  const H = box.w * 4 / 3;
  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-norel]")) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { dx: e.clientX - box.x, dy: e.clientY - box.y };
      }}
      onPointerMove={(e) => {
        // snapshot refs + coords BEFORE the deferred setBox updater runs (the ref can null out on
        // pointerup between the guard and the updater -> "reading 'dx' of null")
        const d = drag.current, r = rez.current, cx = e.clientX, cy = e.clientY;
        if (d) setBox((b) => b && clamp(cx - d.dx, cy - d.dy, b.w));
        else if (r) {
          const p = ref.current?.parentElement?.getBoundingClientRect();
          const maxW = (p?.width ?? 800) * 0.5;
          setBox((b) => b && clamp(b.x, b.y, Math.max(120, Math.min(maxW, r.w0 + (cx - r.x0)))));
        }
      }}
      onPointerUp={() => { drag.current = null; rez.current = null; }}
      style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: H, zIndex: 2,
        borderRadius: 14, overflow: "hidden", cursor: "grab", touchAction: "none",
        border: `2px solid ${live ? "var(--coral)" : "rgba(255,255,255,.55)"}`, boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}
    >
      <MeshSigner queue={queue} loop={loop} onFinished={onFinished} paused={paused} rate={rate} restartNonce={restartNonce} />
      <button data-norel onClick={onPopOut} title="Pop out of the stage"
        style={{ position: "absolute", top: 6, right: 6, zIndex: 3, ...stageBtn }}>
        <FontAwesomeIcon icon={faUpRightFromSquare} />
      </button>
      <div
        data-norel
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          rez.current = { x0: e.clientX, w0: box.w };
        }}
        onPointerMove={(e) => {
          const r = rez.current;
          if (!r) return;
          const cx = e.clientX;
          const p = ref.current?.parentElement?.getBoundingClientRect();
          const maxW = (p?.width ?? 800) * 0.5;
          setBox((b) => b && clamp(b.x, b.y, Math.max(120, Math.min(maxW, r.w0 + (cx - r.x0)))));
        }}
        onPointerUp={() => { rez.current = null; }}
        style={{ position: "absolute", right: 0, bottom: 0, width: 22, height: 22, cursor: "nwse-resize",
          display: "grid", placeItems: "center", color: "rgba(255,255,255,.7)", zIndex: 3, touchAction: "none" }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </div>
    </div>
  );
}

const stageBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
  background: "rgba(10,14,26,.55)", color: "#fff", fontSize: 12, display: "grid", placeItems: "center",
};

const MIC_LANGS: { code: string; short: string; label: string }[] = [
  { code: "auto", short: "🌐 Auto", label: "Auto-detect (any language, switches live)" },
  { code: "en-US", short: "EN", label: "English" },
  { code: "fr-FR", short: "FR", label: "Français" },
];

export default function Studio() {
  const [mode, setMode] = useState<Mode>("mic");
  const [micLang, setMicLang] = useState("en-US");   // browser mic recognizes ONE language at a time
  const [text, setText] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [ytId, setYtId] = useState<string | null>(null);
  const [pip, setPip] = useState<"stage" | "float">("stage");
  const [isFs, setIsFs] = useState(false);

  // realtime playback queue: clips play back-to-back with a crossfaded seam
  const [mclips, setMclips] = useState<MeshClip[]>([]);
  const [nowChips, setNowChips] = useState<Chips | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [capWords, setCapWords] = useState<string[]>([]);   // committed caption words (realtime)
  const [busyN, setBusyN] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [vocab, setVocab] = useState(0);
  const [signsCount, setSignsCount] = useState(0);
  const [samples, setSamples] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [lastWasText, setLastWasText] = useState(false);

  // live stream-in session (server-side audio -> transcript)
  const [streamId, setStreamId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const seqRef = useRef(0);

  // playback controls: pause, speed, restart-current, and a tap-to-replay log of everything signed
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [restartNonce, setRestartNonce] = useState(0);
  const [clipLog, setClipLog] = useState<{ text: string; clip: MeshClip; at: number }[]>([]);
  const RATES = [0.5, 0.75, 1, 1.25];

  const stageRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());  // keeps chunk translations IN ORDER
  const sessionRef = useRef("st" + Math.random().toString(36).slice(2, 10));  // continuity key: server transitions each clip from the last
  const wordBufRef = useRef<string[]>([]);
  const flushTimerRef = useRef<any>(null);

  /** translate one small chunk and append its clip to the interpreter's play queue */
  const sendChunk = useCallback((chunk: string) => {
    const c = chunk.trim();
    if (!c) return;
    chainRef.current = chainRef.current.then(async () => {
      setBusyN((n) => n + 1);
      try {
        const r = await fetch(`${API}/v1/smplx/translate`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: c, session: sessionRef.current }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          const missing = e?.detail?.missing;
          if (r.status === 422 && Array.isArray(missing)) { setNowChips({ used: [], missing }); return; }
          throw new Error(e?.detail?.message || e?.detail || `HTTP ${r.status}`);
        }
        const m: Meta = await r.json();
        setNowChips({ used: m.used, missing: m.missing || [] });
        setSignsCount((n) => n + m.glosses.length);
        setErr(null);
        const clip: MeshClip = {
          vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`,
          facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`,
          frames: m.frames, nverts: m.nverts, fps: m.fps,
        };
        setMclips((q) => [...q, clip]);
        setClipLog((l) => [{ text: c, clip, at: Date.now() }, ...l].slice(0, 24));
      } catch (e: any) {
        setErr(e.message || String(e));
      } finally {
        setBusyN((n) => n - 1);
      }
    });
  }, []);

  /** realtime: words arrive the moment they stabilize; batch tiny chunks, flush fast */
  const flushWords = useCallback(() => {
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    const words = wordBufRef.current.splice(0);
    if (words.length) sendChunk(words.join(" "));
  }, [sendChunk]);

  const onWords = useCallback((words: string[]) => {
    wordBufRef.current.push(...words);
    setCapWords((w) => [...w, ...words].slice(-14));
    setLastWasText(false);
    if (wordBufRef.current.length >= 3) flushWords();
    else {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flushWords, 550);
    }
  }, [flushWords]);

  const onFinal = useCallback((phrase: string) => {
    setPhrases((p) => [{ text: phrase, at: Date.now() }, ...p].slice(0, 8));
    flushWords();                                            // don't sit on a short tail
  }, [flushWords]);

  const speech = useSpeech(onFinal, onWords, micLang === "auto" ? "en-US" : micLang);
  const listening = speech.listening;

  // ---- Auto mic: server multilingual Whisper (auto-detects language PER CHUNK, so a bilingual
  //      Cameroon event can flow EN<->FR mid-sentence with no toggling). Records complete ~3.5s webm
  //      blobs into the stream FEED; the server transcribes+translates+signs and we poll the mesh.
  const micIsAuto = micLang === "auto";
  const [micAuto, setMicAuto] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRecRef = useRef<any>(null);
  const micFeedRef = useRef<string | null>(null);
  const micSeqRef = useRef(0);
  const micPollRef = useRef<any>(null);

  const stopMicAuto = useCallback(() => {
    setMicAuto(false);
    if (micPollRef.current) { clearInterval(micPollRef.current); micPollRef.current = null; }
    try { micRecRef.current && micRecRef.current.state !== "inactive" && micRecRef.current.stop(); } catch {}
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    const fid = micFeedRef.current;
    if (fid) fetch(`${API}/v1/stream/${fid}/stop`, { method: "POST" }).catch(() => {});
    micStreamRef.current = null; micRecRef.current = null; micFeedRef.current = null;
  }, []);

  const startMicAuto = useCallback(async () => {
    try {
      // clean the VOICE for Whisper — denoise + echo-cancel + auto-gain markedly cut mis-hears
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      micStreamRef.current = stream;
      const r = await fetch(`${API}/v1/stream/feed/start`, { method: "POST" });
      if (!r.ok) throw new Error("feed start failed");
      const fid = (await r.json()).id;
      micFeedRef.current = fid; micSeqRef.current = 0; setMicAuto(true); setErr(null);
      // poll the feed for server-signed mesh (same shape as the URL-stream path)
      micPollRef.current = setInterval(async () => {
        const id = micFeedRef.current; if (!id) return;
        try {
          const j = await (await fetch(`${API}/v1/stream/${id}/poll?after=${micSeqRef.current}`)).json();
          for (const ev of j.events || []) {
            micSeqRef.current = Math.max(micSeqRef.current, ev.seq);
            if (ev.mesh?.token) {
              setNowChips({ used: ev.mesh.used || [], missing: ev.mesh.missing || [] });
              setSignsCount((n) => n + (ev.mesh.used?.length || 0));
              const clip: MeshClip = { vertsUrl: `${API}/v1/smplx/mesh/${ev.mesh.token}/verts`,
                facesUrl: `${API}/v1/smplx/mesh/${ev.mesh.token}/faces`, frames: ev.mesh.frames, nverts: ev.mesh.nverts, fps: ev.mesh.fps };
              setMclips((q) => [...q, clip]);
              setClipLog((l) => [{ text: ev.text, clip, at: Date.now() + ev.seq }, ...l].slice(0, 24));
            }
            const words = (ev.text || "").split(/\s+/).filter(Boolean);
            if (words.length) setCapWords((w) => [...w, ...words].slice(-14));
          }
        } catch { /* transient */ }
      }, 1200);
      // record COMPLETE webm blobs (fresh recorder each cycle -> each blob decodes standalone server-side)
      let first = true;
      const cycle = () => {
        const s = micStreamRef.current;
        if (!micFeedRef.current || !s || !s.active) return;
        let rec: any;
        try { rec = new MediaRecorder(s, { mimeType: "audio/webm;codecs=opus" }); } catch { rec = new MediaRecorder(s); }
        micRecRef.current = rec;
        const chunks: BlobPart[] = [];
        rec.ondataavailable = (e: any) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = async () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const id = micFeedRef.current;
          if (blob.size > 1500 && id) { try { await fetch(`${API}/v1/stream/${id}/feed`, { method: "POST", body: blob }); } catch {} }
          cycle();
        };
        rec.start();
        const dur = first ? 2200 : 5000; first = false;   // short first blob, then ~5s for accuracy
        setTimeout(() => { try { rec.state !== "inactive" && rec.stop(); } catch {} }, dur);
      };
      cycle();
    } catch (e: any) {
      setErr(e?.name === "NotAllowedError" ? "Microphone permission denied" : "Mic capture failed");
      stopMicAuto();
    }
  }, [stopMicAuto]);

  // leaving Auto stops the server feed; leaving a browser language stops browser recognition
  useEffect(() => {
    if (micIsAuto && speech.listening) speech.stop();
    if (!micIsAuto && micAuto) stopMicAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micIsAuto]);
  useEffect(() => () => stopMicAuto(), [stopMicAuto]);   // cleanup on unmount

  const micActive = micIsAuto ? micAuto : listening;
  const micToggle = useCallback(() => {
    if (micIsAuto) { micAuto ? stopMicAuto() : startMicAuto(); } else { speech.toggle(); }
  }, [micIsAuto, micAuto, startMicAuto, stopMicAuto, speech]);

  // clip finished -> advance the queue
  const advance = useCallback(() => setMclips((q) => q.slice(1)), []);

  // ---- live stream-in: start a server transcription session and poll its events ----
  const stopStream = useCallback((id?: string | null) => {
    const sid = id ?? streamId;
    if (sid) fetch(`${API}/v1/stream/${sid}/stop`, { method: "POST" }).catch(() => {});
    setStreamId(null); setStreamStatus("");
  }, [streamId]);

  const loadStream = useCallback(async () => {
    const u = srcUrl.trim();
    if (!u) return;
    const m = u.match(/(?:v=|youtu\.be\/|embed\/|live\/)([\w-]{11})/);
    setYtId(m ? m[1] : null);                                // YouTube gets a visual; other platforms are audio-interpreted
    stopStream();
    setErr(null);
    try {
      const r = await fetch(`${API}/v1/stream/start`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: u }),
      });
      if (!r.ok) throw new Error(`stream start failed (HTTP ${r.status})`);
      const j = await r.json();
      seqRef.current = 0;
      setStreamId(j.id);
      setStreamStatus("starting");
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  }, [srcUrl, stopStream]);

  useEffect(() => {
    if (!streamId) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`${API}/v1/stream/${streamId}/poll?after=${seqRef.current}`);
        if (!r.ok) return;
        const j = await r.json();
        setStreamStatus(j.status);
        if (j.status === "error" && j.error) setErr(j.error);
        for (const ev of j.events || []) {
          seqRef.current = Math.max(seqRef.current, ev.seq);
          if (ev.mesh?.token) {
            // the server already signed this chunk (one performance shared with every viewer)
            setNowChips({ used: ev.mesh.used || [], missing: ev.mesh.missing || [] });
            setSignsCount((n) => n + (ev.mesh.used?.length || 0));
            const clip: MeshClip = {
              vertsUrl: `${API}/v1/smplx/mesh/${ev.mesh.token}/verts`,
              facesUrl: `${API}/v1/smplx/mesh/${ev.mesh.token}/faces`,
              frames: ev.mesh.frames, nverts: ev.mesh.nverts, fps: ev.mesh.fps,
            };
            setMclips((q) => [...q, clip]);
            setClipLog((l) => [{ text: ev.text, clip, at: Date.now() + ev.seq }, ...l].slice(0, 24));
          } else {
            sendChunk(ev.text);                              // caption-only event: try client-side
          }
          const words = ev.text.split(/\s+/).filter(Boolean);
          setCapWords((w) => [...w, ...words].slice(-14));
          setPhrases((p) => [{ text: ev.text, at: Date.now() + ev.seq }, ...p].slice(0, 8));
        }
        if (j.status === "ended" || j.status === "stopped") { setStreamId(null); }
      } catch { /* transient */ }
    }, 1600);
    return () => clearInterval(iv);
  }, [streamId, sendChunk]);

  useEffect(() => { if (mode !== "stream" && streamId) stopStream(); }, [mode, streamId, stopStream]);
  useEffect(() => () => { if (streamId) stopStream(streamId); }, []);          // eslint-disable-line react-hooks/exhaustive-deps

  // ---- stage fullscreen (program + interpreter + captions all together) ----
  const fsToggle = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // recording duration
  useEffect(() => {
    if (!micActive) return;
    const t0 = Date.now();
    setElapsed(0);
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(iv);
  }, [micActive]);

  useEffect(() => {
    fetch(`${API}/v1/smplx/vocab`).then((r) => r.json()).then((v) => {
      setVocab(v.count || (v.signs?.length ?? 0));
      const want = ["JESUS", "LORD", "PRAY", "HEAL", "GRACE", "MIRACLE", "FAITH", "BLESS", "WORSHIP", "ALTAR", "HOPE", "PEACE"];
      const have = (v.signs || []) as string[];
      setSamples(want.filter((w) => have.includes(w)).slice(0, 8));
    }).catch(() => {});
  }, []);

  function submitText() {
    const t = text.trim();
    if (!t) return;
    setLastWasText(true);
    setPhrases((p) => [{ text: t, at: Date.now() }, ...p].slice(0, 8));
    setCapWords(t.split(/\s+/).slice(-14));
    sendChunk(t);
    setText("");
  }
  function clearSession() {
    wordBufRef.current = [];
    setMclips([]); setNowChips(null); setPhrases([]); setCapWords([]); setErr(null);
    sessionRef.current = "st" + Math.random().toString(36).slice(2, 10);   // fresh continuity on clear
  }

  const busy = busyN > 0 || mclips.length > 0;
  const streaming = !!streamId && (streamStatus === "live" || streamStatus === "starting");
  const interpreting = micActive || busy || streaming;
  const loopIdle = lastWasText && !micActive && !streaming;
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const barCount = 22;

  const overlayMode = mode === "stream" && !!ytId;           // program visible -> interpreter as overlay box

  return (
    <main style={{ minHeight: "100vh", padding: "18px 20px 30px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>

        {/* ============ TOP BAR ============ */}
        <header className="g-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href="/" className="display" style={{ width: 44, height: 44, borderRadius: 14, background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20, textDecoration: "none" }}>G</a>
            <div>
              <div className="display" style={{ fontWeight: 700, fontSize: 17, lineHeight: 1 }}>Gestlingua</div>
              <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 2 }}>Say anything. See it signed.</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="g-live"><span className="pulse" />{interpreting ? "ON AIR" : "READY"}</span>
            <div className="g-chip" title="3D sign vocabulary"><span className="dot" />{vocab.toLocaleString("en-US")} signs</div>
            <button className="g-icon" title="Clear session" onClick={clearSession}><FontAwesomeIcon icon={faBroom} /></button>
            <button className="g-icon" title="Settings"><FontAwesomeIcon icon={faGear} /></button>
          </div>
        </header>

        {/* ============ HERO ============ */}
        <section className="g-card" style={{ padding: "22px 28px", marginBottom: 16, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20, alignItems: "center", background: "linear-gradient(180deg,#fff,#fbf6ea)" }}>
          <div>
            <div className="g-label" style={{ marginBottom: 10 }}>The Healing Stream · Live Services</div>
            <h1 className="display" style={{ margin: 0, fontSize: 38, lineHeight: 1.03 }}>
              Speak. I sign it <span style={{ color: "var(--coral)" }}>as you talk.</span>
            </h1>
            <p style={{ color: "var(--ink-soft)", fontSize: 15, marginTop: 12, maxWidth: 520 }}>
              Realtime interpreting — words become signs the moment they’re spoken. Talk, paste a sermon, or drop a stream.
            </p>
            {/* live caption strip: THE text you're producing, right under your eyes */}
            <div className="capbar" style={{ marginTop: 16 }}>
              {capWords.length === 0 && !speech.interim
                ? <span style={{ color: "var(--muted)" }}>Your words appear here live…</span>
                : <>
                    {capWords.map((w, i) => <span key={capWords.length - i + "-" + w} className="cap-word">{w}</span>)}
                    {speech.interim && <span className="cap-interim">{speech.interim}</span>}
                  </>}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <button
              onClick={micToggle}
              disabled={!micIsAuto && !speech.supported}
              className="g-pill"
              style={{ width: 118, height: 118, borderRadius: 999, flexDirection: "column", gap: 8,
                background: micActive ? "var(--coral)" : "var(--black)", color: "#fff",
                boxShadow: micActive ? "0 0 0 10px rgba(240,86,47,.14), 0 16px 34px rgba(240,86,47,.32)" : "var(--shadow-card)" }}
            >
              <FontAwesomeIcon icon={micActive ? faStop : faMicrophone} style={{ fontSize: 28 }} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{micActive ? "Stop" : "Speak"}</span>
            </button>
            <div className="meter" style={{ color: micActive ? "var(--coral)" : "var(--line-2)", height: 30 }}>
              {Array.from({ length: barCount }).map((_, i) => {
                const w = 0.35 + 0.65 * Math.abs(Math.sin((i / barCount) * Math.PI));
                const lvl = speech.level || (micAuto ? 0.4 : 0);
                const h = micActive ? 4 + lvl * 26 * w * (0.6 + Math.random() * 0.7) : 4 + 3 * w;
                return <i key={i} style={{ height: Math.min(30, h) }} />;
              })}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", minHeight: 18, textAlign: "center" }}>
              {!micIsAuto && !speech.supported ? "Mic unsupported — use Chrome/Edge, or type below"
                : micActive ? <span style={{ color: "var(--coral)", fontWeight: 700 }}>● REC {mmss}{micIsAuto ? " · auto-detect" : ""}</span>
                : "Tap to start live interpreting"}
            </div>
            {/* Spoken language — the browser mic recognizes ONE language at a time, so pick it (you can
                switch live). French is transcribed in French then translated FR->EN->ASL. */}
            <div style={{ display: "flex", gap: 6, background: "var(--panel-2)", padding: 4, borderRadius: 999, border: "1px solid var(--line)" }}>
              {MIC_LANGS.map((l) => (
                <button key={l.code} onClick={() => setMicLang(l.code)} className="g-pill" title={`Speaking ${l.label}`}
                  style={{ padding: ".34rem .8rem", fontSize: ".76rem", fontWeight: 700, boxShadow: "none",
                    background: micLang === l.code ? "var(--coral)" : "transparent", color: micLang === l.code ? "#fff" : "var(--ink-soft)" }}>
                  {l.short}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ============ MAIN GRID ============ */}
        <section style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>

          {/* ---- broadcast stage ---- */}
          <div className="g-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6, background: "var(--panel-2)", padding: 4, borderRadius: 999, border: "1px solid var(--line)" }}>
                {([["mic", faMicrophone, "Microphone"], ["text", faKeyboard, "Text"], ["stream", faYoutube, "Stream"]] as const).map(([m, ic, lbl]) => (
                  <button key={m} onClick={() => setMode(m as Mode)} className="g-pill" style={{ padding: ".5rem .95rem", fontSize: ".82rem",
                    background: mode === m ? "var(--black)" : "transparent", color: mode === m ? "#fff" : "var(--ink-soft)", boxShadow: "none" }}>
                    <FontAwesomeIcon icon={ic as any} /> {lbl}
                  </button>
                ))}
              </div>
              <div className="g-label">Broadcast stage</div>
            </div>

            <div ref={stageRef} style={{ position: "relative", aspectRatio: "16/9", borderRadius: isFs ? 0 : 18, overflow: "hidden",
              background: "radial-gradient(120% 120% at 30% 0%, #14203c 0%, #0b1120 55%, #080b16 100%)",
              border: "1px solid var(--line)" }}>

              {/* source program (YouTube visual). fs=0 disables YouTube's OWN fullscreen button and we
                  drop allowFullScreen, so the iframe can never fullscreen ALONE (which would hide the
                  interpreter). Fullscreen goes through the stage button below -> program + avatar together. */}
              {overlayMode && (
                <iframe title="source" src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=0&fs=0&modestbranding=1&playsinline=1`} allow="autoplay; encrypted-media"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
              )}

              {/* THE INTERPRETER LIVES IN THE STAGE: fullscreen when he's the show, movable box on a program */}
              {pip === "stage" && (
                <StageInterpreter queue={mclips} loop={loopIdle} onFinished={advance}
                  overlay={overlayMode} live={interpreting} onPopOut={() => setPip("float")}
                  paused={paused} rate={rate} restartNonce={restartNonce} />
              )}
              {pip !== "stage" && !overlayMode && (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#7d8cb0", textAlign: "center", padding: 20 }}>
                  <div>
                    <FontAwesomeIcon icon={faHandsAslInterpreting} style={{ fontSize: 34, opacity: .55 }} />
                    <div style={{ marginTop: 12, fontSize: 14 }}>Interpreter is floating — dock him back from his window</div>
                  </div>
                </div>
              )}

              {/* status + fullscreen + live caption INSIDE the stage */}
              <div style={{ position: "absolute", left: 12, top: 12, zIndex: 3 }}>
                <span className="g-live" style={{ background: "rgba(12,17,32,.6)", color: "#fff", border: "1px solid rgba(255,255,255,.14)" }}>
                  <span className="pulse" />{streaming ? "INTERPRETING STREAM" : interpreting ? "INTERPRETING" : "STANDBY"}
                </span>
              </div>
              {/* player controls: fullscreen · pause · restart-current · speed */}
              <div style={{ position: "absolute", left: 12, bottom: 12, zIndex: 4, display: "flex", gap: 6 }}>
                <button onClick={fsToggle} title={isFs ? "Exit fullscreen" : "Fullscreen the stage"} style={stageBtn}>
                  <FontAwesomeIcon icon={isFs ? faCompress : faExpand} />
                </button>
                <button onClick={() => setPaused((p) => !p)} title={paused ? "Resume signing" : "Pause signing"}
                  style={{ ...stageBtn, background: paused ? "var(--coral)" : stageBtn.background as string }}>
                  <FontAwesomeIcon icon={paused ? faPlay : faPause} />
                </button>
                <button onClick={() => { setRestartNonce((n) => n + 1); setPaused(false); }} title="Restart this sign sequence"
                  style={stageBtn}>
                  <FontAwesomeIcon icon={faRotateLeft} />
                </button>
                <button onClick={() => setRate((r) => RATES[(RATES.indexOf(r) + 1) % RATES.length])}
                  title="Signing speed — slow it down to learn, speed it up to skim"
                  style={{ ...stageBtn, width: 40, fontWeight: 800, fontSize: 11 }}>
                  {rate}×
                </button>
              </div>
              {(capWords.length > 0 || speech.interim) && (
                <div className="stage-caption" style={{ zIndex: 3 }}>
                  {capWords.slice(-9).map((w, i) => <span key={i + "-" + w} className="cap-word">{w}</span>)}
                  {speech.interim && <span className="cap-interim">{speech.interim}</span>}
                </div>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              {mode === "text" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <input className="g-input" placeholder="Type or paste text to sign…" value={text}
                    onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitText()} />
                  <button className="g-pill g-coral" onClick={submitText} disabled={!text.trim()}>
                    <FontAwesomeIcon icon={busyN > 0 ? faSpinner : faPaperPlane} spin={busyN > 0} /> Sign
                  </button>
                </div>
              )}
              {mode === "stream" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input className="g-input" placeholder="Paste ANY stream or video link — YouTube (live or not), Facebook, m3u8, mp4…" value={srcUrl}
                      onChange={(e) => setSrcUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadStream()} />
                    {streaming && (
                      <button className="g-pill g-gold" title="Copy the public viewer link — anyone who opens it watches this signed broadcast"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/watch/${streamId}`).then(() => setErr(null)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                        <FontAwesomeIcon icon={faShareNodes} /> {copied ? "Copied!" : "Share"}
                      </button>
                    )}
                    {streaming
                      ? <button className="g-pill g-soft" onClick={() => stopStream()}><FontAwesomeIcon icon={faStop} /> Stop</button>
                      : <button className="g-pill g-coral" onClick={loadStream} disabled={!srcUrl.trim()}><FontAwesomeIcon icon={faTowerBroadcast} /> Interpret</button>}
                  </div>
                  <div style={{ fontSize: 12.5, color: streaming ? "var(--emerald)" : "var(--muted)" }}>
                    {streaming ? (streamStatus === "starting" ? "Connecting to the stream’s audio…" : "● Live — transcribing the stream and signing it in realtime")
                      : "Gesturia pulls the stream’s audio server‑side, transcribes it live, and signs it — no on‑screen player needed for non‑YouTube links."}
                  </div>
                </div>
              )}
              {mode === "mic" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    {/* live waveform + duration right where you're working */}
                    <div className="meter" style={{ color: micActive ? "var(--coral)" : "var(--line-2)", height: 22 }}>
                      {Array.from({ length: 12 }).map((_, i) => {
                        const w = 0.4 + 0.6 * Math.abs(Math.sin((i / 12) * Math.PI));
                        const lvl = speech.level || (micAuto ? 0.4 : 0);
                        const h = micActive ? 3 + lvl * 19 * w * (0.6 + Math.random() * 0.7) : 3 + 2 * w;
                        return <i key={i} style={{ height: Math.min(22, h) }} />;
                      })}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: micActive ? "var(--coral)" : "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                      {micActive ? `● ${mmss}` : "00:00"}
                    </span>
                    <span style={{ color: "var(--ink-soft)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {micActive ? (micIsAuto ? "Live — auto-detecting language" : "Live — signing as you speak") : "Press start to interpret live"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* spoken language: 🌐 Auto (server, any language, live EN↔FR) or a fixed browser language */}
                    <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", padding: 3, borderRadius: 999, border: "1px solid var(--line)" }}>
                      {MIC_LANGS.map((l) => (
                        <button key={l.code} onClick={() => setMicLang(l.code)} className="g-pill" title={l.label}
                          style={{ padding: ".3rem .7rem", fontSize: ".72rem", fontWeight: 700, boxShadow: "none",
                            background: micLang === l.code ? "var(--coral)" : "transparent", color: micLang === l.code ? "#fff" : "var(--ink-soft)" }}>
                          {l.short}
                        </button>
                      ))}
                    </div>
                    <button className={`g-pill ${micActive ? "g-soft" : "g-coral"}`} onClick={micToggle} disabled={!micIsAuto && !speech.supported}>
                      <FontAwesomeIcon icon={micActive ? faStop : faMicrophone} /> {micActive ? "Stop" : "Start mic"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ---- right rail ---- */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div className="g-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div className="g-label">Signing now</div>
                {/* pace tracker: nothing is ever dropped — the interpreter catches up at a legible pace,
                    and if it falls behind it says so (never skips words) */}
                {mclips.length > 1 ? (
                  <span style={{ fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5,
                    color: mclips.length > 6 ? "var(--coral)" : mclips.length > 3 ? "var(--gold)" : "var(--muted)" }}
                    title="Signs waiting their turn. Nothing is dropped — the interpreter catches up at a readable pace.">
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                    {mclips.length - 1} behind
                  </span>
                ) : mclips.length === 1 ? (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>live · keeping up</span>
                ) : null}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, minHeight: 34 }}>
                {nowChips?.used.map((g, i) => <span key={"u" + i} className="g-chip g-chip-used"><span className="dot" />{g}</span>)}
                {nowChips?.missing?.map((g, i) => <span key={"m" + i} className="g-chip g-chip-spell" title="not in 3D vocab — fingerspelled">{g}·spell</span>)}
                {!nowChips && <span style={{ color: "var(--muted)", fontSize: 13 }}>The current chunk’s signs show here — green = signed, coral = fingerspelled.</span>}
              </div>
              {err && <div style={{ marginTop: 10, color: "var(--coral-600)", fontSize: 12.5 }}>⚠ {err}</div>}
            </div>

            <div className="g-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div className="g-label">Phrases · tap to replay</div>
                <FontAwesomeIcon icon={faWaveSquare} style={{ color: "var(--muted)" }} />
              </div>
              <div className="thin" style={{ minHeight: 56, maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {clipLog.length === 0 && <span style={{ color: "var(--muted)", fontSize: 13 }}>Everything signed lands here — missed one? Tap it and he signs it again.</span>}
                {clipLog.map((p) => (
                  <button key={p.at} className="phrase-row" title="Sign this again"
                    onClick={() => { setMclips((q) => [...q, p.clip]); setPaused(false); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", textAlign: "left", font: "inherit" }}>
                    <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{p.text}</span>
                    <FontAwesomeIcon icon={faRotateLeft} style={{ color: "var(--coral)", fontSize: 12, flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="g-card" style={{ padding: 16 }}>
                <FontAwesomeIcon icon={faCircleNodes} style={{ color: "var(--indigo)" }} />
                <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>{vocab.toLocaleString("en-US")}</div>
                <div style={{ color: "var(--muted)", fontSize: 12.5 }}>3D signs</div>
              </div>
              <div className="g-card" style={{ padding: 16 }}>
                <FontAwesomeIcon icon={faBolt} style={{ color: "var(--gold)" }} />
                <div className="display" style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>{signsCount}</div>
                <div style={{ color: "var(--muted)", fontSize: 12.5 }}>signed this session</div>
              </div>
            </div>

            {samples.length > 0 && (
              <div className="g-card" style={{ padding: 16 }}>
                <div className="g-label" style={{ marginBottom: 10 }}>Try a word</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {samples.map((w) => (
                    <button key={w} className="g-chip g-chip-gold" style={{ cursor: "pointer" }} onClick={() => { setLastWasText(true); sendChunk(w); }}>{w.toLowerCase()}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {pip === "float" && (
        <AvatarPip queue={mclips} live={interpreting} loop={loopIdle} onFinished={advance} onDock={() => setPip("stage")}
          paused={paused} rate={rate} restartNonce={restartNonce} />
      )}
    </main>
  );
}
