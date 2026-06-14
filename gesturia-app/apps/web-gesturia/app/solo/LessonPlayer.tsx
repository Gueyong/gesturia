"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight, faAward, faBolt, faCheck, faChevronLeft, faFire, faHand,
  faHeart, faHourglassHalf, faRotateLeft, faVideo,
} from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../components/MeshSigner";
import SignEvaluator from "../../components/SignEvaluator";

/** Gestsolo lesson player — one stone on the path.
 *  Phase 1 (learn): Uria signs each of the 4 words live, looped; again / slower / got it.
 *  Phase 2 (quiz):  she signs one with no label — you pick the word. Right = +10 XP and
 *  paper confetti; wrong = one heart, and she patiently replays it at half speed.
 *  All 4 clips are fetched up-front so the quiz is instant. */

export type Lesson = {
  id: string;
  title: string;
  words: string[];
  icon: IconDefinition;
  locked?: boolean;
  lockNote?: string;
};

type Phase = "loading" | "error" | "learn" | "quiz" | "done";
type Question = { target: string; choices: string[] };

const LEARN_LINES = [
  "Watch my hands. Ready?",
  "See the shape my fingers make? Draw it in the air with me.",
  "Slow is strong. Nobody rushes on this path.",
  "Last one — your eyes are getting quick.",
];
const RIGHT_LINES = [
  "That’s it. You saw it.",
  "Yes — your eyes are learning to listen.",
  "Exactly. I’d barely finished signing.",
  "You caught it. I knew you would.",
];
const WRONG_LINE = "Watch my hands once more — slower this time.";
const WRONG_LINE_NO_HEARTS = "No hearts left — so we go slowly, together. Watch again.";

/** Gestify issuance — completing a stone puts a REAL demo Gestificate on the
 *  public record (localStorage["gestify.issued"], the same registry /verify reads).
 *  Serial: GST-YYYYMM-XXXXXXXX. Score: 60 + 10 per heart still beating, capped at 100. */
function issueGestificate(lesson: Lesson, heartsLeft: number): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let tail = "";
  for (let i = 0; i < 8; i++) tail += alpha[Math.floor(Math.random() * alpha.length)];
  const serial = `GST-${ym}-${tail}`;

  let holder = "Gestsolo Explorer";
  try {
    const raw = window.localStorage.getItem("gestsolo.name");
    if (raw) {
      let name = raw;
      try { const p = JSON.parse(raw); if (typeof p === "string") name = p; } catch { /* stored plain */ }
      if (name.trim()) holder = name.trim();
    }
  } catch { /* private mode */ }

  const cert = {
    serial,
    holder,
    course: `${lesson.title} — first steps`,
    score: Math.min(100, 60 + 10 * heartsLeft),
    date: now.toISOString().slice(0, 10),
    surface: "Gestsolo",
  };
  try {
    const arr = JSON.parse(window.localStorage.getItem("gestify.issued") || "[]");
    window.localStorage.setItem("gestify.issued", JSON.stringify(Array.isArray(arr) ? [...arr, cert] : [cert]));
  } catch {
    try { window.localStorage.setItem("gestify.issued", JSON.stringify([cert])); } catch { /* full drawer */ }
  }
  return serial;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Hand-made paper bits — coral, gold, emerald. No library, just CSS. */
