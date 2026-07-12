"use client";
/** /learn — the real, account-backed curriculum (live from the database). Pick a course, walk its units
 *  and lessons; progress, XP and hearts are persisted to your account (unlike the Gestsolo demo path). */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faFire, faHeart, faLock, faCircleCheck, faCirclePlay, faGem } from "@fortawesome/free-solid-svg-icons";
import { api } from "../../lib/api";
import type { CourseOut, CourseDetail, StatsResponse } from "@gesturia/core";
import { useAuth } from "../../components/AuthProvider";
import AuthButton from "../../components/AuthButton";

export default function LearnPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<CourseOut[]>([]);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login?next=/learn"); return; }
    api.learn.stats().then(setStats).catch(() => {});
    api.learn.courses().then((p) => {
      const items = (p as any).items ?? p;
      setCourses(items);
      if (items[0]) api.learn.course(items[0].id).then(setDetail).catch(() => {});
    }).catch(() => {});
  }, [user, loading, router]);

  const openCourse = useCallback((id: number) => { setDetail(null); api.learn.course(id).then(setDetail).catch(() => {}); }, []);

  const startLesson = useCallback(async (lessonId: number) => {
    if (!detail || busy) return;
    setBusy(true);
    try { await api.learn.enroll(detail.id); } catch { /* already enrolled — fine */ }
    router.push(`/learn/lesson/${lessonId}?course=${detail.id}`);
  }, [detail, busy, router]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--panel-2,#F8F2E4)", padding: "22px 20px 48px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <a href="/" className="display" style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center",
            color: "#fff", fontWeight: 800, background: "linear-gradient(135deg,var(--coral,#E8553A),var(--gold,#F4B81F))", textDecoration: "none" }}>G</a>
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>Your courses</div>
            <div style={{ fontSize: 12.5, color: "var(--muted,#9C9179)" }}>real curriculum · progress saved to your account</div>
          </div>
          {stats && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 13, fontWeight: 700, color: "var(--ink-soft,#6C6455)" }}>
              <span title="Streak"><FontAwesomeIcon icon={faFire} style={{ color: "var(--coral)" }} /> {stats.streak_count}</span>
              <span title="XP"><FontAwesomeIcon icon={faBolt} style={{ color: "var(--gold)" }} /> {stats.xp}</span>
              <span title="Gems"><FontAwesomeIcon icon={faGem} style={{ color: "var(--indigo,#5B6EE1)" }} /> {stats.gems}</span>
              <span title="Hearts"><FontAwesomeIcon icon={faHeart} style={{ color: "var(--coral)" }} /> {stats.hearts}</span>
            </div>
          )}
          <div style={{ marginLeft: stats ? 6 : "auto" }}><AuthButton /></div>
        </header>

        {courses.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {courses.map((cc) => (
              <button key={cc.id} onClick={() => openCourse(cc.id)} className="g-pill"
                style={{ fontWeight: 700, background: detail?.id === cc.id ? "var(--coral)" : "var(--panel-3,#F1E8D4)", color: detail?.id === cc.id ? "#fff" : "var(--ink-soft)" }}>
                {cc.title}
              </button>
            ))}
          </div>
        )}

        {!detail && <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading your curriculum…</p>}

        {detail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="g-card" style={{ padding: "16px 18px" }}>
              <div className="display" style={{ fontSize: 18, fontWeight: 800 }}>{detail.title}</div>
              {detail.description && <p style={{ color: "var(--ink-soft,#6C6455)", fontSize: 13.5, margin: "4px 0 0" }}>{detail.description}</p>}
            </div>

            {detail.units.map((u) => (
              <section key={u.id}>
                <div className="g-label" style={{ marginBottom: 8 }}>{u.title}</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {u.lessons.map((l) => {
                    const done = l.is_completed, locked = l.is_locked;
                    return (
                      <button key={l.id} disabled={locked || busy} onClick={() => startLesson(l.id)}
                        className="g-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textAlign: "left",
                          cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.55 : 1, border: done ? "1.5px solid var(--emerald,#1F9D69)" : undefined }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, color: "#fff",
                          background: done ? "var(--emerald,#1F9D69)" : locked ? "var(--muted,#9C9179)" : "linear-gradient(135deg,var(--coral,#E8553A),var(--gold,#F4B81F))" }}>
                          <FontAwesomeIcon icon={done ? faCircleCheck : locked ? faLock : faCirclePlay} />
                        </span>
                        <span style={{ flex: 1 }}>
                          <b style={{ fontSize: 14.5 }}>{l.title}</b>
                          <span style={{ display: "block", fontSize: 12, color: "var(--muted,#9C9179)" }}>
                            {done ? "Completed — tap to practice again" : locked ? "Locked" : `+${l.xp_reward} XP`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer style={{ marginTop: 26, fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
          <a href="/solo" style={{ color: "var(--coral)", textDecoration: "none", fontWeight: 600 }}>Gestsolo path</a>
          {" · "}<a href="/certificates" style={{ color: "var(--coral)", textDecoration: "none", fontWeight: 600 }}>certificates</a>
          {" · "}<a href="/" style={{ color: "var(--coral)", textDecoration: "none", fontWeight: 600 }}>home</a>
        </footer>
      </div>
    </main>
  );
}
