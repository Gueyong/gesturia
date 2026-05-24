"use client";
/** The GESTIFICATE — a national document, not a web card.
 *  Cream paper, toghu border bands, gold seal, holder's name in emerald ink,
 *  serial in tabular monospace, Lea's signature, honest scan pattern.
 *  Carries its own print stylesheet: window.print() outputs the certificate alone on A4. */

import { formatDate, type Gestificate } from "./registry";
import { GoldSeal, ScanPattern, ToghuBand } from "./parts";

function Ornament() {
  return (
    <svg width="190" height="12" viewBox="0 0 190 12" aria-hidden="true" style={{ display: "block", margin: "0 auto" }}>
      <line x1="0" y1="6" x2="78" y2="6" stroke="#D8B84E" strokeWidth="1" />
      <path d="M95 1 L101 6 L95 11 L89 6 Z" fill="none" stroke="#B8912B" strokeWidth="1.2" />
      <path d="M95 3.6 L97.8 6 L95 8.4 L92.2 6 Z" fill="#B8912B" />
      <line x1="112" y1="6" x2="190" y2="6" stroke="#D8B84E" strokeWidth="1" />
    </svg>
  );
}

function Signature() {
  return (
    <svg className="gfy-sig" viewBox="0 0 150 54" width="132" height="48" aria-hidden="true"
      style={{ display: "block", margin: "0 auto" }}>
      {/* "Lea" — one flowing handwritten stroke */}
      <path className="gfy-sig-path" pathLength={1}
        d="M22 7 C17 18 12 30 10 39 C9 44 13 46 18 42 C23 38 26 32 27 34
           C25 40 28 44 33 42 C38 40 41 35 38 32.5 C35 30 31 34 32 38
           C33 43 39 44 44 41 C47 39 50 35 52 36 C48 34.6 43.5 38 43.5 42.5
           C43.5 46 48 46.5 51.5 43.5 C54 41.3 55.4 38 55.6 35.6
           C55.4 39.6 56 44 60.5 43.2 C68 41.8 78 35 86 27"
        fill="none" stroke="#24405B" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      {/* the registrar's flourish */}
      <path className="gfy-sig-path gfy-sig-flourish" pathLength={1}
        d="M8 49 C34 52 62 46 84 40" fill="none" stroke="#24405B" strokeWidth="1.2"
        strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export default function Certificate({ cert }: { cert: Gestificate }) {
  const fields: Array<{ en: string; fr: string; value: string }> = [
    { en: "Level", fr: "Niveau", value: cert.level || "—" },
    { en: "Score", fr: "Note", value: `${cert.score} / 100` },
    { en: "Issued", fr: "Délivré le", value: formatDate(cert.date) },
    { en: "Surface", fr: "Plateforme", value: cert.surface },
  ];

  return (
    <article className="gfy-cert gfy-print" aria-label={`Gestificate ${cert.serial} — ${cert.holder}`}>
      <style>{`
        .gfy-cert {
          position: relative; overflow: hidden;
          max-width: 660px; margin: 0 auto;
          background-color: #FCF7EB;
          background-image:
            radial-gradient(ellipse at 50% -18%, rgba(244,184,31,.10), transparent 58%),
            repeating-linear-gradient(0deg, rgba(28,26,23,.015) 0 1px, transparent 1px 3px);
          border: 1px solid #D8B84E;
          border-radius: 6px;
          box-shadow: var(--shadow-pop);
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .gfy-cert-frame { position: relative; margin: 9px; border: 1px solid rgba(28,26,23,.4); }
        .gfy-cert-body { position: relative; padding: 26px clamp(22px, 6vw, 52px) 30px; text-align: center; }
        .gfy-watermark {
          position: absolute; inset: 0; display: grid; place-items: center;
          pointer-events: none; user-select: none; overflow: hidden;
        }
        .gfy-watermark span {
          font-family: var(--font-display, Space Grotesk), sans-serif; font-weight: 700;
          font-size: 430px; line-height: 1; color: #1C1A17; opacity: .035; transform: rotate(-10deg);
        }
        .gfy-fields {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 10px;
          margin: 26px auto 0; max-width: 520px;
          border-top: 1px solid #E4D6AE; border-bottom: 1px solid #E4D6AE; padding: 16px 0;
        }
        @media (max-width: 560px) { .gfy-fields { grid-template-columns: repeat(2, 1fr); } }
        .gfy-bottomrow {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 18px; margin-top: 28px; text-align: left;
        }
        @media (max-width: 560px) { .gfy-bottomrow { flex-wrap: wrap; justify-content: center; text-align: center; } }
        .gfy-sig-path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: gfySign 1.1s .55s cubic-bezier(.5,0,.3,1) forwards; }
        .gfy-sig-flourish { animation-delay: 1.35s; animation-duration: .6s; }
        @keyframes gfySign { to { stroke-dashoffset: 0; } }

        /* ---- print: the certificate alone, clean on A4 ---- */
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .gfy-print, .gfy-print * { visibility: visible !important; }
          .gfy-print {
            position: absolute !important; left: 50% !important; top: 0 !important;
            transform: translateX(-50%) !important;
            width: 178mm !important; max-width: none !important; margin: 0 !important;
            box-shadow: none !important; border-radius: 0 !important;
          }
          .gfy-print, .gfy-print * { animation: none !important; transition: none !important; }
          .gfy-sig-path { stroke-dasharray: none !important; stroke-dashoffset: 0 !important; }
        }
      `}</style>

      <ToghuBand height={22} />

      <div className="gfy-cert-frame">
        <div className="gfy-watermark" aria-hidden="true"><span>G</span></div>

        <div className="gfy-cert-body">
          {/* masthead */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 10.5, letterSpacing: ".28em", color: "var(--ink-soft)", fontWeight: 600 }}>
              GESTURIA
            </span>
            <span className="gfy-mono" style={{ fontSize: 11.5, color: "var(--ink)", border: "1px solid #E0D2A8",
              borderRadius: 5, padding: "3px 8px", background: "rgba(255,253,248,.7)", whiteSpace: "nowrap" }}>
              N° {cert.serial}
            </span>
          </div>
          <div style={{ fontSize: 10, letterSpacing: ".2em", color: "var(--muted)", marginTop: 4 }}>
            A COUNTRY OF GESTURES · UN PAYS DE GESTES
          </div>

          <h1 className="display" style={{ margin: "22px 0 4px", fontSize: "clamp(19px, 4.2vw, 26px)",
            letterSpacing: ".13em", fontWeight: 700, color: "var(--ink)" }}>
            CERTIFICATE OF PROFICIENCY
          </h1>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic", marginBottom: 14 }}>
            Attestation de compétence en langue des signes
          </div>

          <Ornament />

          {/* the grant */}
          <div style={{ marginTop: 22, fontSize: 12, letterSpacing: ".14em", color: "var(--muted)", fontWeight: 600 }}>
            THIS CERTIFIES THAT · CECI CERTIFIE QUE
          </div>
          <div className="display" style={{ margin: "10px 0 2px", fontSize: "clamp(30px, 7vw, 44px)",
            fontWeight: 700, lineHeight: 1.08, color: "var(--emerald)" }}>
            {cert.holder}
          </div>
          <svg width="120" height="6" viewBox="0 0 120 6" aria-hidden="true" style={{ display: "block", margin: "6px auto 0" }}>
            <path d="M2 4 C40 0.5 80 0.5 118 4" fill="none" stroke="#D8B84E" strokeWidth="1.6" strokeLinecap="round" />
          </svg>

          <div style={{ marginTop: 16, fontSize: 12, letterSpacing: ".12em", color: "var(--muted)", fontWeight: 600 }}>
            HAS DEMONSTRATED PROFICIENCY IN · A DÉMONTRÉ SA MAÎTRISE DE
          </div>
          <div className="display" style={{ marginTop: 8, fontSize: "clamp(17px, 3.6vw, 21px)", fontWeight: 600, color: "var(--ink)" }}>
            {cert.course}
          </div>
          {cert.language && (
            <div style={{ marginTop: 5, fontSize: 11, letterSpacing: ".14em", color: "var(--ink-soft)" }}>
              {cert.language.toUpperCase()}
            </div>
          )}

          {/* diploma fields */}
          <dl className="gfy-fields" style={{ margin: "26px auto 0" }}>
            {fields.map((f) => (
              <div key={f.en}>
                <dt style={{ fontSize: 10, letterSpacing: ".16em", fontWeight: 700, color: "var(--muted)" }}>
                  {f.en.toUpperCase()}
                  <span style={{ display: "block", fontWeight: 500, fontSize: 8.5, letterSpacing: ".08em",
                    textTransform: "none", marginTop: 1, color: "#B3A88C" }}>{f.fr}</span>
                </dt>
                <dd className="display" style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* authority row: scan pattern · signature · seal */}
          <div className="gfy-bottomrow">
            <div style={{ flex: "0 0 auto" }}>
              <div style={{ border: "1px solid #E0D2A8", borderRadius: 6, padding: 5, background: "#FFFDF8", width: "fit-content" }}>
                <ScanPattern serial={cert.serial} size={88} />
              </div>
              <div className="gfy-mono" style={{ fontSize: 8.5, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.5 }}>
                verify at gesturia.cm<br />/verify/{cert.serial}
              </div>
            </div>

            <div style={{ flex: "1 1 auto", textAlign: "center", alignSelf: "flex-end", paddingBottom: 6 }}>
              <Signature />
              <div style={{ width: 180, maxWidth: "100%", borderTop: "1px solid #2E2A24", margin: "2px auto 6px" }} />
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>Lea Registrar — Gesturia</div>
              <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: ".08em" }}>REGISTRAR · REGISTRAIRE</div>
            </div>

            <div style={{ flex: "0 0 auto", transform: "rotate(-7deg)", marginBottom: -4 }}>
              <GoldSeal size={132} />
            </div>
          </div>

          {/* footline */}
          <div style={{ marginTop: 24, fontSize: 9.5, lineHeight: 1.6, color: "var(--muted)" }}>
            This document is valid only while its serial verifies on the public record at gesturia.cm/verify.
            <br />
            Ce document n'est valable que si son numéro se vérifie au registre public. · Gestify v1 · MINESEC · INJS Yaoundé
          </div>
        </div>
      </div>

      <ToghuBand height={12} />
    </article>
  );
}
