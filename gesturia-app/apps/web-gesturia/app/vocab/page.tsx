"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilm, faPlay, faSpinner, faCheck, faTriangleExclamation, faDownload, faBan,
  faFolderOpen, faHandsAslInterpreting, faRotate, faVideo,
} from "@fortawesome/free-solid-svg-icons";
import AuthButton from "../../components/AuthButton";

/** VOCAB STUDIO — grow the sign dictionary yourself. Point it at a folder of sign videos (WLASL or
 *  ASL-Citizen naming) and our extractor+lifter turns each into a sign the avatar can perform. Watch the
 *  Qwen-3B download, and see which gospel signs are removed (to be re-added from corrected videos). */

const API = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

type VideoRow = { file: string; gloss: string; status: string; frames?: number; body_cov?: number; error?: string };
type Job = { status: string; path?: string; total: number; done: number; added: string[]; unblocked?: string[]; videos: VideoRow[]; error?: string };
type Dl = { state: string; percent: number; downloaded_mb?: number | null; total_mb?: number | null; running?: boolean; note?: string };

const STATUS_ICON: Record<string, any> = { ok: faCheck, failed: faTriangleExclamation, low_quality: faTriangleExclamation, pending: faSpinner, running: faSpinner };
const STATUS_COLOR: Record<string, string> = { ok: "var(--emerald,#1f9d69)", failed: "var(--coral,#E8553A)", low_quality: "var(--gold,#F4B81F)", pending: "var(--muted)", running: "var(--muted)" };

