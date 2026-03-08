"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHands, faPaperPlane, faSpinner, faCube } from "@fortawesome/free-solid-svg-icons";
import type { MeshClip } from "../../components/MeshSigner";

const MeshSigner = dynamic(() => import("../../components/MeshSigner"), { ssr: false });
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Meta = { token: string; frames: number; nverts: number; fps: number; used: string[]; missing: string[]; glosses: string[] };

export default function SmplxStudio() {
  const [text, setText] = useState("about accept animal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [clip, setClip] = useState<MeshClip | null>(null);
  const [samples, setSamples] = useState<string[]>([]);

  useEffect(() => {
    fetch(`${API}/v1/smplx/vocab`).then((r) => r.json()).then((v) => {
      const s: string[] = v.signs || [];
      const pick = ["ABOUT", "ACCEPT", "ANIMAL", "AGAIN", "AMERICA", "BOOK", "FAMILY", "HAPPY", "LEARN", "SCHOOL", "TEACHER", "HELLO"].filter((w) => s.includes(w));
      setSamples((pick.length ? pick : s.slice(0, 12)));
    }).catch(() => {});
  }, []);

  async function translate() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/v1/smplx/translate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.detail?.message || e?.detail || `HTTP ${r.status}`); }
      const m: Meta = await r.json();
      setMeta(m);
      setClip({ vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts.bin`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces.bin`, frames: m.frames, nverts: m.nverts, fps: m.fps });
    } catch (e: any) { setErr(e.message || String(e)); setClip(null); }
    finally { setBusy(false); }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0B1020", color: "#eef", padding: 24, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <FontAwesomeIcon icon={faCube} style={{ color: "#F4B81F" }} />
          <h1 style={{ margin: 0, fontSize: 22 }}>Gesturia — real SMPL-X avatar</h1>
        </div>
        <p style={{ margin: "0 0 18px", color: "#8ea0c8", fontSize: 14 }}>
          Text → glosses → co-articulated SMPL-X body mesh (10,475-vertex human, real captured + lifted 3D signs). Drag to orbit.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 20 }}>
          {/* controls */}
          <div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
              placeholder="Type words to sign…"
              style={{ width: "100%", boxSizing: "border-box", background: "#0f1730", color: "#eef", border: "1px solid #263255", borderRadius: 14, padding: 14, fontSize: 15, resize: "vertical" }} />
            <button onClick={translate} disabled={busy}
              style={{ marginTop: 12, background: busy ? "#334" : "#3E6BFF", color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 15, fontWeight: 600, cursor: busy ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 9 }}>
              <FontAwesomeIcon icon={busy ? faSpinner : faPaperPlane} spin={busy} /> {busy ? "Generating mesh…" : "Translate"}
            </button>

            {err && <div style={{ marginTop: 14, color: "#ff9b8a", fontSize: 13 }}>⚠ {err}</div>}

            {meta && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {meta.used.map((g, i) => (
                    <span key={i} style={{ background: "#16223f", border: "1px solid #2a3a63", borderRadius: 999, padding: "5px 11px", fontSize: 12.5 }}>{g}</span>
                  ))}
                </div>
                {meta.missing?.length > 0 && (
                  <div style={{ marginTop: 8, color: "#8ea0c8", fontSize: 12.5 }}>
                    not in 3D vocab (fingerspell later): {meta.missing.join(", ")}
                  </div>
                )}
                <div style={{ marginTop: 10, color: "#6d7ea6", fontSize: 12.5 }}>
                  <FontAwesomeIcon icon={faHands} /> {meta.glosses.length} signs · {meta.frames} frames @ {meta.fps}fps · {meta.nverts.toLocaleString()} verts
                </div>
              </div>
            )}

            {samples.length > 0 && (
              <div style={{ marginTop: 26 }}>
                <div style={{ color: "#6d7ea6", fontSize: 12, marginBottom: 7 }}>Try (in the 3D vocabulary):</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {samples.map((w) => (
                    <button key={w} onClick={() => setText(w.toLowerCase())}
                      style={{ background: "#101a33", border: "1px solid #223255", color: "#b9c6e6", borderRadius: 999, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>{w}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* viewer */}
          <div style={{ height: "70vh", minHeight: 420, border: "1px solid #1b2540", borderRadius: 18 }}>
            <MeshSigner queue={clip ? [clip] : []} loop />
          </div>
        </div>
      </div>
    </main>
  );
}
