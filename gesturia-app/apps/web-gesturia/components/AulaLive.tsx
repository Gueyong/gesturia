"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone, faMicrophoneSlash, faDownload, faTrash, faPaperPlane,
  faChalkboardUser, faTriangleExclamation, faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "./MeshSigner";

/**
 * GESTAULA · Live class — the deaf student's bridge in a hearing classroom.
 * The teacher speaks (or types); Whisper-free in-browser speech recognition turns it into text, each
 * finished sentence is signed live by Lea at the front, AND every sentence is captured into bilingual
 * NOTES the student keeps — because a deaf student watching the interpreter can't take notes at the same
 * time. Signs covered + words with no sign yet are collected so the class becomes a study sheet.
 */

type Note = { id: number; t: string; text: string; signs: string[]; missing: string[] };

export default function AulaLive({ api }: { api: string }) {
  const [lang, setLang] = useState<"fr" | "en">("fr");   // language the TEACHER speaks (pipeline signs either)
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(true);          // browser supports speech recognition
  const [interim, setInterim] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [queue, setQueue] = useState<MeshClip[]>([]);
  const [caption, setCaption] = useState("");
  const [typed, setTyped] = useState("");
  const [title, setTitle] = useState("");

  const recRef = useRef<any>(null);
  const wantRef = useRef(false);          // are we supposed to be listening (drives auto-restart)
  const idRef = useRef(0);
  const capRef = useRef<Map<string, string>>(new Map());   // clip url -> sentence, for the live caption
  const langRef = useRef(lang); langRef.current = lang;

  /* one finished sentence -> sign it live + capture it into the notes */
  const sign = useCallback(async (raw: string) => {
    const text = raw.trim().replace(/\s+/g, " ");
    if (!text) return;
    let signs: string[] = [], missing: string[] = [];
    try {
      const r = await fetch(`${api}/v1/smplx/translate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      if (r.ok) {
        const m = await r.json();
        // the pipeline may report a routing (e.g. "thank you->thankyou"); show the resolved sign only
        const raw: string[] = (Array.isArray(m.used) && m.used.length ? m.used : m.glosses) || [];
        signs = Array.from(new Set(raw.map((s) => String(s).split("->").pop()!.trim()).filter(Boolean)));
        missing = m.missing || [];
        if (m.frames > 0 && m.token) {
          const clip: MeshClip = {
            vertsUrl: `${api}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${api}/v1/smplx/mesh/${m.token}/faces`,
            frames: m.frames, nverts: m.nverts, fps: m.fps,
          };
          capRef.current.set(clip.vertsUrl, text);
          setQueue((q) => { if (q.length === 0) setCaption(text); return [...q, clip]; });
        }
      } else if (r.status === 422) {
        const e = await r.json().catch(() => ({} as any));
        missing = e?.detail?.missing || [];
      }
    } catch { /* offline / engine down — still keep the written note */ }
    let t = "";
    try { t = new Date().toLocaleTimeString(langRef.current === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" }); } catch { t = ""; }
    setNotes((n) => [...n, { id: ++idRef.current, t, text, signs, missing }]);
  }, [api]);

  /* MeshSigner finished the head clip -> drop it, move the caption to the next */
  const advance = useCallback((url: string) => {
    setQueue((q) => {
      const nq = q.length && q[0].vertsUrl === url ? q.slice(1) : q;
      const head = nq[0];
      setCaption(head ? (capRef.current.get(head.vertsUrl) || "") : "");
      return nq;
    });
  }, []);

  /* ---- in-browser speech recognition (no server round-trip; auto-restarts on silence) ---- */
  const startVoice = useCallback(() => {
    const SR: any = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { setVoiceOk(false); return; }
    wantRef.current = true;
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = lang === "fr" ? "fr-FR" : "en-US";
    rec.onresult = (ev: any) => {
      let intr = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) sign(res[0].transcript);
        else intr += res[0].transcript;
      }
      setInterim(intr);
    };
    rec.onerror = (e: any) => { if (e?.error === "not-allowed" || e?.error === "service-not-allowed") { wantRef.current = false; setVoiceOk(false); setListening(false); } };
    rec.onend = () => { setInterim(""); if (wantRef.current) { try { rec.start(); } catch { /* already starting */ } } };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { /* already started */ }
  }, [lang, sign]);

  const stopVoice = useCallback(() => {
    wantRef.current = false;
    const rec = recRef.current; recRef.current = null;
    try { rec?.stop(); } catch { /* noop */ }
    setListening(false); setInterim("");
  }, []);

  useEffect(() => () => { wantRef.current = false; try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  /* download the captured class as a bilingual study sheet the student keeps */
  const download = useCallback(() => {
    const L = lang === "fr";
    let date = ""; try { date = new Date().toLocaleDateString(L ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch { date = ""; }
    const allSigns = Array.from(new Set(notes.flatMap((n) => n.signs.map((s) => s.toLowerCase()))));
    const allMissing = Array.from(new Set(notes.flatMap((n) => n.missing.map((s) => s.toLowerCase()))));
    const out: string[] = [
      `# Gestaula — ${L ? "Notes de cours" : "Class notes"}`,
      title.trim() ? `## ${title.trim()}` : "", date ? `*${date}*` : "", "",
      `## ${L ? "Ce qui a été dit" : "What was said"}`,
    ];
    for (const n of notes) {
      out.push(`- ${n.t ? `**${n.t}** — ` : ""}${n.text}` + (n.signs.length ? `  \n  _${L ? "signes" : "signs"}: ${n.signs.join(", ").toLowerCase()}_` : ""));
    }
    out.push("", `## ${L ? "Signes vus aujourd'hui" : "Signs covered today"} (${allSigns.length})`, allSigns.length ? allSigns.map((s) => `- ${s}`).join("\n") : `_${L ? "aucun" : "none"}_`);
    if (allMissing.length) out.push("", `## ${L ? "Mots pas encore signés" : "Words without a sign yet"}`, allMissing.map((s) => `- ${s}`).join("\n"));
    const blob = new Blob([out.join("\n")], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gestaula-notes-${(title.trim() || "cours").replace(/[^\w-]+/g, "-").toLowerCase().slice(0, 40)}.md`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, [notes, title, lang]);

  const submitTyped = useCallback(() => { const v = typed; setTyped(""); sign(v); }, [typed, sign]);
  const behind = Math.max(0, queue.length - 1);
  const signsToday = new Set(notes.flatMap((n) => n.signs.map((s) => s.toLowerCase()))).size;

  return (
    <div className="aula-live aula-fade">
      {/* ---- left: the board (Lea signs live) ---- */}
      <section className="g-card aula-paper aula-live-stage" aria-label="Live interpreter">
        <span className="aula-thread" aria-hidden="true" />
        <div className="aula-pad">
          <div className="aula-labelrow" style={{ marginBottom: 10 }}>
            <span className="g-label" style={{ color: "var(--emerald)" }}>
              <FontAwesomeIcon icon={faChalkboardUser} style={{ marginRight: 6 }} />En direct — Lea interprète
            </span>
            <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", padding: 3, borderRadius: 999, border: "1px solid var(--line)" }}>
              {(["fr", "en"] as const).map((c) => (
                <button key={c} onClick={() => setLang(c)} className="g-pill" title={`Teacher speaks ${c === "fr" ? "French" : "English"}`}
                  style={{ padding: ".26rem .66rem", fontSize: ".72rem", fontWeight: 700, boxShadow: "none",
                    background: lang === c ? "var(--emerald)" : "transparent", color: lang === c ? "#fff" : "var(--ink-soft)" }}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="aula-board">
            <div className="aula-board-screen">
              <MeshSigner queue={queue} loop={false} onFinished={advance} hint={false} />
              {listening && (
                <div className="aula-chalk-title aula-hand" aria-hidden="true">
                  <span className="aula-pulse-dot" style={{ marginRight: 8 }} />écoute…
                </div>
              )}
              {behind > 0 && (
                <div className="aula-board-done aula-hand" role="status" style={{ color: "#F4D58A" }}>{behind} en attente</div>
              )}
              {(caption || interim) && (
                <div className="aula-caption">
                  <span className="aula-serif" style={{ fontStyle: "italic" }}>{caption || interim}</span>
                  {!caption && interim && <span className="aula-pulse-dot" style={{ marginLeft: 8 }} />}
                </div>
              )}
              {!listening && queue.length === 0 && !caption && (
                <div className="aula-board-msg">
                  <span className="aula-hand" style={{ fontSize: 22, color: "rgba(243,233,216,.85)" }}>Press the mic — teach normally.</span>
                  <span style={{ fontSize: 13, color: "rgba(243,233,216,.55)", maxWidth: 320 }}>
                    Speak as you always do. Lea signs every sentence to the deaf student, and the class is written into notes automatically.
                  </span>
                </div>
              )}
            </div>
            <div className="aula-tray" aria-hidden="true">
              <span className="aula-chalk" /><span className="aula-chalk aula-chalk-em" /><span className="aula-eraser" />
              <span style={{ flex: 1 }} />
              <span className="aula-hand" style={{ fontSize: 14, color: "rgba(243,233,216,.5)" }}>tableau · en direct</span>
            </div>
          </div>

          {/* mic + typed input */}
          <div className="aula-controls">
            {!listening ? (
              <button className="g-pill g-emerald aula-pill-sm" onClick={startVoice} disabled={!voiceOk}>
                <FontAwesomeIcon icon={faMicrophone} /> Start speaking
              </button>
            ) : (
              <button className="g-pill g-soft aula-pill-sm" onClick={stopVoice}>
                <FontAwesomeIcon icon={faMicrophoneSlash} /> Stop
              </button>
            )}
            <span className="aula-live-type">
              <input className="g-input aula-serif" value={typed} onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitTyped()}
                placeholder={voiceOk ? "…or type a sentence" : "Type a sentence — voice needs Chrome/Edge"} />
              <button className="g-pill g-soft aula-pill-sm" onClick={submitTyped} disabled={!typed.trim()} aria-label="Sign this">
                <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </span>
          </div>
          {!voiceOk && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
              <FontAwesomeIcon icon={faCircleInfo} /> Live voice uses the browser recognizer (Chrome/Edge). Typing works everywhere and offline.
            </div>
          )}
        </div>
      </section>

      {/* ---- right: the notes the student keeps ---- */}
      <section className="g-card aula-paper aula-live-notes" aria-label="Class notes">
        <span className="aula-thread" aria-hidden="true" />
        <div className="aula-pad">
          <div className="aula-labelrow">
            <span className="g-label" style={{ color: "var(--emerald)" }}>Notes du cours — auto-captées</span>
            <span className="aula-hand" style={{ fontSize: 16, color: "var(--muted)" }}>{notes.length} ligne{notes.length === 1 ? "" : "s"} · {signsToday} signe{signsToday === 1 ? "" : "s"}</span>
          </div>
          <input className="g-input aula-serif" style={{ marginTop: 10, fontSize: 15.5 }}
            value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du cours (ex. Leçon 12 — La famille)" />

          <div className="aula-notes-scroll">
            {notes.length === 0 ? (
              <p className="aula-serif" style={{ fontStyle: "italic", color: "var(--muted)", fontSize: 14.5, marginTop: 14 }}>
                Nothing captured yet. As you teach, every sentence lands here — with the signs Lea used — so the deaf
                student walks away with a full written record and a vocabulary list.
              </p>
            ) : (
              <ol className="aula-notes-list">
                {notes.map((n) => (
                  <li key={n.id} className="aula-note">
                    <span className="aula-note-time aula-hand">{n.t}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="aula-serif aula-note-text">{n.text}</span>
                      {n.signs.length > 0 && (
                        <span className="aula-note-signs">
                          {n.signs.map((s, i) => <span key={i} className="aula-sign-chip">{s.toLowerCase()}</span>)}
                        </span>
                      )}
                      {n.missing.length > 0 && (
                        <span className="aula-note-missing">
                          <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 11 }} /> no sign yet: {n.missing.join(", ").toLowerCase()}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="aula-notes-foot">
            <button className="g-pill g-emerald aula-pill-sm" onClick={download} disabled={notes.length === 0}>
              <FontAwesomeIcon icon={faDownload} /> Download notes
            </button>
            <button className="g-pill g-soft aula-pill-sm" onClick={() => { setNotes([]); setQueue([]); setCaption(""); }} disabled={notes.length === 0}>
              <FontAwesomeIcon icon={faTrash} /> Clear
            </button>
          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: LIVE_CSS }} />
    </div>
  );
}

const LIVE_CSS = `
.aula-live { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 22px; align-items: start; margin-top: 22px; }
.aula-live-notes { position: relative; }
.aula-live-type { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 220px; min-width: 180px; margin-left: auto; }
.aula-live-type input { flex: 1; padding: .5rem .7rem; font-size: 14.5px; }
.aula-notes-scroll { margin-top: 12px; max-height: 340px; overflow-y: auto; padding-right: 4px; }
.aula-notes-list { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 2px; }
.aula-note { display: grid; grid-template-columns: 46px 1fr; gap: 10px; padding: 8px 8px; border-radius: 10px;
  border-left: 3px solid transparent; transition: background .15s ease; }
.aula-note:hover { background: rgba(62,142,90,.06); border-left-color: var(--emerald); }
.aula-note-time { font-size: 15px; color: var(--muted); padding-top: 2px; white-space: nowrap; }
.aula-note-text { display: block; font-size: 15.5px; line-height: 1.4; color: var(--ink); }
.aula-note-signs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.aula-sign-chip { font-size: 11.5px; font-weight: 600; color: var(--emerald); background: rgba(62,142,90,.10);
  border: 1px solid rgba(62,142,90,.22); padding: 1px 7px; border-radius: 999px; letter-spacing: .01em; }
.aula-note-missing { display: inline-flex; align-items: center; gap: 5px; margin-top: 5px; font-size: 12px; color: #8A6410; }
.aula-notes-foot { display: flex; gap: 8px; margin-top: 14px; align-items: center; }
@media (max-width: 980px) { .aula-live { grid-template-columns: 1fr; } }
`;
