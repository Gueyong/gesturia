/** Gestify — public registry v1.
 *  Built-in demo entries PLUS anything another Gesturia surface (Gestsolo) wrote to
 *  localStorage["gestify.issued"]  →  array of { serial, holder, course, score, date, surface }.
 *  Every valid Gestificate verifies here. No login. Forever. */

export type Gestificate = {
  serial: string;
  holder: string;
  course: string;
  score: number;          // 0–100
  date: string;           // ISO-ish "2026-06-28"
  surface: string;        // "Gestsolo" | "Gestaula · INJS Yaoundé" | …
  level?: string;
  language?: string;
};

export const SERIAL_RE = /^GST-\d{6}-[A-Z0-9]{8}$/;
export const DEMO_SERIAL = "GST-202607-DEMO0001";
export const ISSUED_KEY = "gestify.issued";

export function normalizeSerial(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

/* ---------- built-in demo registry ---------- */
export const REGISTRY: Gestificate[] = [
  {
    serial: DEMO_SERIAL,
    holder: "Léa Atangana",
    course: "American Sign Language — Foundations",
    language: "ASL · American Sign Language",
    level: "Foundations",
    score: 87,
    date: "2026-06-28",
    surface: "Gestsolo",
  },
  {
    serial: "GST-202606-INJS0042",
    holder: "Nfor Emmanuel",
    course: "Langue des Signes d'Afrique Francophone — Level 1",
    language: "LSAF · Langue des Signes d'Afrique Francophone",
    level: "Level 1",
    score: 91,
    date: "2026-06-12",
    surface: "Gestaula · INJS Yaoundé",
  },
  {
    serial: "GST-202605-INJS0017",
    holder: "Chi Vanessa Bih",
    course: "American Sign Language — Level 2",
    language: "ASL · American Sign Language",
    level: "Level 2",
    score: 84,
    date: "2026-05-30",
    surface: "Gestaula · INJS Yaoundé",
  },
  {
    serial: "GST-202607-SOLO0198",
    holder: "Ousmanou Aliyu",
    course: "American Sign Language — Foundations",
    language: "ASL · American Sign Language",
    level: "Foundations",
    score: 95,
    date: "2026-07-01",
    surface: "Gestsolo",
  },
];

/** Format-check first, then registry lookup (built-in, then localStorage). */
export function lookupSerial(serial: string): Gestificate | null {
  const hit = REGISTRY.find((c) => c.serial === serial);
  if (hit) return hit;

  if (typeof window !== "undefined") {
    try {
      const arr = JSON.parse(window.localStorage.getItem(ISSUED_KEY) || "[]");
      if (Array.isArray(arr)) {
        const m = arr.find(
          (c: any) => c && typeof c.serial === "string" && normalizeSerial(c.serial) === serial
        );
        if (m) {
          return {
            serial,
            holder: String(m.holder ?? "Unnamed learner"),
            course: String(m.course ?? "—"),
            score: Number(m.score ?? 0),
            date: String(m.date ?? ""),
            surface: String(m.surface ?? "Gestsolo"),
            level: m.level != null ? String(m.level) : undefined,
            language: m.language != null ? String(m.language) : undefined,
          };
        }
      }
    } catch {
      /* unreadable local record — treat as absent */
    }
  }
  return null;
}

export function formatDate(d: string): string {
  const t = new Date(d);
  if (isNaN(t.getTime())) return d || "—";
  return t.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/* ---------- deterministic bits (scan-pattern seed) ---------- */
export function seedFrom(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
