"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import MeshSigner, { type MeshClip } from "../../../components/MeshSigner";

/** Gesturia broadcast VIEWER — the shareable link. No controls, no login: the program (when it's a
 *  YouTube source), the interpreter signing the server-generated performance, and live captions.
 *  Open this page in OBS as a browser source and it IS the TV feed. */

function apiBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:8020";
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env && !env.includes("localhost") && !env.includes("127.0.0.1")) return env;
  return `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`;   // viewers reach the API on the host that served them
}

export default function Watch({ params }: { params: { sid: string } }) {
  const sid = params.sid;
  const [yt, setYt] = useState<string | null>(null);
  const [status, setStatus] = useState("connecting");
  const [mclips, setMclips] = useState<MeshClip[]>([]);
  const [capWords, setCapWords] = useState<string[]>([]);
  const seqRef = useRef(0);

  const advance = useCallback(() => setMclips((q) => q.slice(1)), []);

  useEffect(() => {
    const API = apiBase();
    let alive = true;
    fetch(`${API}/v1/stream/${sid}/info`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (alive && j) { setYt(j.yt || null); setStatus(j.status); }
      else if (alive) setStatus("not-found");
    }).catch(() => alive && setStatus("offline"));

    const iv = setInterval(async () => {
      try {
        const r = await fetch(`${API}/v1/stream/${sid}/poll?after=${seqRef.current}`);
        if (!r.ok) { setStatus("ended"); return; }
        const j = await r.json();
        setStatus(j.status);
        for (const ev of j.events || []) {
          seqRef.current = Math.max(seqRef.current, ev.seq);
          if (ev.mesh?.token) {
            setMclips((q) => [...q.slice(-6), {
              vertsUrl: `${API}/v1/smplx/mesh/${ev.mesh.token}/verts`,
              facesUrl: `${API}/v1/smplx/mesh/${ev.mesh.token}/faces`,
              frames: ev.mesh.frames, nverts: ev.mesh.nverts, fps: ev.mesh.fps,
            }]);
          }
          const words = (ev.text || "").split(/\s+/).filter(Boolean);
          setCapWords((w) => [...w, ...words].slice(-12));
        }
      } catch { /* transient */ }
    }, 1600);
    return () => { alive = false; clearInterval(iv); };
  }, [sid]);

  const live = status === "live" || status === "starting";

  return (
    <main style={{ position: "fixed", inset: 0, background: "#080b16", overflow: "hidden" }}>
      {/* program */}
      {yt && (
        <iframe title="program" src={`https://www.youtube.com/embed/${yt}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      )}

      {/* the interpreter — fullscreen when he IS the program, corner box over a video source */}
      <div style={yt
        ? { position: "absolute", right: 18, bottom: 18, width: "24%", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden",
            border: "2px solid rgba(255,255,255,.55)", boxShadow: "0 12px 36px rgba(0,0,0,.5)", zIndex: 2 }
        : { position: "absolute", inset: 0 }}>
        <MeshSigner queue={mclips} onFinished={advance} hint={false} />
      </div>

      {/* badge + captions */}
      <div style={{ position: "absolute", left: 16, top: 14, zIndex: 3, display: "flex", alignItems: "center", gap: 10 }}>
        <span className="display" style={{ width: 30, height: 30, borderRadius: 9, background: "#1C1A17", color: "#F4B81F", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>G</span>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: ".02em" }}>Gesturia</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999,
          background: live ? "rgba(232,85,58,.9)" : "rgba(255,255,255,.14)", color: "#fff", fontSize: 11.5, fontWeight: 800 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "#fff" }} />
          {live ? "LIVE · SIGNED" : status.toUpperCase()}
        </span>
      </div>
      {capWords.length > 0 && (
        <div className="stage-caption" style={{ zIndex: 3, bottom: 20, fontSize: 16 }}>
          {capWords.slice(-10).map((w, i) => <span key={i + "-" + w} className="cap-word">{w}</span>)}
        </div>
      )}
    </main>
  );
}
