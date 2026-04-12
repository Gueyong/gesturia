"use client";
import { useState } from "react";

/**
 * Base /watch page. A viewer link is /watch/<stream-id> (shared by a broadcaster from the studio's
 * Share button). Bare /watch has no session, so instead of a raw 404 we help the visitor: paste a link
 * or go interpret in the studio. (Streaming itself lives as a tab inside /studio, not a separate page.)
 */
export default function WatchHome() {
  const [v, setV] = useState("");
  const go = () => {
    const m = v.trim().match(/([A-Za-z0-9]+)\/?$/);
    if (m) location.href = `/watch/${m[1]}`;
  };
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0f1e", color: "#e8eefc",
      fontFamily: "-apple-system, Segoe UI, Roboto, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{ width: 44, height: 44, margin: "0 auto 16px", borderRadius: 12,
          background: "linear-gradient(135deg,#F4642A,#F4B81F)", display: "grid", placeItems: "center",
          fontWeight: 800, fontSize: 22, color: "#1a1205" }}>G</div>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Watch a signed broadcast</h1>
        <p style={{ color: "#8fb2ff", fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>
          A viewer link looks like <code style={{ color: "#F4B81F" }}>/watch/&lt;stream-id&gt;</code> — get one from a
          broadcaster’s <b>Share</b> button in the studio. Paste it here, or open the studio to interpret live.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="paste a /watch/… link or stream id"
            style={{ flex: 1, background: "#0c1226", border: "1px solid #22304f", borderRadius: 12, color: "#e8eefc",
              padding: "10px 12px", fontSize: 14 }} />
          <button onClick={go} style={{ background: "linear-gradient(135deg,#F4642A,#e0531d)", color: "#fff",
            border: 0, borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Watch</button>
        </div>
        <a href="/studio" style={{ display: "inline-block", marginTop: 16, color: "#8fb2ff", fontSize: 13 }}>← Interpret live in the studio</a>
      </div>
    </main>
  );
}
