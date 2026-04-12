"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import MeshSigner, { type MeshClip } from "../../components/MeshSigner";

/** Gest-X floating interpreter — the tiny window Olo lives in.
 *  ?text=...  sign a piece of text (context-menu "Sign with Gesturia")
 *  ?sid=...   follow a live session (tab-audio capture / stream broadcast)
 *  The "pin" button uses Document Picture-in-Picture (Chrome 116+) for TRUE always-on-top —
 *  the interpreter floats over every app, not just the browser. */

function apiBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:8020";
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env && !env.includes("localhost") && !env.includes("127.0.0.1")) return env;
  return `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`;
}

export default function Pip() {
  const [mclips, setMclips] = useState<MeshClip[]>([]);
  const [capWords, setCapWords] = useState<string[]>([]);
  const [label, setLabel] = useState("Gest‑X");
  const [loop, setLoop] = useState(false);
  const seqRef = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const advance = useCallback(() => setMclips((q) => q.slice(1)), []);

  useEffect(() => {
    const API = apiBase();
    const qs = new URLSearchParams(window.location.search);
    const text = qs.get("text");
    const sid = qs.get("sid");

    if (text) {
      setLabel("Signing selection");
      setLoop(true);
      setCapWords(text.split(/\s+/).slice(-12));
      fetch(`${API}/v1/smplx/translate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      }).then((r) => (r.ok ? r.json() : null)).then((m) => {
        if (m) setMclips([{ vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`, frames: m.frames, nverts: m.nverts, fps: m.fps }]);
      }).catch(() => {});
      return;
    }
    if (sid) {
      setLabel("Live · tab audio");
      const iv = setInterval(async () => {
        try {
          const r = await fetch(`${API}/v1/stream/${sid}/poll?after=${seqRef.current}`);
          if (!r.ok) return;
          const j = await r.json();
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
            setCapWords((w) => [...w, ...words].slice(-10));
          }
        } catch { /* transient */ }
      }, 1600);
      return () => clearInterval(iv);
    }
    setLabel("Gest‑X ready");
  }, []);

  // TRUE always-on-top: move the interpreter into a Document Picture-in-Picture window
  const pinOnTop = useCallback(async () => {
    const dpp = (window as any).documentPictureInPicture;
    if (!dpp || !boxRef.current) return;
    try {
      const w = await dpp.requestWindow({ width: 300, height: 400 });
      [...document.styleSheets].forEach((ss) => {
        try {
          const rules = [...(ss.cssRules || [])].map((r) => r.cssText).join("");
          const el = w.document.createElement("style"); el.textContent = rules; w.document.head.appendChild(el);
        } catch { /* cross-origin sheet */ }
      });
      w.document.body.style.margin = "0";
      w.document.body.style.background = "#080b16";
      w.document.body.appendChild(boxRef.current);
      w.addEventListener("pagehide", () => window.location.reload());
    } catch { /* user dismissed */ }
  }, []);

  return (
    <main style={{ position: "fixed", inset: 0, background: "#080b16" }}>
      <div ref={boxRef} style={{ position: "absolute", inset: 0 }}>
        <MeshSigner queue={mclips} loop={loop} onFinished={advance} hint={false} />
        <div style={{ position: "absolute", left: 10, top: 8, zIndex: 3, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="display" style={{ width: 22, height: 22, borderRadius: 7, background: "#1C1A17", color: "#F4B81F", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>G</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{label}</span>
        </div>
        <button onClick={pinOnTop} title="Pin on top of every app (Chrome 116+)"
          style={{ position: "absolute", right: 8, top: 8, zIndex: 3, width: 26, height: 26, borderRadius: 8,
            border: "none", cursor: "pointer", background: "rgba(255,255,255,.16)", color: "#fff", fontSize: 12 }}>
          📌
        </button>
        {capWords.length > 0 && (
          <div className="stage-caption" style={{ zIndex: 3, bottom: 10, fontSize: 13, maxWidth: "92%" }}>
            {capWords.slice(-8).map((w, i) => <span key={i + "-" + w} className="cap-word">{w}</span>)}
          </div>
        )}
      </div>
    </main>
  );
}
