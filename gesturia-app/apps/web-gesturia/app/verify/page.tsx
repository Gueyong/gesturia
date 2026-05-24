"use client";
/** GESTIFY — /verify (the lookup).
 *  The page an employer in Douala or a university in Canada opens with no login
 *  and trusts in three seconds. Quiet, spacious, serious — a single input. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { PageShell, GoldSeal } from "./parts";
import { DEMO_SERIAL, SERIAL_RE, normalizeSerial } from "./registry";

export default function VerifyLookup() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  useEffect(() => { document.title = "Verify a Gestificate — Gestify · Gesturia"; }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = normalizeSerial(raw);
    if (!SERIAL_RE.test(s)) {
      setErr("Serials read GST-YYYYMM-XXXXXXXX — you'll find it at the foot of the certificate.");
      inputRef.current?.focus();
      return;
    }
    setGoing(true);
    router.push(`/verify/${s}`);
  }

  return (
    <PageShell>
      <section style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", textAlign: "center", position: "relative", padding: "42px 0 30px" }}>

        {/* ghost of the seal — the document announcing itself */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
          pointerEvents: "none", opacity: 0.055, transform: "translateY(-4%)" }}>
          <GoldSeal size={460} flat />
        </div>

        <div style={{ position: "relative", width: "100%", maxWidth: 620 }}>
          <div className="gfy-in" style={{ display: "grid", placeItems: "center", marginBottom: 18 }}>
            <GoldSeal size={92} />
          </div>

          <h1 className="display gfy-in" style={{ margin: 0, fontSize: "clamp(34px, 6vw, 52px)",
            fontWeight: 700, letterSpacing: "-0.02em", animationDelay: ".06s" }}>
            Gestify
          </h1>
          <p className="gfy-in" style={{ margin: "8px 0 0", fontSize: 16, color: "var(--ink-soft)", animationDelay: ".12s" }}>
            Proof that speaks for itself
            <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", fontStyle: "italic", marginTop: 3 }}>
              La preuve qui parle d'elle-même
            </span>
          </p>

          <form onSubmit={submit} className="gfy-in" style={{ marginTop: 30, animationDelay: ".18s" }}>
            <label htmlFor="gfy-serial" className="g-label" style={{ display: "block", textAlign: "left", marginBottom: 8 }}>
              Gestificate serial · Numéro du Gestificat
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                id="gfy-serial"
                ref={inputRef}
                className="g-input gfy-mono"
                value={raw}
                onChange={(e) => { setRaw(e.target.value.toUpperCase()); setErr(null); }}
                placeholder="GST-______-________"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                aria-describedby={err ? "gfy-serial-err" : undefined}
                style={{ flex: "1 1 300px", fontSize: 19, letterSpacing: ".12em", textAlign: "center",
                  padding: "1rem 1.1rem", background: "#FFFDF8" }}
              />
              <button type="submit" className="g-pill g-emerald" disabled={going}
                style={{ flex: "0 0 auto", padding: "1rem 1.6rem", fontSize: 15 }}>
                {going ? "Checking…" : <>Verify <FontAwesomeIcon icon={faArrowRight} /></>}
              </button>
            </div>
            {err && (
              <p id="gfy-serial-err" role="alert" style={{ margin: "10px 0 0", fontSize: 13,
                color: "var(--coral-600)", textAlign: "left" }}>
                {err}
              </p>
            )}
          </form>

          <p className="gfy-in" style={{ margin: "22px 0 0", fontSize: 13, color: "var(--ink-soft)", animationDelay: ".24s" }}>
            Every Gestificate ever issued is on the public record. No login. Forever.
          </p>

          <div className="gfy-in" style={{ marginTop: 14, animationDelay: ".3s" }}>
            <button type="button" className="g-chip"
              onClick={() => { setRaw(DEMO_SERIAL); setErr(null); inputRef.current?.focus(); }}
              style={{ cursor: "pointer", fontFamily: "inherit" }}
              title="Fill the demo serial">
              <span className="dot" style={{ background: "var(--gold)" }} />
              try&nbsp;<span className="gfy-mono" style={{ fontWeight: 600 }}>{DEMO_SERIAL}</span>
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
