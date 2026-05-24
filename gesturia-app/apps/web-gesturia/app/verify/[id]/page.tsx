"use client";
/** GESTIFY — /verify/[id] (the verdict).
 *  VALID     → slim emerald verdict bar above THE CERTIFICATE, rendered full.
 *  NOT FOUND → ink-dark bar, respectful and unambiguous. Dignity even in rejection.
 *  Registry: built-in demo entries + localStorage["gestify.issued"] (Gestsolo writes there). */

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCircleQuestion, faPrint, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { PageShell } from "../parts";
import Certificate from "../Certificate";
import { SERIAL_RE, normalizeSerial, lookupSerial, type Gestificate } from "../registry";

type Verdict = "checking" | "valid" | "notfound" | "badformat";

export default function VerifyResult({ params }: { params: { id: string } }) {
  let decoded = params.id || "";
  try { decoded = decodeURIComponent(decoded); } catch { /* keep raw */ }
  const serial = normalizeSerial(decoded);

  const [verdict, setVerdict] = useState<Verdict>("checking");
  const [cert, setCert] = useState<Gestificate | null>(null);

  useEffect(() => {
    // a deliberate beat — the registry is being consulted, and it reads that way
    const t = setTimeout(() => {
      if (!SERIAL_RE.test(serial)) { setVerdict("badformat"); return; }
      const hit = lookupSerial(serial);
      if (hit) { setCert(hit); setVerdict("valid"); }
      else setVerdict("notfound");
    }, 450);
    return () => clearTimeout(t);
  }, [serial]);

  useEffect(() => {
    document.title =
      verdict === "valid" && cert
        ? `${cert.holder} — Gestificate ${serial} · Gestify`
        : `Verify ${serial || "a Gestificate"} — Gestify · Gesturia`;
  }, [verdict, cert, serial]);

  return (
    <PageShell>
      <section style={{ flex: 1, padding: "22px 0 8px" }}>

        {/* ---------- CHECKING ---------- */}
        {verdict === "checking" && (
          <div className="g-card gfy-in" role="status" style={{ maxWidth: 660, margin: "60px auto 0",
            padding: "26px 28px", display: "flex", alignItems: "center", gap: 14 }}>
            <span aria-hidden="true" style={{ display: "flex", gap: 5 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: 999, background: "var(--emerald)",
                  animation: `gfyPulse 1.1s ${i * 0.18}s ease-in-out infinite` }} />
              ))}
            </span>
            <span style={{ fontSize: 14.5, color: "var(--ink-soft)" }}>
              Checking the public record…
              <span style={{ display: "block", fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                Vérification du registre public…
              </span>
            </span>
          </div>
        )}

        {/* ---------- VALID ---------- */}
        {verdict === "valid" && cert && (
          <>
            <div className="gfy-in gfy-chrome" style={{ maxWidth: 660, margin: "0 auto 16px",
              display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10,
              background: "var(--emerald)", color: "#fff", borderRadius: 13, padding: "9px 14px",
              boxShadow: "0 10px 26px rgba(62,142,90,.28)" }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 17 }} />
              <div style={{ fontSize: 13.5, lineHeight: 1.35 }}>
                <strong>Valid</strong> — issued by Gesturia · verified just now
                <span style={{ display: "block", fontSize: 11, opacity: .85, fontStyle: "italic" }}>
                  Valide — délivré par Gesturia · vérifié à l'instant
                </span>
              </div>
              <button type="button" onClick={() => window.print()}
                className="g-pill"
                style={{ marginLeft: "auto", padding: ".5rem .95rem", fontSize: 12.5,
                  background: "rgba(255,255,255,.14)", color: "#fff",
                  border: "1px solid rgba(255,255,255,.4)" }}>
                <FontAwesomeIcon icon={faPrint} /> Print / save
              </button>
            </div>

            <div className="gfy-in" style={{ animationDelay: ".1s" }}>
              <Certificate cert={cert} />
            </div>

            <div className="gfy-chrome gfy-in" style={{ maxWidth: 660, margin: "16px auto 0",
              display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
              gap: 10, fontSize: 12.5, color: "var(--muted)", animationDelay: ".2s" }}>
              <span>Prints clean on A4 — the certificate alone, worth framing.</span>
              <a className="gfy-link" href="/verify">Verify another serial <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 10 }} /></a>
            </div>
          </>
        )}

        {/* ---------- NOT FOUND / BAD FORMAT ---------- */}
        {(verdict === "notfound" || verdict === "badformat") && (
          <div style={{ maxWidth: 660, margin: "40px auto 0" }}>
            <div className="gfy-in" style={{ display: "flex", alignItems: "center", gap: 12,
              background: "var(--ink)", color: "var(--cream)", borderRadius: 13, padding: "13px 16px" }}>
              <FontAwesomeIcon icon={faCircleQuestion} style={{ fontSize: 17, color: "var(--gold)" }} />
              <div style={{ fontSize: 14.5, lineHeight: 1.4 }}>
                {verdict === "notfound" ? (
                  <>
                    <strong>This serial is not on the public record.</strong>
                    <span style={{ display: "block", fontSize: 11.5, opacity: .75, fontStyle: "italic" }}>
                      Ce numéro ne figure pas au registre public.
                    </span>
                  </>
                ) : (
                  <>
                    <strong>That doesn't read as a Gestificate serial.</strong>
                    <span style={{ display: "block", fontSize: 11.5, opacity: .75, fontStyle: "italic" }}>
                      Ce numéro n'a pas le format d'un Gestificat.
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="g-card gfy-in" style={{ marginTop: 14, padding: "22px 24px", animationDelay: ".1s" }}>
              <div className="g-label" style={{ marginBottom: 8 }}>You searched · Vous avez cherché</div>
              <div className="gfy-mono" style={{ fontSize: 16, letterSpacing: ".08em",
                padding: "8px 12px", background: "var(--panel-2)", border: "1px solid var(--line)",
                borderRadius: 9, width: "fit-content", maxWidth: "100%", overflowWrap: "anywhere" }}>
                {serial || "—"}
              </div>
              <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--ink-soft)" }}>
                Check the number — every valid Gestificate verifies here, no exceptions and no expiry.
                Serials read <span className="gfy-mono" style={{ fontSize: 12.5 }}>GST-YYYYMM-XXXXXXXX</span> and
                appear at the foot of the certificate, beside the seal.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                <a href="/verify" className="g-pill g-dark" style={{ textDecoration: "none", fontSize: 13.5, padding: ".7rem 1.2rem" }}>
                  Try another serial
                </a>
                <a href="/verify/GST-202607-DEMO0001" className="g-chip" style={{ textDecoration: "none" }}>
                  <span className="dot" style={{ background: "var(--gold)" }} />
                  see a valid one:&nbsp;<span className="gfy-mono" style={{ fontWeight: 600 }}>GST-202607-DEMO0001</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
