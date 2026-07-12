"use client";
/** /learn/lesson/[id] — the real exercise player. Steps through a DB lesson's exercises, grades each via
 *  the API (hearts drop on a wrong answer), shows the 3D avatar for a derivable target sign, and persists
 *  XP / streak on completion. ?course=<id> is used to ensure enrollment (submit requires it). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faCircleCheck, faCircleXmark, faArrowRight, faTrophy, faCertificate } from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "../../../../components/MeshSigner";
import { api } from "../../../../lib/api";
import type { ExerciseOut, LessonCompleteResponse } from "@gesturia/core";
import { useAuth } from "../../../../components/AuthProvider";

const API = typeof window !== "undefined"
  ? `http://${window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname}:8020`
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8020");

/** derive a signable target word/letter from a produce-style prompt, e.g. "Fingerspell the letter 'A'". */
function deriveTarget(ex: ExerciseOut): string | null {
  if (ex.type === "sign_to_text") return null;          // answer is hidden — don't reveal it via the avatar
  const m = ex.prompt.match(/['"“”]([A-Za-z][A-Za-z .'-]*)['"“”]/);
  if (m) return m[1];
  if (ex.type === "fingerspell") { const c = ex.prompt.match(/letter\s+([A-Za-z])/i); if (c) return c[1]; }
  return null;
}

export default function LessonPlayer() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const params = useParams();
  const lessonId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const courseId = typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("course")) : 0;

  const [exs, setExs] = useState<ExerciseOut[] | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<{ is_correct: boolean; correct_answer: string; hearts_remaining: number } | null>(null);
  const [hearts, setHearts] = useState(5);
  const [correct, setCorrect] = useState(0);
  const [clip, setClip] = useState<MeshClip | null>(null);
  const [done, setDone] = useState<LessonCompleteResponse | null>(null);
  const [started] = useState(() => (typeof performance !== "undefined" ? performance.now() : 0));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace(`/login?next=/learn/lesson/${lessonId}`); return; }
    (async () => {
      if (courseId) { try { await api.learn.enroll(courseId); } catch { /* already enrolled */ } }
      try { await api.learn.startLesson(lessonId); } catch { /* re-practice */ }
      try {
        const list = await api.learn.lessonExercises(lessonId);
        setExs(list); setHearts(5);
      } catch { setExs([]); }
    })();
  }, [user, loading, lessonId, courseId, router]);

  const ex = exs && i < exs.length ? exs[i] : null;

  // load the 3D avatar for a derivable target sign (best-effort; hidden if translate fails)
  useEffect(() => {
    setClip(null);
    if (!ex) return;
    const target = deriveTarget(ex);
    // single letters (fingerspell) don't resolve to a standalone mesh sign — skip to avoid dead requests
    if (!target || target.replace(/[^A-Za-z]/g, "").length < 2) return;
    let alive = true;
    fetch(`${API}/v1/smplx/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: target }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (alive && m?.token) setClip({ vertsUrl: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`, frames: m.frames, nverts: m.nverts, fps: m.fps }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [ex]);

  const submit = useCallback(async () => {
    if (!ex || busy || !answer.trim()) return;
    setBusy(true);
    try {
      const r = await api.learn.submitExercise(ex.id, answer.trim(), 4);
      setResult({ is_correct: r.is_correct, correct_answer: r.correct_answer, hearts_remaining: r.hearts_remaining });
      setHearts(r.hearts_remaining);
      if (r.is_correct) setCorrect((c) => c + 1);
    } catch { /* keep the learner moving even if a submit hiccups */ setResult({ is_correct: true, correct_answer: answer, hearts_remaining: hearts }); }
    finally { setBusy(false); }
  }, [ex, answer, busy, hearts]);

  const next = useCallback(async () => {
    setResult(null); setAnswer("");
    if (exs && i + 1 >= exs.length) {
      setBusy(true);
      try {
        const t = Math.round(((typeof performance !== "undefined" ? performance.now() : 0) - started) / 1000);
        const res = await api.learn.completeLesson(lessonId, Math.max(1, t));
        setDone(res); await refresh();       // pull the account's new XP into the header badge
      } catch { setDone({ xp_earned: 0, total_xp: 0, level: 1, streak_count: 0, gems_earned: 0, achievements_unlocked: [] }); }
      finally { setBusy(false); }
    } else {
      setI((n) => n + 1);
    }
  }, [exs, i, lessonId, started, refresh]);

  const options = useMemo(() => (ex?.options && ex.options.length ? ex.options : null), [ex]);

  // ---- completion screen ----
  if (done) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "var(--panel-2,#F8F2E4)" }}>
        <div className="g-card" style={{ width: "100%", maxWidth: 420, padding: 30, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, margin: "0 auto 12px", borderRadius: "50%", display: "grid", placeItems: "center",
            color: "#fff", fontSize: 32, background: "linear-gradient(135deg,var(--gold,#F4B81F),var(--coral,#E8553A))" }}>
            <FontAwesomeIcon icon={faTrophy} />
          </div>
          <h1 className="display" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Lesson complete!</h1>
          <p style={{ color: "var(--ink-soft,#6C6455)", fontSize: 14, margin: "0 0 16px" }}>
            {correct}/{exs?.length ?? 0} correct · <b style={{ color: "var(--gold,#C8890A)" }}>+{done.xp_earned} XP</b>
            {done.gems_earned ? ` · +${done.gems_earned} gems` : ""}
          </p>
          {done.achievements_unlocked?.length > 0 && (
            <p style={{ fontSize: 13, color: "var(--emerald,#1F9D69)", fontWeight: 700 }}>🏅 {done.achievements_unlocked.join(", ")}</p>
          )}
          {done.certificate && (
            <a href="/certificates" className="g-pill g-gold" style={{ textDecoration: "none", margin: "8px auto 0" }}>
              <FontAwesomeIcon icon={faCertificate} /> You earned a Gestificate!
            </a>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
            <a href="/learn" className="g-pill g-coral" style={{ textDecoration: "none" }}>Back to courses <FontAwesomeIcon icon={faArrowRight} /></a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--panel-2,#F8F2E4)", padding: "18px 20px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* progress + hearts */}
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <a href="/learn" style={{ color: "var(--muted,#9C9179)", textDecoration: "none", fontSize: 20 }}>✕</a>
          <div style={{ flex: 1, height: 10, borderRadius: 999, background: "var(--panel-3,#F1E8D4)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: "var(--emerald,#1F9D69)", transition: "width .3s",
              width: `${exs && exs.length ? Math.round((i / exs.length) * 100) : 0}%` }} />
          </div>
          <span style={{ color: "var(--coral,#E8553A)", fontWeight: 800, fontSize: 15 }}>
            <FontAwesomeIcon icon={faHeart} /> {hearts}
          </span>
        </header>

        {!exs && <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading lesson…</p>}
        {exs && exs.length === 0 && <p style={{ color: "var(--coral)", fontSize: 14 }}>This lesson has no exercises yet.</p>}

        {ex && (
          <section className="g-card" style={{ padding: 20 }}>
            <div className="g-label" style={{ marginBottom: 6 }}>{ex.type.replace(/_/g, " ")}</div>
            <h2 className="display" style={{ fontSize: 19, fontWeight: 800, margin: "0 0 14px" }}>{ex.prompt}</h2>

            {/* the sign to watch: 3D avatar for a derivable target, else the seeded media clip */}
            {clip ? (
              <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line,#E8DFC9)", marginBottom: 14 }}>
                <MeshSigner queue={[clip]} loop rate={0.75} hint={false} />
              </div>
            ) : ex.media_url ? (
              <video src={`${API}${ex.media_url}`} autoPlay loop muted playsInline
                style={{ width: "100%", borderRadius: 14, marginBottom: 14, background: "#0c1122" }}
                onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }} />
            ) : null}

            {/* answer interaction */}
            {!result && (options ? (
              <div style={{ display: "grid", gap: 8 }}>
                {options.map((o) => (
                  <button key={o} onClick={() => setAnswer(o)} className="g-card"
                    style={{ padding: "12px 14px", textAlign: "left", fontSize: 15, fontWeight: 600, cursor: "pointer",
                      border: answer === o ? "2px solid var(--coral,#E8553A)" : "1.5px solid var(--line,#E8DFC9)" }}>
                    {o}
                  </button>
                ))}
              </div>
            ) : (
              <input className="g-input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer"
                onKeyDown={(e) => e.key === "Enter" && submit()} style={{ width: "100%", padding: ".7rem .85rem", fontSize: 15 }} />
            ))}

            {/* result banner */}
            {result && (
              <div style={{ marginTop: 6, padding: "12px 14px", borderRadius: 12, fontWeight: 700,
                background: result.is_correct ? "rgba(31,157,105,.12)" : "rgba(207,70,41,.1)",
                color: result.is_correct ? "var(--emerald,#1F9D69)" : "var(--coral,#CF4629)" }}>
                <FontAwesomeIcon icon={result.is_correct ? faCircleCheck : faCircleXmark} />{" "}
                {result.is_correct ? "Correct!" : `Answer: ${result.correct_answer}`}
                {ex.hint && !result.is_correct && <div style={{ fontWeight: 500, fontSize: 13, marginTop: 4, color: "var(--ink-soft)" }}>{ex.hint}</div>}
              </div>
            )}

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              {!result ? (
                <button className="g-pill g-coral" disabled={!answer.trim() || busy} onClick={submit}
                  style={{ opacity: !answer.trim() || busy ? 0.6 : 1 }}>Check</button>
              ) : (
                <button className="g-pill g-coral" disabled={busy} onClick={next}>
                  {exs && i + 1 >= exs.length ? "Finish" : "Continue"} <FontAwesomeIcon icon={faArrowRight} />
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
