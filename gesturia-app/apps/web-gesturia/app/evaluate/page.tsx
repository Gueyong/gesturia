"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo, faMagnifyingGlass, faHandsAslInterpreting, faDice, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../components/MeshSigner";
import SignEvaluator from "../../components/SignEvaluator";
import AuthButton from "../../components/AuthButton";

/** /evaluate — the Gesturia sign judge, standalone. Pick any sign in the dictionary, watch the 3D
 *  reference, perform it to your camera, and get graded on handshape / location / movement / palm
 *  orientation. Goes straight to evaluation (no lesson flow). */

const API = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

const SUGGEST = ["HELLO", "FRIEND", "MOTHER", "FATHER", "JESUS", "PRAY", "HAPPY", "LOVE", "GOOD", "WATER", "EAT", "HELP", "THANK YOU", "SORRY", "PEACE"];

export default function EvaluatePage() {
  const [vocab, setVocab] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [gloss, setGloss] = useState<string | null>(null);
  const [clip, setClip] = useState<MeshClip | null>(null);
  const [lang, setLang] = useState("en");   // coach review language (EN/FR — bilingual events)
  const [status, setStatus] = useState<"idle" | "checking" | "notfound" | "ready" | "offline">("idle");
  const [mode, setMode] = useState<"grade" | "challenge">("grade");
  const [deck, setDeck] = useState<string[]>([]);          // signs the evaluator can recognize
  const [challengeWord, setChallengeWord] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    fetch(`${API}/v1/eval/status`).then((r) => r.json())
      .then((s) => { if (!s.ready) setStatus("offline"); }).catch(() => setStatus("offline"));
    fetch(`${API}/v1/smplx/vocab`).then((r) => r.json())
      .then((v) => setVocab(new Set((v.signs || []) as string[]))).catch(() => {});
    fetch(`${API}/v1/eval/signs`).then((r) => r.json())
      .then((s) => setDeck((s.signs || []) as string[])).catch(() => {});
  }, []);

  // word-only challenge: pick a random recognizable sign; hand the evaluator a small candidate set
  // (the target + a few distractors) so recognition is sharp without revealing the sign.
  const newChallenge = useCallback(() => {
    if (!deck.length) return;
    const target = deck[Math.floor(Math.random() * deck.length)];
    const others = deck.filter((w) => w !== target).sort(() => Math.random() - 0.5).slice(0, 7);
    setCandidates([target, ...others].sort(() => Math.random() - 0.5));
    setChallengeWord(target);
  }, [deck]);

  const suggest = useMemo(() => SUGGEST.filter((s) => !vocab.size || vocab.has(s)), [vocab]);

  const pick = useCallback(async (w: string) => {
    const g = w.trim().toUpperCase();
    if (!g) return;
    setStatus("checking"); setClip(null); setGloss(null);
    try {
      const has = await fetch(`${API}/v1/eval/has/${encodeURIComponent(g)}`).then((r) => r.json());
      if (!has.ready) { setStatus("offline"); return; }
      if (!has.has_reference) { setStatus("notfound"); return; }
      const m = await fetch(`${API}/v1/smplx/translate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: w }),
      }).then((r) => r.json());
      setClip({ vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`,
        frames: m.frames, nverts: m.nverts, fps: m.fps });
      setGloss(g); setStatus("ready");
    } catch { setStatus("offline"); }
  }, []);

  const queue = useMemo(() => (clip ? [clip] : []), [clip]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--panel-2,#F8F2E4)", padding: "22px 20px 40px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <a href="/" className="display" style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center",
            color: "#fff", fontWeight: 800, background: "linear-gradient(135deg,var(--coral,#E8553A),var(--gold,#F4B81F))", textDecoration: "none" }}>G</a>
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>Sign judge</div>
            <div style={{ fontSize: 12.5, color: "var(--muted,#9C9179)" }}>watch it · do it · be graded on precision</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: "var(--panel-2)", padding: 3, borderRadius: 999, border: "1px solid var(--line)" }}>
            {[["grade", "Grade", faEye], ["challenge", "Challenge", faEyeSlash]].map(([c, l, ic]: any) => (
              <button key={c} onClick={() => { setMode(c); if (c === "challenge" && !challengeWord) newChallenge(); }}
                className="g-pill" title={c === "challenge" ? "Word only — no demo. Perform it; the evaluator recognizes it." : "Watch the sign, then perform it for a precision score."}
                style={{ padding: ".3rem .7rem", fontSize: ".74rem", fontWeight: 700, boxShadow: "none",
                  background: mode === c ? "var(--coral)" : "transparent", color: mode === c ? "#fff" : "var(--ink-soft)" }}>
                <FontAwesomeIcon icon={ic} /> {l}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", padding: 3, borderRadius: 999, border: "1px solid var(--line)" }}>
            {[["en", "EN"], ["fr", "FR"]].map(([c, l]) => (
              <button key={c} onClick={() => setLang(c)} className="g-pill" title={`Coach speaks ${l}`}
                style={{ padding: ".3rem .7rem", fontSize: ".74rem", fontWeight: 700, boxShadow: "none",
                  background: lang === c ? "var(--coral)" : "transparent", color: lang === c ? "#fff" : "var(--ink-soft)" }}>{l}</button>
            ))}
          </div>
          <a href="/solo" className="g-pill g-soft">
            <FontAwesomeIcon icon={faHandsAslInterpreting} /> Gestsolo lessons
          </a>
          <AuthButton />
        </header>

        {/* ── GRADE mode: pick a sign, watch it, perform it, be scored ── */}
        {mode === "grade" && (<>
        {/* picker */}
        <section className="g-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 260px" }}>
              <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} />
              <input className="g-input" value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && pick(query)} placeholder="Type any sign, e.g. mother"
                style={{ width: "100%", padding: ".62rem .8rem .62rem 2rem", fontSize: 14 }} />
            </div>
            <button className="g-pill g-coral" onClick={() => pick(query)} disabled={!query.trim()}>
              <FontAwesomeIcon icon={faVideo} /> Evaluate this sign
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {suggest.map((s) => (
              <button key={s} className="g-chip g-chip-gold" style={{ cursor: "pointer" }}
                onClick={() => { setQuery(s.toLowerCase()); pick(s); }}>{s.toLowerCase()}</button>
            ))}
          </div>
          {status === "checking" && <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>Loading the reference…</p>}
          {status === "notfound" && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 10 }}>No 3D reference for that sign — try one of the chips above.</p>}
          {status === "offline" && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 10 }}>The evaluator isn’t ready yet (engine offline or model still training).</p>}
        </section>

        {/* watch + do */}
        {gloss && clip ? (
          <section className="g-card" style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div className="g-label" style={{ marginBottom: 8 }}>Watch · “{gloss}”</div>
              <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 16, overflow: "hidden", border: "1px solid var(--line,#E8DFC9)" }}>
                <MeshSigner queue={queue} loop rate={0.7} hint={false} />
              </div>
            </div>
            <div>
              <div className="g-label" style={{ marginBottom: 8 }}>Your turn</div>
              <SignEvaluator api={API} gloss={gloss} language={lang} />
            </div>
          </section>
        ) : (
          <section className="g-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <FontAwesomeIcon icon={faVideo} style={{ fontSize: 30, opacity: .5 }} />
            <p style={{ marginTop: 12, fontSize: 14 }}>Pick a sign above to start. You’ll see it performed, then sign it to your camera for a precision score.</p>
          </section>
        )}
        </>)}

        {/* ── CHALLENGE mode: word only, no demo — perform it and the evaluator recognizes it ── */}
        {mode === "challenge" && (
          deck.length === 0 ? (
            <section className="g-card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              <FontAwesomeIcon icon={faEyeSlash} style={{ fontSize: 30, opacity: .5 }} />
              <p style={{ marginTop: 12, fontSize: 14 }}>The recognition deck isn’t ready yet (evaluator offline or reference bank still building).</p>
            </section>
          ) : (
            <section className="g-card" style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div className="g-label" style={{ marginBottom: 8 }}>Perform this sign — no demo</div>
                <div style={{ aspectRatio: "4 / 3", borderRadius: 16, border: "1px dashed var(--line,#E8DFC9)", display: "grid", placeItems: "center", textAlign: "center", padding: 20, background: "var(--panel-2,#F8F2E4)" }}>
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8, letterSpacing: ".04em" }}>SIGN THIS WORD</div>
                    <div className="display" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05 }}>{(challengeWord || "—").toLowerCase()}</div>
                    <button className="g-pill g-soft" style={{ marginTop: 16 }} onClick={newChallenge}>
                      <FontAwesomeIcon icon={faDice} /> New word
                    </button>
                    <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted)", maxWidth: 260 }}>
                      No interpreter is shown. Recall the sign from memory, perform it to your camera, and the evaluator will tell you if you got it right.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div className="g-label" style={{ marginBottom: 8 }}>Your turn</div>
                {challengeWord && (
                  <SignEvaluator api={API} gloss={challengeWord} language={lang} mode="challenge"
                    candidates={candidates} key={challengeWord} />
                )}
              </div>
            </section>
          )
        )}
      </div>
    </main>
  );
}
