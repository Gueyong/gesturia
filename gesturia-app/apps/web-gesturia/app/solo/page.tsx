"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt, faCheck, faCirclePlay, faClock, faFire, faHand, faHandsPraying,
  faHeart, faLock, faPeopleRoof, faVideo,
} from "@fortawesome/free-solid-svg-icons";
import LessonPlayer, { type Lesson } from "./LessonPlayer";
import EvaluatorView from "./EvaluatorView";
import AuthButton from "../../components/AuthButton";
import "./solo.css";

/** GESTSOLO — "Duolingo for hands." (docs/GESTURIA_SOUL.md)
 *  A footpath through a warm country: a hand-drawn coral chalk path winds across
 *  the cream schoolyard, five lesson stones sit on it, and inside each stone a
 *  real, live 3D teacher signs for you. State lives in localStorage only. */

const API = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

const LESSONS: Lesson[] = [
  { id: "hello", title: "Say hello", icon: faHand, words: ["hello", "thank you", "welcome", "friend", "please", "sorry"] },
  { id: "family", title: "Family", icon: faPeopleRoof, words: ["mother", "father", "sister", "brother", "baby", "home"] },
  { id: "faith", title: "Faith", icon: faHandsPraying, words: ["jesus", "pray", "bless", "heaven", "church", "hope"] },
  { id: "feelings", title: "Feelings", icon: faHeart, words: ["happy", "love", "peace", "sad", "good", "beautiful"] },
  { id: "numbers", title: "Numbers & time", icon: faClock, words: ["one", "two", "three", "four", "five", "time"] },
];

/* Evaluator / practice — signs with a real 3D reference you can be graded against (watch, do, be judged). */
const EVAL_WORDS = ["hello", "friend", "mother", "father", "jesus", "pray", "happy", "love", "good", "water", "eat", "help"];

/* path geometry — the winding chalk line and where each stone sits on it */
const GEO = {
  d: {
    w: 1000, h: 780, freq: 0.012, scale: 10,
    path: "M 150 120 C 300 52, 496 84, 520 205 C 543 318, 386 332, 300 420 C 222 502, 468 446, 650 490 C 812 529, 908 548, 860 645",
    pts: [{ x: 150, y: 120 }, { x: 520, y: 205 }, { x: 300, y: 420 }, { x: 650, y: 490 }, { x: 860, y: 645 }],
    start: { x: 150, y: 34 },
  },
  m: {
    w: 360, h: 1120, freq: 0.02, scale: 7,
    path: "M 110 110 C 192 162, 255 218, 255 315 C 255 412, 137 428, 116 520 C 96 612, 250 628, 250 725 C 250 822, 176 848, 150 940",
    pts: [{ x: 110, y: 110 }, { x: 255, y: 315 }, { x: 116, y: 520 }, { x: 250, y: 725 }, { x: 150, y: 940 }],
    start: { x: 110, y: 32 },
  },
} as const;

const LS = {
  get<T>(k: string, fb: T): T {
    try {
      const v = window.localStorage.getItem(k);
      return v == null ? fb : (JSON.parse(v) as T);
    } catch { return fb; }
  },
  set(k: string, v: unknown) {
    try { window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ }
  },
};

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

