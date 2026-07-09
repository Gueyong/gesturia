"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faArrowRight, faBolt, faVideo } from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../components/MeshSigner";
import SignEvaluator, { type EvalResult } from "../../components/SignEvaluator";

/** Gestsolo — Evaluator / Practice. You SEE the sign (Uria performs the reference), you DO it (webcam),
 *  Olo judges the precision: handshape, location, movement, palm orientation. Score >= 70 earns XP. */

export default function EvaluatorView({ api, words, onXp, onExit }:
  { api: string; words: string[]; onXp: (n: number) => void; onExit: () => void }) {
  const [i, setI] = useState(0);
  const [clip, setClip] = useState<MeshClip | null>(null);
  const [loading, setLoading] = useState(true);
  const [best, setBest] = useState<Record<string, number>>({});
  const awarded = useRef<Record<string, boolean>>({});

  const word = words[i];
  const gloss = useMemo(() => word.toUpperCase(), [word]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setClip(null);
    (async () => {
      try {
        const r = await fetch(`${api}/v1/smplx/translate`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: word }),
        });
        if (!r.ok) throw new Error("no clip");
        const m = await r.json();
        if (!alive) return;
        setClip({ vertsUrl: `${api}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${api}/v1/smplx/mesh/${m.token}/faces`,
          frames: m.frames, nverts: m.nverts, fps: m.fps });
      } catch { /* leave clip null -> placeholder */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [api, word]);

  const onScored = useCallback((r: EvalResult) => {
    setBest((b) => ({ ...b, [gloss]: Math.max(b[gloss] || 0, r.overall) }));
    if (r.overall >= 70 && !awarded.current[gloss]) {      // reward a clean attempt once per sign
      awarded.current[gloss] = true;
      onXp(Math.round(r.overall / 5));                     // up to +20 XP for a perfect sign
    }
  }, [gloss, onXp]);

  const queue = useMemo(() => (clip ? [clip] : []), [clip]);

  return (
    <section className="solo-player g-card floatIn">
      <div className="solo-player-top">
        <button className="g-icon" onClick={onExit} aria-label="Back"><FontAwesomeIcon icon={faChevronLeft} /></button>
        <div>
          <div className="g-label">practice · sign {i + 1} of {words.length}</div>
          <h2 className="display">Perform &amp; be judged</h2>
        </div>
        <span className="solo-stat" title="Best score for this sign">
          {best[gloss] != null ? `${Math.round(best[gloss])}/100` : "—"}
        </span>
      </div>

      <div className="solo-player-grid">
        {/* WATCH — Uria performs the reference */}
        <div className="solo-stage">
          {clip ? <MeshSigner queue={queue} loop rate={0.7} hint={false} />
            : <div className="signeval-overlay" style={{ position: "static", height: "100%" }}>
                {loading ? "Uria is preparing the sign…" : "No reference clip for this word."}</div>}
          <span className="solo-stage-badge"><span className="solo-stage-dot" /> WATCH · “{gloss}”</span>
          <span className="solo-caption display">{word}</span>
        </div>

        {/* DO — your webcam, judged */}
        <div className="solo-side">
          <div className="solo-word display" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FontAwesomeIcon icon={faVideo} style={{ color: "var(--coral)" }} /> Your turn
          </div>
          <p className="solo-uria"><span className="solo-u display">O</span>
            <i>“Watch me, then sign “{word}” to your camera. I’ll grade your handshape, where you sign it, the movement, and your palm.”</i></p>
          <SignEvaluator api={api} gloss={gloss} onScored={onScored} />
          <div className="solo-controls" style={{ marginTop: 10 }}>
            <button className="g-pill g-soft" disabled={i === 0} onClick={() => setI((x) => Math.max(0, x - 1))}>previous</button>
            {i + 1 < words.length
              ? <button className="g-pill g-coral" onClick={() => setI((x) => x + 1)}>next sign <FontAwesomeIcon icon={faArrowRight} /></button>
              : <button className="g-pill g-coral" onClick={onExit}>finish <FontAwesomeIcon icon={faArrowRight} /></button>}
          </div>
        </div>
      </div>
    </section>
  );
}
