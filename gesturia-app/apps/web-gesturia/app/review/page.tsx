"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark, faVideo, faForward, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../components/MeshSigner";
import AuthButton from "../../components/AuthButton";

/** NATIVE-SIGNER REVIEW — the deaf community rules on every sign before it may perform.
 *  A fluent signer watches the sign exactly as stored and decides: correct (approve), wrong (reject —
 *  it never performs again), or right-sign-bad-motion (re-record — queued for the community studio).
 *  Keyboard: A approve · R reject · E re-record · S skip. Decisions are signed with the reviewer's name. */

const API = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

type Row = { gloss: string; level: string; reasons: string[]; review: any; performs: boolean };
type Stats = { triage: Record<string, number>; reviewed: Record<string, number>; pending: number; verified_only: boolean };

const LEVELS = ["all", "GREEN", "YELLOW", "RED"] as const;

export default function ReviewPage() {
  const [reviewer, setReviewer] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [cur, setCur] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [clip, setClip] = useState<MeshClip | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const curRef = useRef(cur); curRef.current = cur;
  const rowsRef = useRef(rows); rowsRef.current = rows;

  useEffect(() => { setReviewer(localStorage.getItem("gesturia.reviewer") || ""); }, []);
  useEffect(() => { if (reviewer) localStorage.setItem("gesturia.reviewer", reviewer); }, [reviewer]);

  const loadStats = useCallback(() => {
    fetch(`${API}/v1/review/stats`).then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const loadQueue = useCallback((lv: string) => {
    setErr("");
    fetch(`${API}/v1/review/queue?level=${lv}&status=pending&limit=400`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows || []); setTotal(d.total || 0); setCur(0); })
      .catch(() => setErr("Engine unreachable — start Gesturia first."));
  }, []);

  useEffect(() => { loadStats(); loadQueue(level); }, [level, loadQueue, loadStats]);

  // load the CURRENT sign's clip (raw stored entry — the ruling is on the artifact)
  useEffect(() => {
    const row = rows[cur];
    setClip(null);
    if (!row) return;
    let alive = true;
    fetch(`${API}/v1/review/clip/${encodeURIComponent(row.gloss)}`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((m) => {
        if (!alive) return;
        setClip({ vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`,
          frames: m.frames, nverts: m.nverts, fps: m.fps || 30 });
      })
      .catch(() => alive && setErr(`couldn't load ${row.gloss}`));
    return () => { alive = false; };
  }, [rows, cur]);

  const decide = useCallback(async (status: "approved" | "rejected" | "rerecord") => {
    const row = rowsRef.current[curRef.current];
    if (!row || busy) return;
    if (!reviewer.trim()) { setErr("Enter the reviewer's name first — decisions are signed."); return; }
    setBusy(true); setErr("");
    try {
      await fetch(`${API}/v1/review/decide`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gloss: row.gloss, status, reviewer: reviewer.trim(), note }),
      }).then((r) => { if (!r.ok) throw new Error(String(r.status)); });
      setNote("");
      setRows((rs) => rs.filter((_, i) => i !== curRef.current));
      setTotal((t) => Math.max(0, t - 1));
      loadStats();
    } catch { setErr("decision didn't save — engine down?"); }
    setBusy(false);
  }, [busy, reviewer, note, loadStats]);

  const skip = useCallback(() => setCur((c) => (rowsRef.current.length ? (c + 1) % rowsRef.current.length : 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "a" || e.key === "A") decide("approved");
      else if (e.key === "r" || e.key === "R") decide("rejected");
      else if (e.key === "e" || e.key === "E") decide("rerecord");
      else if (e.key === "s" || e.key === "S") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, skip]);

  const row = rows[cur];
  const done = stats ? (stats.reviewed.approved + stats.reviewed.rejected + stats.reviewed.rerecord) : 0;

  return (
    <main style={{ maxWidth: 1060, margin: "0 auto", padding: "1.2rem 1rem 3rem" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <a href="/" className="g-pill" style={{ padding: ".35rem .7rem" }}><FontAwesomeIcon icon={faArrowLeft} /> Home</a>
        <div>
          <div className="g-label">Native-signer review</div>
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>The community rules on every sign</h1>
        </div>
        <div style={{ marginLeft: "auto" }}><AuthButton /></div>
      </header>

      <p style={{ color: "var(--ink-soft)", marginTop: 0, marginBottom: 14, maxWidth: 720 }}>
        Watch the sign exactly as stored. If a fluent signer wouldn&apos;t sign it this way, reject it —
        a rejected sign is never performed again (Gesturia fingerspells instead, which never lies).
        Signs marked re-record are queued for the community recording studio.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Reviewer name (signed decisions)"
          style={{ padding: ".5rem .8rem", borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--ink)", minWidth: 240 }} />
        <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", padding: 3, borderRadius: 999, border: "1px solid var(--line)" }}>
          {LEVELS.map((lv) => (
            <button key={lv} onClick={() => setLevel(lv)} className="g-pill"
              style={{ padding: ".3rem .7rem", fontSize: ".72rem", fontWeight: 700, boxShadow: "none",
                background: level === lv ? "var(--gold)" : "transparent", color: level === lv ? "#1C1A17" : "var(--ink-soft)" }}>
              {lv === "all" ? "All" : lv}
            </button>
          ))}
        </div>
        {stats && (
          <div className="g-label" style={{ marginLeft: "auto" }}>
            {done} reviewed · {stats.pending} pending · quarantined RED: {stats.triage.RED ?? 0}
          </div>
        )}
      </div>

      {err && <div style={{ background: "#7a2e2e", color: "#fff", padding: ".6rem .9rem", borderRadius: 10, marginBottom: 10 }}>{err}</div>}

      {row ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 14 }}>
          <div style={{ background: "#0F1626", borderRadius: 16, overflow: "hidden", minHeight: 420, position: "relative" }}>
            {clip
              ? <MeshSigner queue={[clip]} loop />
              : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--ink-soft)" }}>loading sign…</div>}
            <div style={{ position: "absolute", left: 12, top: 10, background: "rgba(16,22,38,.82)", padding: ".4rem .8rem", borderRadius: 10 }}>
              <div style={{ fontWeight: 800, fontSize: "1.15rem", letterSpacing: ".04em" }}>{row.gloss}</div>
              <div className="g-label">{row.level}{row.performs ? " · currently performs" : " · quarantined"}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => decide("approved")} disabled={busy} className="g-pill"
              style={{ padding: ".8rem 1rem", fontWeight: 800, background: "#2f7a46", color: "#fff", justifyContent: "flex-start" }}>
              <FontAwesomeIcon icon={faCheck} /> Correct — approve <span style={{ marginLeft: "auto", opacity: .6 }}>A</span>
            </button>
            <button onClick={() => decide("rejected")} disabled={busy} className="g-pill"
              style={{ padding: ".8rem 1rem", fontWeight: 800, background: "#7a2e2e", color: "#fff", justifyContent: "flex-start" }}>
              <FontAwesomeIcon icon={faXmark} /> Wrong — never perform <span style={{ marginLeft: "auto", opacity: .6 }}>R</span>
            </button>
            <button onClick={() => decide("rerecord")} disabled={busy} className="g-pill"
              style={{ padding: ".8rem 1rem", fontWeight: 800, background: "#8a6a1f", color: "#fff", justifyContent: "flex-start" }}>
              <FontAwesomeIcon icon={faVideo} /> Right sign, re-record <span style={{ marginLeft: "auto", opacity: .6 }}>E</span>
            </button>
            <button onClick={skip} disabled={busy} className="g-pill" style={{ padding: ".6rem 1rem", justifyContent: "flex-start" }}>
              <FontAwesomeIcon icon={faForward} /> Skip for now <span style={{ marginLeft: "auto", opacity: .6 }}>S</span>
            </button>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (what's wrong, regional variant, …)"
              style={{ minHeight: 90, padding: ".6rem .8rem", borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel-2)", color: "var(--ink)", resize: "vertical" }} />
            {row.reasons?.length > 0 && (
              <div style={{ fontSize: ".78rem", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                <div className="g-label" style={{ marginBottom: 4 }}>Extraction forensics</div>
                {row.reasons.map((r, i) => <div key={i}>· {r}</div>)}
              </div>
            )}
            <div className="g-label" style={{ marginTop: "auto" }}>{total} in this queue</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--ink-soft)" }}>
          {total === 0 ? "Queue clear for this filter — thank you. Every ruling makes Gesturia honest." : "loading…"}
        </div>
      )}
    </main>
  );
}
