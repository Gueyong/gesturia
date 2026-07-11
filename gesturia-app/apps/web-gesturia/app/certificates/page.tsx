"use client";
/** /certificates — the signed-in learner's earned Gestificates, loaded from the live database. Each card
 *  links to the public /verify page so a certificate can be independently confirmed. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCertificate, faCircleCheck, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { api } from "../../lib/api";
import type { CertificateOut } from "@gesturia/core";
import { useAuth } from "../../components/AuthProvider";
import AuthButton from "../../components/AuthButton";

export default function CertificatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [certs, setCerts] = useState<CertificateOut[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login?next=/certificates"); return; }
    api.learn.certificates()
      .then((c) => setCerts(Array.isArray(c) ? c : []))
      .catch(() => setErr("Couldn't load your certificates. Please try again."));
  }, [user, loading, router]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--panel-2,#F8F2E4)", padding: "22px 20px 48px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <a href="/" className="display" style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center",
            color: "#fff", fontWeight: 800, background: "linear-gradient(135deg,var(--coral,#E8553A),var(--gold,#F4B81F))", textDecoration: "none" }}>G</a>
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>Your Gestificates</div>
            <div style={{ fontSize: 12.5, color: "var(--muted,#9C9179)" }}>earned by completing Gestsolo courses</div>
          </div>
          <div style={{ marginLeft: "auto" }}><AuthButton /></div>
        </header>

        {err && <p style={{ color: "var(--coral)", fontSize: 14 }}>{err}</p>}

        {certs === null && !err && (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading your certificates…</p>
        )}

        {certs && certs.length === 0 && (
          <section className="g-card" style={{ padding: 40, textAlign: "center" }}>
            <FontAwesomeIcon icon={faCertificate} style={{ fontSize: 40, color: "var(--gold,#F4B81F)", opacity: 0.7 }} />
            <h2 className="display" style={{ fontSize: 18, fontWeight: 800, margin: "14px 0 6px" }}>No certificates yet</h2>
            <p style={{ color: "var(--ink-soft,#6C6455)", fontSize: 14, margin: "0 0 16px" }}>
              Finish a full course in Gestsolo and your first Gestificate — carrying your name — appears here.
            </p>
            <a href="/solo" className="g-pill g-coral" style={{ textDecoration: "none" }}>
              Go to Gestsolo <FontAwesomeIcon icon={faArrowRight} />
            </a>
          </section>
        )}

        <div style={{ display: "grid", gap: 14 }}>
          {(certs || []).map((c) => (
            <article key={c.certificate_number} className="g-card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, display: "grid", placeItems: "center", flexShrink: 0,
                color: "#fff", fontSize: 24, background: "linear-gradient(135deg,var(--gold,#F4B81F),var(--coral,#E8553A))" }}>
                <FontAwesomeIcon icon={faCertificate} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 16, fontWeight: 800 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft,#6C6455)" }}>
                  {c.course_title ? `${c.course_title} · ` : ""}Issued {new Date(c.issued_at).toLocaleDateString()}
                  {typeof c.score === "number" ? ` · ${Math.round(c.score)}%` : ""}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted,#9C9179)", marginTop: 3, fontFamily: "var(--font-mono, monospace)" }}>
                  {c.certificate_number}
                  {c.is_valid !== false && (
                    <span style={{ color: "var(--emerald,#1F9D69)", marginLeft: 8 }}>
                      <FontAwesomeIcon icon={faCircleCheck} /> valid
                    </span>
                  )}
                </div>
              </div>
              <a href={`/verify/${encodeURIComponent(c.certificate_number)}`} className="g-pill g-soft" style={{ textDecoration: "none", flexShrink: 0 }}>
                Verify
              </a>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