function PathView({ variant, done, currentId, onOpen }: {
  variant: "d" | "m";
  done: string[];
  currentId: string | null;
  onOpen: (l: Lesson) => void;
}) {
  const g = GEO[variant];
  const fid = `soloChalk-${variant}`;
  return (
    <div className={`solo-path solo-path-${variant}`} style={{ aspectRatio: `${g.w} / ${g.h}` }}>
      <svg className="solo-svg" viewBox={`0 0 ${g.w} ${g.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
        <defs>
          {/* chalk on a schoolyard: turbulence makes the strokes imperfect on purpose */}
          <filter id={fid} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency={g.freq} numOctaves="2" seed="11" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={g.scale} />
          </filter>
        </defs>
        <path d={g.path} className="solo-bed" filter={`url(#${fid})`} />
        <path d={g.path} className="solo-chalk" filter={`url(#${fid})`} />
        {variant === "d" ? (
          <g>
            {/* toghu-inspired geometric accents — quiet, contemporary */}
            <rect x="700" y="120" width="15" height="15" transform="rotate(45 707.5 127.5)" fill="var(--gold)" opacity=".4" />
            <rect x="728" y="132" width="9" height="9" transform="rotate(45 732.5 136.5)" fill="var(--coral)" opacity=".3" />
            <path d="M 96 566 l 13 -11 13 11 M 96 584 l 13 -11 13 11" stroke="var(--emerald)" strokeWidth="3.5" fill="none" opacity=".35" strokeLinecap="round" />
            <circle cx="912" cy="404" r="4.5" fill="var(--indigo)" opacity=".3" />
            <circle cx="928" cy="418" r="3" fill="var(--indigo)" opacity=".22" />
            <rect x="430" y="646" width="12" height="12" transform="rotate(45 436 652)" fill="var(--coral)" opacity=".22" />
            <path d="M 585 120 l 11 -9 11 9" stroke="var(--gold)" strokeWidth="3.5" fill="none" opacity=".4" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <rect x="300" y="150" width="12" height="12" transform="rotate(45 306 156)" fill="var(--gold)" opacity=".38" />
            <path d="M 58 640 l 11 -9 11 9" stroke="var(--emerald)" strokeWidth="3" fill="none" opacity=".35" strokeLinecap="round" />
            <circle cx="310" cy="860" r="4" fill="var(--indigo)" opacity=".28" />
          </g>
        )}
      </svg>

      {variant === "d" && <span className="solo-ghost display" aria-hidden>keep walking</span>}
      <span className="solo-start display" style={{ left: `${(g.start.x / g.w) * 100}%`, top: `${(g.start.y / g.h) * 100}%` }}>
        start here
      </span>

      {LESSONS.map((l, i) => {
        const p = g.pts[i];
        const isDone = done.includes(l.id);
        const state = l.locked ? "is-locked" : isDone ? "is-done" : l.id === currentId ? "is-current" : "";
        return (
          <button
            key={l.id}
            className={`solo-stone ${state}`}
            style={{ left: `${(p.x / g.w) * 100}%`, top: `${(p.y / g.h) * 100}%` }}
            onClick={() => onOpen(l)}
            disabled={!!l.locked}
            aria-label={
              l.locked
                ? `${l.title} — coming soon`
                : `${l.title} — ${isDone ? "completed, tap to walk it again" : "4 signs, tap to start"}`
            }
          >
            <span className="solo-stone-face">
              <FontAwesomeIcon icon={l.locked ? faLock : l.icon} />
            </span>
            {isDone && <span className="solo-tick"><FontAwesomeIcon icon={faCheck} /></span>}
            <span className="solo-stone-label">
              <b>{l.title}</b>
              <i>{l.locked ? l.lockNote : l.words.join(" · ")}</i>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function Solo() {
  const [hydrated, setHydrated] = useState(false);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [done, setDone] = useState<string[]>([]);
  const [active, setActive] = useState<Lesson | null>(null);
  const [evalMode, setEvalMode] = useState(false);   // camera "perform & be judged" practice

  /* hydrate from localStorage (gestsolo.* — initialized 0 / 0 / 5 / []) */
  useEffect(() => {
    setXp(LS.get("gestsolo.xp", 0));
    setStreak(LS.get("gestsolo.streak", 0));
    setHearts(LS.get("gestsolo.hearts", 5));
    setDone(LS.get<string[]>("gestsolo.done", []));
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) LS.set("gestsolo.xp", xp); }, [xp, hydrated]);
  useEffect(() => { if (hydrated) LS.set("gestsolo.streak", streak); }, [streak, hydrated]);
  useEffect(() => { if (hydrated) LS.set("gestsolo.hearts", hearts); }, [hearts, hydrated]);
  useEffect(() => { if (hydrated) LS.set("gestsolo.done", done); }, [done, hydrated]);

  const currentId = useMemo(
    () => LESSONS.find((l) => !l.locked && !done.includes(l.id))?.id ?? null,
    [done],
  );

  const gainXp = useCallback((n: number) => setXp((x) => x + n), []);
  const loseHeart = useCallback(() => setHearts((h) => Math.max(0, h - 1)), []);

  /** mark done + streak +1 (once per day); returns whether the streak grew.
   *  Every finished stone is a resting place — hearts refill for the next stretch. */
  const completeLesson = useCallback((id: string) => {
    setDone((d) => (d.includes(id) ? d : [...d, id]));
    setHearts(5);
    const today = localDay();
    if (LS.get("gestsolo.lastday", "") !== today) {
      LS.set("gestsolo.lastday", today);
      setStreak((s) => s + 1);
      return true;
    }
    return false;
  }, []);

  const nextAfter = useMemo(() => {
    if (!active) return null;
    const n = LESSONS[LESSONS.indexOf(active) + 1];
    return n && !n.locked ? n : null;
  }, [active]);

  const ctaLesson = LESSONS.find((l) => l.id === currentId) ?? LESSONS[0];

  // Uria learns your name — and your Gestificate will carry it (LessonPlayer reads gestsolo.name)
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => {
    try { setName(window.localStorage.getItem("gestsolo.name") || ""); } catch { /* shy browser */ }
  }, []);
  const saveName = () => {
    const n = nameDraft.trim().slice(0, 24);
    if (!n) return;
    try { window.localStorage.setItem("gestsolo.name", n); } catch { /* fine */ }
    setName(n);
  };

  return (
    <main className="solo-main">
      <div className="solo-wrap">

        {/* ------- header strip: mark · product · streak/XP/hearts ------- */}
        <header className="solo-top">
          <a className="solo-gmark display" href="/" aria-label="Gesturia home">G</a>
          <div>
            <div className="solo-brand-name display">Gestsolo</div>
            <div className="solo-brand-tag">Duolingo for hands</div>
          </div>
          <div className="solo-stats" aria-label="Your progress">
            <span className="solo-stat" title="Day streak"><FontAwesomeIcon icon={faFire} /> {streak}</span>
            <span className="solo-stat" title="Experience points"><FontAwesomeIcon icon={faBolt} /> {xp} XP</span>
            <span className="solo-stat" title="Hearts left"><FontAwesomeIcon icon={faHeart} /> {hearts}</span>
          </div>
          <div style={{ marginLeft: "auto" }}><AuthButton /></div>
        </header>

        {active ? (
          <LessonPlayer
            key={active.id}
            lesson={active}
            api={API}
            hearts={hearts}
            streak={streak}
            onXp={gainXp}
            onHeart={loseHeart}
            onComplete={() => completeLesson(active.id)}
            onExit={() => setActive(null)}
            onNext={nextAfter ? () => setActive(nextAfter) : null}
          />
        ) : evalMode ? (
          <EvaluatorView api={API} words={EVAL_WORDS} onXp={gainXp} onExit={() => setEvalMode(false)} />
        ) : (
          <>
            {/* ------- hero: Uria invites you onto the path ------- */}
            <section className="solo-hero">
              <div>
                <div className="g-label">gest’s home ground · every lesson is free</div>
                <h1 className="display">A footpath for <span>your hands</span>.</h1>
                <p className="solo-sub">
                  Five stones, a winding chalk path, and a real 3D teacher waiting inside
                  each one. You don’t read your way through Gestsolo — you watch, you copy, you play.
                </p>
                <div className="solo-hero-cta">
                  <button className="g-pill g-coral" onClick={() => setActive(ctaLesson)}>
                    <FontAwesomeIcon icon={faCirclePlay} />
                    {done.length === 0
                      ? "Start walking — Say hello"
                      : currentId
                        ? `Continue — ${ctaLesson.title}`
                        : "Walk it again"}
                  </button>
                  <button className="g-pill g-soft" onClick={() => setEvalMode(true)} title="Sign to your camera and get scored">
                    <FontAwesomeIcon icon={faVideo} /> Practice with camera
                  </button>
                  <span className="solo-mins">≈ 3 minutes a stone · +40 XP each</span>
                </div>
              </div>
              <aside className="solo-bubble" role="note">
                <span className="solo-u display">U</span>
                {name ? (
                  <p>
                    “Welcome back, <b>{name}</b>. The path remembered you.
                    Watch my hands closely — ready?”
                  </p>
                ) : (
                  <div>
                    <p style={{ marginBottom: 10 }}>
                      “I’m <b>Uria</b>. I’m ten, and my hands say more than my mouth ever will.
                      What should I call <i>you</i>? It goes on your Gestificate — so spell it proudly.”
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="g-input"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveName()}
                        placeholder="your name"
                        maxLength={24}
                        aria-label="Tell Uria your name"
                        style={{ padding: ".55rem .8rem", fontSize: 14, flex: 1 }}
                      />
                      <button className="g-pill g-gold" onClick={saveName} disabled={!nameDraft.trim()}
                        style={{ padding: ".55rem .95rem", fontSize: 13 }}>
                        That’s me
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            </section>

            {/* ------- the path: five stones through a warm country ------- */}
            <section className="solo-pathsec" aria-label="Lesson path">
              <div className="solo-pathhead">
                <div>
                  <div className="g-label">the path</div>
                  <h2 className="display">Five stones to your first <em>Gestificate</em>.</h2>
                </div>
                <span className="solo-pathnote">
                  {done.length} of 4 stones walked · tap a stone to step in
                </span>
              </div>
              <PathView variant="d" done={done} currentId={currentId} onOpen={setActive} />
              <PathView variant="m" done={done} currentId={currentId} onOpen={setActive} />
            </section>
          </>
        )}

        {/* ------- footer ------- */}
        <footer className="solo-footer">
          <div>
            <span className="solo-gmark-s display">G</span>
            Gest walks the path with you. — <i>Gesturia, a country of gestures</i>
          </div>
          <nav>
            <a href="/studio">Gestlingua</a>
            <a href="/evaluate">sign judge</a>
            <a href="/">home</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
