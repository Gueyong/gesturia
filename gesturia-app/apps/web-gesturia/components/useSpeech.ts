"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Working microphone for the live interpreter:
 *  - real-time speech-to-text (Web Speech API, continuous, interim results incl. uncertain words)
 *  - live audio level (Web Audio analyser) driving the peak meter
 *  - REALTIME word streaming: onWords(words) fires as soon as words STABILIZE in the interim
 *    stream (words that survive one recognition update unchanged, excluding the still-mutating
 *    trailing word) — the translator does NOT wait for the full phrase to land.
 * onFinal(phrase) still fires when a phrase settles (used for the transcript / phrase history).
 */
export function useSpeech(onFinal: (text: string) => void, onWords?: (words: string[]) => void, lang: string = "en-US") {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [supported, setSupported] = useState(true);

  const recRef = useRef<any>(null);
  const langRef = useRef(lang);            // Web Speech recognizes ONE language at a time (no auto-detect);
  const wantRef = useRef(false);           // user intends to listen (auto-restart on engine end)
  const acRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const onFinalRef = useRef(onFinal);
  const onWordsRef = useRef(onWords);
  onFinalRef.current = onFinal;
  onWordsRef.current = onWords;

  // per-utterance-segment bookkeeping for early word commits
  const committedRef = useRef<Record<number, number>>({});
  const prevWordsRef = useRef<Record<number, string[]>>({});

  useEffect(() => {
    const SR = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langRef.current;             // set from the chosen language (updated live below)
    rec.onresult = (e: any) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const words = (r[0].transcript as string).trim().split(/\s+/).filter(Boolean);
        const done = committedRef.current[i] || 0;
        if (r.isFinal) {
          if (words.length > done) onWordsRef.current?.(words.slice(done));   // flush the un-committed tail
          committedRef.current[i] = words.length;
          const t = (r[0].transcript as string).trim();
          if (t) onFinalRef.current(t);
        } else {
          live += r[0].transcript;
          // words unchanged since the previous update (except the trailing one) are stable -> commit early
          const prev = prevWordsRef.current[i] || [];
          let stable = 0;
          const lim = Math.min(prev.length, words.length) - 1;
          while (stable < lim && prev[stable] === words[stable]) stable++;
          if (stable > done) {
            onWordsRef.current?.(words.slice(done, stable));
            committedRef.current[i] = stable;
          }
          prevWordsRef.current[i] = words;
        }
      }
      setInterim(live);
    };
    rec.onend = () => { if (wantRef.current) { try { rec.start(); } catch {} } else setListening(false); };
    rec.onerror = (ev: any) => { if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { wantRef.current = false; setListening(false); } };
    recRef.current = rec;
    return () => { wantRef.current = false; try { rec.stop(); } catch {} };
  }, []);

  // Live language switch: the browser engine only honours ONE language per session, so when the user
  // picks a different language we restart recognition in it. Switching to fr-FR mid-stream lets French
  // be transcribed as French (then translated FR->EN->ASL) instead of forced into English gibberish.
  useEffect(() => {
    langRef.current = lang;
    const rec = recRef.current;
    if (!rec) return;
    rec.lang = lang;
    if (wantRef.current) {                  // currently listening -> bounce to apply the new language
      committedRef.current = {};
      prevWordsRef.current = {};
      try { rec.stop(); } catch {}          // onend auto-restarts (wantRef true) with the new lang
    }
  }, [lang]);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      acRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        setLevel((p) => p * 0.6 + Math.min(1, rms * 2.6) * 0.4); // smoothed
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* mic denied -> meter stays flat, ASR error handles the rest */ }
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    acRef.current?.close().catch(() => {});
    streamRef.current = null; acRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(() => {
    if (!recRef.current) return;
    wantRef.current = true;
    committedRef.current = {};
    prevWordsRef.current = {};
    setListening(true);
    try { recRef.current.start(); } catch {}
    startMeter();
  }, [startMeter]);

  const stop = useCallback(() => {
    wantRef.current = false;
    setListening(false);
    setInterim("");
    try { recRef.current?.stop(); } catch {}
    stopMeter();
  }, [stopMeter]);

  const toggle = useCallback(() => { (listening ? stop : start)(); }, [listening, start, stop]);

  return { listening, interim, level, supported, start, stop, toggle };
}