function Confetti({ burst }: { burst: number }) {
  if (!burst) return null;
  const colors = ["var(--coral)", "var(--gold)", "var(--emerald)"];
  return (
    <div className="solo-confetti" key={burst} aria-hidden>
      {Array.from({ length: 30 }).map((_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 137) % 100}%`,
            background: colors[i % 3],
            width: 6 + (i % 3) * 3,
            height: 10 + ((i * 7) % 3) * 4,
            animationDelay: `${(i % 10) * 45}ms`,
            "--dx": `${(i % 2 ? -1 : 1) * ((i * 29) % 90)}px`,
            "--rz": `${360 + ((i * 97) % 400)}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function LoadingView({ lesson }: { lesson: Lesson }) {
  return (
    <div className="solo-player-grid">
      <div className="solo-stage solo-stage-skel" role="status">
        <FontAwesomeIcon icon={faHand} className="solo-skel-hand" />
        <span>Uria is warming up her hands…</span>
      </div>
      <div className="solo-side" aria-hidden>
        <div className="solo-wordchips">
          {lesson.words.map((w) => (
            <span key={w} className="solo-wordchip is-skel">{w}</span>
          ))}
        </div>
        <div className="solo-skelbar" />
        <div className="solo-skelbar short" />
      </div>
    </div>
  );
}

function ErrorView({ onRetry, onExit }: { onRetry: () => void; onExit: () => void }) {
  return (
    <div className="solo-error" role="alert">
      <div className="solo-doneblob solo-error-blob"><FontAwesomeIcon icon={faHand} /></div>
      <h3 className="display">Uria is stretching her hands</h3>
      <p>— try again in a moment. The signing engine isn’t answering right now.</p>
      <div className="solo-controls">
        <button className="g-pill g-coral" onClick={onRetry}>
          <FontAwesomeIcon icon={faRotateLeft} /> try again
        </button>
        <button className="g-pill g-soft" onClick={onExit}>back to the path</button>
      </div>
    </div>
  );
}

export default function LessonPlayer({
  lesson, api, hearts, streak, onXp, onHeart, onComplete, onExit, onNext,
}: {
  lesson: Lesson;
  api: string;
  hearts: number;
  streak: number;
  onXp: (n: number) => void;
  onHeart: () => void;
  /** marks the lesson done + bumps the streak (once per day); returns true if the streak grew */
  onComplete: () => boolean;
  onExit: () => void;
  onNext: (() => void) | null;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [clips, setClips] = useState<Record<string, MeshClip>>({});
  const [wi, setWi] = useState(0);           // learn: which of the 4 words
  const [slow, setSlow] = useState(false);   // 0.5x patience mode
  const [nonce, setNonce] = useState(0);     // restart the current clip
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [burst, setBurst] = useState(0);
  const [gained, setGained] = useState(0);
  const [rested, setRested] = useState(false);  // lost a heart, refilled at the stone
  const [streakGrew, setStreakGrew] = useState(false);
  const [serial, setSerial] = useState<string | null>(null);  // the Gestificate this stone issued
  const [line, setLine] = useState(LEARN_LINES[0]);
  const [grading, setGrading] = useState(false);   // "grade me" camera panel in the learn phase
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  /* pre-fetch all 4 words' clips at lesson start so the quiz is instant */
  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const entries = await Promise.all(
        lesson.words.map(async (w) => {
          const r = await fetch(`${api}/v1/smplx/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: w }),
          });
          if (!r.ok) throw new Error(`translate failed for "${w}"`);
          const m = await r.json();
          const clip: MeshClip = {
            vertsUrl: `${api}/v1/smplx/mesh/${m.token}/verts`,
            facesUrl: `${api}/v1/smplx/mesh/${m.token}/faces`,
            frames: m.frames,
            nverts: m.nverts,
            fps: m.fps,
          };
          return [w, clip] as const;
        }),
      );
      setClips(Object.fromEntries(entries));
      setWi(0);
      setSlow(false);
      setLine(LEARN_LINES[0]);
      setNonce((n) => n + 1);
      setPhase("learn");
    } catch {
      setPhase("error");
    }
  }, [api, lesson]);

  useEffect(() => { load(); }, [load]);

  const activeWord = phase === "quiz" ? quiz[qi]?.target : lesson.words[wi];
  const clip = activeWord ? clips[activeWord] : undefined;
  const queue = useMemo(() => (clip ? [clip] : []), [clip]);

  const gotIt = () => {
    setGrading(false);
    if (wi + 1 < lesson.words.length) {
      const n = wi + 1;
      setWi(n);
      setSlow(false);
      setNonce((x) => x + 1);
      setLine(LEARN_LINES[n % LEARN_LINES.length]);
    } else {
      setQuiz(shuffle(lesson.words).map((t) => ({ target: t, choices: shuffle(lesson.words) })));
      setQi(0);
      setPicked([]);
      setSolved(false);
      setSlow(false);
      setNonce((x) => x + 1);
      setLine("Now I sign, you guess. No labels — just your eyes and my hands.");
      setPhase("quiz");
    }
  };

  const pick = (w: string) => {
    if (phase !== "quiz" || solved) return;
    const q = quiz[qi];
    if (!q || picked.includes(w)) return;
    if (w === q.target) {
      setSolved(true);
      setBurst((b) => b + 1);
      setGained((g) => g + 10);
      onXp(10);
      setLine(RIGHT_LINES[qi % RIGHT_LINES.length]);
      // a long enough beat for young readers to take in Uria's praise
      timer.current = window.setTimeout(() => {
        if (qi + 1 < quiz.length) {
          setQi(qi + 1);
          setPicked([]);
          setSolved(false);
          setSlow(false);
          setNonce((n) => n + 1);
          setLine("Eyes on my hands — next one.");
        } else {
          setStreakGrew(onComplete());
          setSerial(issueGestificate(lesson, hearts));  // hearts as they stood, before the stone refills them
          setPhase("done");
        }
      }, 2500);
    } else {
      onHeart();
      setRested(true);
      setPicked((p) => [...p, w]);
      setSlow(true);
      setNonce((n) => n + 1);
      setLine(hearts === 0 ? WRONG_LINE_NO_HEARTS : WRONG_LINE);
    }
  };

  const replayControls = (againLabel: string) => (
    <>
      <button className="g-pill g-soft" onClick={() => setNonce((n) => n + 1)}>
        <FontAwesomeIcon icon={faRotateLeft} /> {againLabel}
      </button>
      <button
        className={`g-pill g-soft solo-slow ${slow ? "is-on" : ""}`}
        onClick={() => { setSlow((s) => !s); setNonce((n) => n + 1); }}
        aria-pressed={slow}
      >
        <FontAwesomeIcon icon={faHourglassHalf} /> {slow ? "slow ×0.5" : "slower"}
      </button>
    </>
  );

  return (
    <section className="solo-player g-card floatIn">
      <Confetti burst={burst} />

      <div className="solo-player-top">
        <button className="g-icon" onClick={onExit} aria-label="Back to the path">
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <div>
          <div className="g-label">
            {phase === "quiz" ? `question ${qi + 1} of ${quiz.length}`
              : phase === "learn" ? `sign ${wi + 1} of ${lesson.words.length}`
              : "gestsolo · lesson"}
          </div>
          <h2 className="display">{lesson.title}</h2>
        </div>
        <div className="solo-hearts" title={`${hearts} of 5 hearts`} aria-label={`${hearts} of 5 hearts`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <FontAwesomeIcon key={i} icon={faHeart} className={i < hearts ? "is-full" : "is-empty"} />
          ))}
        </div>
      </div>

      {phase === "loading" && <LoadingView lesson={lesson} />}
      {phase === "error" && <ErrorView onRetry={load} onExit={onExit} />}

      {(phase === "learn" || phase === "quiz") && (
        <div className="solo-player-grid">
          {/* the live 3D teacher — the whole point of Gestsolo */}
          <div className="solo-stage">
            <MeshSigner queue={queue} loop rate={slow ? 0.5 : 0.75} hint={false} restartNonce={nonce} />
            <span className="solo-stage-badge">
              <span className="solo-stage-dot" />
              {phase === "learn" ? `LIVE · URIA SIGNS “${(activeWord || "").toUpperCase()}”` : "LIVE · URIA SIGNS · WHICH WORD?"}
            </span>
            {phase === "learn"
              ? <span className="solo-caption display">{activeWord}</span>
              : <span className="solo-caption solo-caption-q display">?</span>}
          </div>

          <div className="solo-side">
            {phase === "learn" ? (
              <>
                <div className="solo-wordchips">
                  {lesson.words.map((w, i) => (
                    <span key={w} className={`solo-wordchip ${i < wi ? "is-past" : i === wi ? "is-now" : ""}`}>
                      {i < wi && <FontAwesomeIcon icon={faCheck} />} {w}
                    </span>
                  ))}
                </div>
                <div className="solo-word display">{activeWord}</div>
                <p className="solo-uria" aria-live="polite">
                  <span className="solo-u display">U</span>
                  <i>“{line}”</i>
                </p>
                <div className="solo-controls">
                  {replayControls("again")}
                  <button className={`g-pill g-soft ${grading ? "is-on" : ""}`} onClick={() => setGrading((g) => !g)}
                    aria-pressed={grading} title="Sign it to your camera and be graded">
                    <FontAwesomeIcon icon={faVideo} /> {grading ? "hide camera" : "grade me"}
                  </button>
                  <button className="g-pill g-coral" onClick={gotIt}>
                    got it <FontAwesomeIcon icon={faArrowRight} />
                  </button>
                </div>
                {grading && activeWord ? (
                  <div style={{ marginTop: 12 }}>
                    <SignEvaluator api={api} gloss={activeWord.toUpperCase()}
                      onScored={(r) => { if (r.overall >= 70) onXp(Math.round(r.overall / 10)); }} />
                  </div>
                ) : (
                  <p className="solo-tip">Copy me in the air — really move your hands. That’s how they remember. Or tap <b>grade me</b> to sign it to your camera.</p>
                )}
              </>
            ) : (
              <>
                <div className="solo-qdots" aria-label={`question ${qi + 1} of ${quiz.length}`}>
                  {quiz.map((_, i) => (
                    <span key={i} className={i < qi ? "is-won" : i === qi ? "is-now" : ""} />
                  ))}
                </div>
                <div className="solo-qtitle display">Which word did I sign?</div>
                <div className="solo-choices">
                  {quiz[qi]?.choices.map((w) => {
                    const wrong = picked.includes(w);
                    const right = solved && w === quiz[qi].target;
                    return (
                      <button
                        key={w}
                        className={`solo-choice display ${right ? "is-right" : wrong ? "is-wrong" : ""}`}
                        onClick={() => pick(w)}
                        disabled={wrong || solved}
                      >
                        {right && <FontAwesomeIcon icon={faCheck} />} {w}
                      </button>
                    );
                  })}
                </div>
                <p className="solo-uria" aria-live="polite">
                  <span className="solo-u display">U</span>
                  <i>“{line}”</i>
                </p>
                <div className="solo-controls">{replayControls("sign it again")}</div>
                {hearts === 0 && (
                  <p className="solo-gentle">Out of hearts — I never stop teaching. We just walk slower.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="solo-done floatIn">
          <div className="solo-doneblob"><FontAwesomeIcon icon={faCheck} /></div>
          <h3 className="display">Stone complete.</h3>
          <p className="solo-done-sub">
            “{lesson.title}” lives in your hands now — <b>{lesson.words.join(" · ")}</b>.
            Sign one to somebody today.
          </p>
          <div className="solo-done-chips">
            <span className="g-chip g-chip-gold"><FontAwesomeIcon icon={faBolt} /> +{gained} XP</span>
            {streakGrew && (
              <span className="g-chip g-chip-spell"><FontAwesomeIcon icon={faFire} /> streak +1 — day {streak}</span>
            )}
            {rested && (
              <span className="g-chip"><FontAwesomeIcon icon={faHeart} style={{ color: "var(--coral)" }} /> hearts refilled — every stone is a rest</span>
            )}
          </div>
          <div className="solo-gestif">
            <span className="tile tile-ink"><FontAwesomeIcon icon={faAward} style={{ color: "var(--gold)" }} /></span>
            {serial ? (
              <p>
                This stone issued a real <b>Gestificate</b> — serial{" "}
                <b style={{ whiteSpace: "nowrap" }}>{serial}</b>, on the public record already.
              </p>
            ) : (
              <p>You just earned a step toward your first <b>Gestificate</b> — keep walking.</p>
            )}
            <a href={serial ? `/verify/${serial}` : "/verify"} className="g-pill g-gold">
              {serial ? "See your Gestificate" : "see where it leads"} <FontAwesomeIcon icon={faArrowRight} />
            </a>
          </div>
          <div className="solo-controls solo-done-cta">
            <button className="g-pill g-soft" onClick={onExit}>back to the path</button>
            {onNext && (
              <button className="g-pill g-coral" onClick={onNext}>
                next stone <FontAwesomeIcon icon={faArrowRight} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