export default function VocabStudio() {
  const [path, setPath] = useState("");
  const [gloss, setGloss] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dl, setDl] = useState<Dl | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const pollRef = useRef<any>(null);

  const loadBlocked = useCallback(() => {
    fetch(`${API}/v1/vocab/blocked`).then((r) => r.json()).then((b) => setBlocked(b.blocked || [])).catch(() => {});
  }, []);
  const loadDl = useCallback(() => {
    fetch(`${API}/v1/vocab/download-status`).then((r) => r.json()).then(setDl).catch(() => {});
  }, []);

  useEffect(() => {
    loadBlocked(); loadDl();
    const t = setInterval(loadDl, 4000);
    return () => clearInterval(t);
  }, [loadBlocked, loadDl]);

  // poll the ingest job
  useEffect(() => {
    if (!jobId) return;
    const tick = () => fetch(`${API}/v1/vocab/ingest/${jobId}`).then((r) => r.json()).then((j: Job) => {
      setJob(j);
      if (j.status === "done" || j.status === "error") {
        setBusy(false); clearInterval(pollRef.current); loadBlocked();
        fetch(`${API}/v1/vocab/reload`, { method: "POST" }).catch(() => {});   // make new signs live
      }
    }).catch(() => {});
    tick();
    pollRef.current = setInterval(tick, 1500);
    return () => clearInterval(pollRef.current);
  }, [jobId, loadBlocked]);

  const ingest = useCallback(async () => {
    if (!path.trim()) return;
    setErr(""); setJob(null); setBusy(true);
    try {
      const r = await fetch(`${API}/v1/vocab/ingest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.trim(), gloss: gloss.trim() || null }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.detail || `ingest failed (${r.status})`); }
      const j = await r.json();
      setJobId(j.job_id);
    } catch (e: any) { setErr(e?.message || String(e)); setBusy(false); }
  }, [path, gloss]);

  const resumeDownload = useCallback(() => {
    fetch(`${API}/v1/vocab/download/start`, { method: "POST" }).then(() => setTimeout(loadDl, 1500)).catch(() => {});
  }, [loadDl]);

  const pct = dl ? Math.max(0, Math.min(100, dl.percent || 0)) : 0;
  const okCount = job ? job.videos.filter((v) => v.status === "ok").length : 0;

  return (
    <main style={{ minHeight: "100vh", background: "var(--panel-2,#F8F2E4)", padding: "22px 20px 48px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <a href="/" className="display" style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, background: "linear-gradient(135deg,var(--coral,#E8553A),var(--gold,#F4B81F))", textDecoration: "none" }}>G</a>
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>Vocab Studio</div>
            <div style={{ fontSize: 12.5, color: "var(--muted,#9C9179)" }}>grow the dictionary from your own videos — no effort</div>
          </div>
          <a href="/evaluate" className="g-pill g-soft" style={{ marginLeft: "auto" }}>
            <FontAwesomeIcon icon={faHandsAslInterpreting} /> Teach on camera
          </a>
          <AuthButton />
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, alignItems: "start" }}>
          {/* ---- add from video ---- */}
          <section className="g-card" style={{ padding: 18 }}>
            <div className="g-label" style={{ marginBottom: 4 }}><FontAwesomeIcon icon={faFilm} /> Add signs from video</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 14px", lineHeight: 1.5 }}>
              Paste a path to a <b>folder</b> of sign videos (or one file). Names following <b>WLASL</b> (5-digit id) or
              <b> ASL-Citizen</b> (a CSV with a Gloss column) are matched automatically; otherwise the filename is the word,
              or set one below. Our extractor + lifter turns each clip into a sign the avatar can perform.
            </p>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <FontAwesomeIcon icon={faFolderOpen} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} />
              <input className="g-input" value={path} onChange={(e) => setPath(e.target.value)}
                placeholder={"C:\\gesturia-train\\religious_signs   (folder or a single .mp4)"}
                style={{ width: "100%", padding: ".62rem .8rem .62rem 2rem", fontSize: 13.5, fontFamily: "monospace" }} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input className="g-input" value={gloss} onChange={(e) => setGloss(e.target.value)}
                placeholder="force a word (optional)" style={{ flex: "1 1 160px", padding: ".55rem .7rem", fontSize: 13.5 }} />
              <button className="g-pill g-coral" onClick={ingest} disabled={busy || !path.trim()}>
                <FontAwesomeIcon icon={busy ? faSpinner : faPlay} spin={busy} /> {busy ? "Lifting…" : "Ingest & lift"}
              </button>
            </div>
            {err && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 10 }}>{err}</p>}

            {job && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
                  <span>{job.status === "loading-model" ? "loading extractor + lifter…" : job.status === "done" ? "done" : `lifting ${job.done}/${job.total}`}</span>
                  <span>{okCount} added{job.unblocked?.length ? ` · ${job.unblocked.length} un-blocked` : ""}</span>
                </div>
                <div style={{ height: 6, background: "var(--panel-2)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)" }}>
                  <div style={{ height: "100%", width: `${job.total ? (100 * job.done) / job.total : (job.status === "loading-model" ? 8 : 0)}%`, background: "var(--emerald,#1f9d69)", transition: "width .3s" }} />
                </div>
                <div style={{ marginTop: 12, maxHeight: 280, overflowY: "auto", display: "grid", gap: 4 }}>
                  {job.videos.map((v, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", padding: "6px 8px", borderRadius: 8, background: "var(--panel-2)" }}>
                      <FontAwesomeIcon icon={STATUS_ICON[v.status] || faSpinner} spin={v.status === "pending" || v.status === "running"} style={{ color: STATUS_COLOR[v.status] || "var(--muted)", fontSize: 13 }} />
                      <span style={{ minWidth: 0 }}>
                        <b style={{ fontSize: 13 }}>{v.gloss?.toLowerCase()}</b>
                        <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis" }}>{v.file}</span>
                        {v.error && <span style={{ fontSize: 11, color: "var(--coral)", display: "block" }}>{v.error}</span>}
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {v.status === "ok" ? `${v.frames}f · cov ${Math.round((v.body_cov || 0) * 100)}%` : v.status === "low_quality" ? `low cov ${Math.round((v.body_cov || 0) * 100)}%` : v.status}
                      </span>
                    </div>
                  ))}
                </div>
                {job.status === "done" && okCount > 0 && (
                  <p style={{ fontSize: 12.5, color: "var(--emerald)", marginTop: 10 }}>
                    <FontAwesomeIcon icon={faCheck} /> {okCount} sign{okCount > 1 ? "s" : ""} added to the dictionary — the interpreter can perform {okCount > 1 ? "them" : "it"} now.
                  </p>
                )}
              </div>
            )}
          </section>

          <div style={{ display: "grid", gap: 16 }}>
            {/* ---- live capture ---- */}
            <section className="g-card" style={{ padding: 18 }}>
              <div className="g-label" style={{ marginBottom: 6 }}><FontAwesomeIcon icon={faVideo} /> Add a sign live (you move, model learns)</div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
                Perform a sign to your camera — MediaPipe reads your body + hands and stores the motion so the avatar can
                reproduce it. No gloves, no suit; the model does the capture.
              </p>
              <a href="/vocab/live" className="g-pill g-emerald"><FontAwesomeIcon icon={faHandsAslInterpreting} /> Open live capture</a>
            </section>

            {/* ---- Qwen-3B download ---- */}
            <section className="g-card" style={{ padding: 18 }}>
              <div className="g-label" style={{ marginBottom: 8 }}><FontAwesomeIcon icon={faDownload} /> Qwen-3B language model</div>
              {dl && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
                    <span>{dl.state === "complete" ? "downloaded ✓" : dl.state === "downloading" ? "downloading…" : dl.state}</span>
                    <span>{dl.total_mb ? `${Math.round(dl.downloaded_mb || 0)} / ${Math.round(dl.total_mb)} MB` : ""} {pct ? `(${pct}%)` : ""}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--panel-2)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)" }}>
                    <div style={{ height: "100%", width: `${dl.state === "complete" ? 100 : pct}%`, background: dl.state === "complete" ? "var(--emerald)" : "var(--gold)", transition: "width .4s" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                    {dl.state !== "complete" && !dl.running && (
                      <button className="g-pill g-soft" style={{ fontSize: 12.5, padding: ".4rem .8rem" }} onClick={resumeDownload}>
                        <FontAwesomeIcon icon={faRotate} /> {dl.state === "not-started" ? "Start" : "Resume"}
                      </button>
                    )}
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{dl.note || (dl.running ? "running — auto-activates when done" : "smarter routing / typo fixes")}</span>
                  </div>
                </>
              )}
            </section>

            {/* ---- gospel removed ---- */}
            <section className="g-card" style={{ padding: 18 }}>
              <div className="g-label" style={{ marginBottom: 6 }}><FontAwesomeIcon icon={faBan} style={{ color: "var(--coral)" }} /> Gospel signs removed ({blocked.length})</div>
              <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 10px" }}>
                Their extraction was wrong, so they’re hidden. Ingest a corrected video for any of them above and it’s
                restored automatically.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {blocked.map((g) => (
                  <span key={g} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--coral,#E8553A)", background: "rgba(232,85,58,.08)", border: "1px solid rgba(232,85,58,.2)", padding: "1px 7px", borderRadius: 999 }}>{g.toLowerCase()}</span>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
