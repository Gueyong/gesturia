"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faPause, faBackwardStep, faForwardStep, faScissors, faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import type { MeshClip } from "./MeshSigner";

/** CLIP STUDIO — the captured sign as an editable clip, like a video editor.
 *  Every frame is loaded locally, so scrubbing / stepping / trimming are instant (no server round-trips):
 *  drag the playhead, drag the trim handles (start on the auto-detected signing window), step frame-by-frame,
 *  loop the selection. Whatever is inside the handles is exactly what gets stored. */

type Loaded = { verts: Float32Array; faces: Uint32Array; colors: Uint8Array | null; inflate: Float32Array | null };

function EditorMesh({ data, clip, frameRef, playingRef, rangeRef, onTick }:
  { data: Loaded; clip: MeshClip; frameRef: React.MutableRefObject<number>; playingRef: React.MutableRefObject<boolean>;
    rangeRef: React.MutableRefObject<[number, number]>; onTick: (f: number) => void }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ready = useRef(false);

  useEffect(() => {
    if (!meshRef.current) return;
    const g = new THREE.BufferGeometry();
    g.setIndex(new THREE.BufferAttribute(data.faces, 1));
    g.setAttribute("position", new THREE.BufferAttribute(data.verts.slice(0, clip.nverts * 3), 3));
    if (data.colors && data.colors.byteLength === clip.nverts * 3) g.setAttribute("color", new THREE.BufferAttribute(data.colors, 3, true));
    g.computeVertexNormals();
    meshRef.current.geometry = g;
    ready.current = true;
  }, [data, clip.nverts]);

  useFrame((_, dt) => {
    if (!ready.current || !meshRef.current) return;
    const [s, e] = rangeRef.current;
    if (playingRef.current) {
      let f = frameRef.current + dt * clip.fps;
      if (f > e) f = s;                                  // loop the selection
      frameRef.current = f;
    }
    const f = Math.min(Math.max(frameRef.current, 0), clip.frames - 1);
    const fi = Math.floor(f);
    const frac = Math.min(f - fi, 1);
    const stride = clip.nverts * 3;
    const geo = meshRef.current.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    if (!pos) return;
    const pa = pos.array as Float32Array;
    const f0 = data.verts.subarray(fi * stride, fi * stride + stride);
    const f1 = fi + 1 < clip.frames ? data.verts.subarray((fi + 1) * stride, (fi + 2) * stride) : null;
    if (f1) { for (let i = 0; i < stride; i++) pa[i] = f0[i] + (f1[i] - f0[i]) * frac; } else pa.set(f0);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const inf = data.inflate;                            // fitted-garment inflate, same as the player
    const nrm = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
    if (inf && nrm && inf.length === clip.nverts) {
      const na = nrm.array as Float32Array;
      for (let i = 0; i < inf.length; i++) { const d = inf[i]; if (!d) continue; const k = i * 3; pa[k] += na[k] * d; pa[k + 1] += na[k + 1] * d; pa[k + 2] += na[k + 2] * d; }
      pos.needsUpdate = true;
    }
    onTick(f);
  });

  return (
    <mesh ref={meshRef} rotation={[Math.PI, 0, 0]}>
      <bufferGeometry />
      <meshStandardMaterial vertexColors color="#ffffff" roughness={0.72} metalness={0.02} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function ClipStudio({ clip, span, word, busy, studioAvailable, onAdd, onRedo }:
  { clip: MeshClip; span: [number, number]; word: string; busy?: string | null; studioAvailable: boolean;
    onAdd: (range: [number, number], mode: "quick" | "studio") => void; onRedo: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [err, setErr] = useState("");
  const frameRef = useRef(span[0]);
  const playingRef = useRef(true);
  const rangeRef = useRef<[number, number]>([span[0], Math.max(span[0] + 1, span[1] - 1)]);
  const [playing, setPlaying] = useState(true);
  const [range, setRange] = useState<[number, number]>(rangeRef.current);
  const [head, setHead] = useState(span[0]);             // playhead UI (throttled)
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"" | "scrub" | "s" | "e">("");
  const lastUi = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const origin = new URL(clip.vertsUrl).origin;
        const [vb, fb, cb, ib] = await Promise.all([
          fetch(clip.vertsUrl).then((r) => r.arrayBuffer()),
          fetch(clip.facesUrl).then((r) => r.arrayBuffer()),
          fetch(`${origin}/v1/smplx/asset/colors`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
          fetch(`${origin}/v1/smplx/asset/inflate`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
        ]);
        if (!alive) return;
        setData({ verts: new Float32Array(vb), faces: new Uint32Array(fb),
          colors: cb ? new Uint8Array(cb) : null, inflate: ib ? new Float32Array(ib) : null });
      } catch (e: any) { if (alive) setErr(e?.message || "clip failed to load"); }
    })();
    return () => { alive = false; };
  }, [clip.vertsUrl, clip.facesUrl]);

  const setRangeBoth = useCallback((s: number, e: number) => {
    s = Math.max(0, Math.min(s, clip.frames - 2)); e = Math.max(s + 1, Math.min(e, clip.frames - 1));
    rangeRef.current = [s, e]; setRange([s, e]);
  }, [clip.frames]);

  const onTick = useCallback((f: number) => {
    const now = performance.now();
    if (now - lastUi.current > 90) { lastUi.current = now; setHead(f); }
  }, []);

  const fracToFrame = useCallback((clientX: number) => {
    const el = trackRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (clip.frames - 1);
  }, [clip.frames]);

  const pointer = useCallback((ev: React.PointerEvent, kind: "down" | "move" | "up") => {
    if (kind === "down") {
      const f = fracToFrame(ev.clientX);
      const [s, e] = rangeRef.current;
      const px = (n: number) => (n / (clip.frames - 1)) * (trackRef.current?.getBoundingClientRect().width || 1);
      const x = ev.clientX - (trackRef.current?.getBoundingClientRect().left || 0);
      dragRef.current = Math.abs(x - px(s)) < 10 ? "s" : Math.abs(x - px(e)) < 10 ? "e" : "scrub";
      (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
      if (dragRef.current === "scrub") { frameRef.current = f; setHead(f); playingRef.current = false; setPlaying(false); }
    }
    if (kind === "move" && dragRef.current) {
      const f = fracToFrame(ev.clientX);
      const [s, e] = rangeRef.current;
      if (dragRef.current === "scrub") { frameRef.current = f; setHead(f); }
      else if (dragRef.current === "s") setRangeBoth(Math.min(f, e - 1), e);
      else setRangeBoth(s, Math.max(f, s + 1));
    }
    if (kind === "up") dragRef.current = "";
  }, [clip.frames, fracToFrame, setRangeBoth]);

  const toggle = useCallback(() => {
    const [s, e] = rangeRef.current;
    if (!playingRef.current && (frameRef.current < s || frameRef.current > e)) frameRef.current = s;
    playingRef.current = !playingRef.current; setPlaying(playingRef.current);
  }, []);
  const step = useCallback((d: number) => {
    playingRef.current = false; setPlaying(false);
    frameRef.current = Math.max(0, Math.min(clip.frames - 1, Math.round(frameRef.current) + d));
    setHead(frameRef.current);
  }, [clip.frames]);

  const [s, e] = range;
  const pct = (n: number) => `${(n / (clip.frames - 1)) * 100}%`;
  const dur = ((e - s + 1) / clip.fps).toFixed(2);
  const disabled = !!busy;

  return (
    <div>
      <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)",
        background: "radial-gradient(120% 90% at 50% 0%, #1a2340 0%, #0c1122 60%, #080b16 100%)" }}>
        {data ? (
          <Canvas camera={{ position: [0, 0, 3.2], fov: 38 }} dpr={[1, 2]}>
            <hemisphereLight args={["#cfe0ff", "#20263a", 0.7]} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[2.5, 4, 4]} intensity={1.3} />
            <pointLight position={[-3, 1, 2]} intensity={0.5} color="#F4B81F" />
            <EditorMesh data={data} clip={clip} frameRef={frameRef} playingRef={playingRef} rangeRef={rangeRef} onTick={onTick} />
            <OrbitControls enablePan={false} minDistance={1.6} maxDistance={8} target={[0, 0, 0]}
              minAzimuthAngle={-0.55} maxAzimuthAngle={0.55} minPolarAngle={Math.PI / 2 - 0.5} maxPolarAngle={Math.PI / 2 + 0.35} />
          </Canvas>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#5b6b8c", fontSize: 13 }}>
            {err || "Loading your clip…"}
          </div>
        )}
      </div>

      {/* timeline: selection band + trim handles + playhead — drag anywhere to scrub */}
      <div ref={trackRef} onPointerDown={(ev) => pointer(ev, "down")} onPointerMove={(ev) => pointer(ev, "move")} onPointerUp={(ev) => pointer(ev, "up")}
        style={{ position: "relative", height: 34, margin: "14px 2px 6px", borderRadius: 10, background: "rgba(28,26,23,.08)",
          cursor: "pointer", touchAction: "none", userSelect: "none" }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: pct(s), width: `calc(${pct(e)} - ${pct(s)})`,
          background: "rgba(232,85,58,.18)", borderRadius: 10, border: "1px solid rgba(232,85,58,.45)" }} />
        {([["s", s], ["e", e]] as const).map(([k, n]) => (
          <div key={k} style={{ position: "absolute", top: -3, bottom: -3, left: pct(n), width: 12, marginLeft: -6, borderRadius: 5,
            background: "var(--coral,#E8553A)", boxShadow: "0 1px 4px rgba(0,0,0,.25)", cursor: "ew-resize" }} />
        ))}
        <div style={{ position: "absolute", top: -2, bottom: -2, left: pct(head), width: 2, marginLeft: -1, background: "#1C1A17" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--muted)" }}>
        <button className="g-pill g-soft" onClick={() => { playingRef.current = false; setPlaying(false); frameRef.current = s; setHead(s); }} title="To selection start"><FontAwesomeIcon icon={faBackwardStep} /></button>
        <button className="g-pill g-soft" onClick={() => step(-1)} title="Previous frame">−1</button>
        <button className="g-pill g-coral" onClick={toggle} style={{ minWidth: 44 }}>{playing ? <FontAwesomeIcon icon={faPause} /> : <FontAwesomeIcon icon={faPlay} />}</button>
        <button className="g-pill g-soft" onClick={() => step(+1)} title="Next frame">+1</button>
        <button className="g-pill g-soft" onClick={() => { playingRef.current = false; setPlaying(false); frameRef.current = e; setHead(e); }} title="To selection end"><FontAwesomeIcon icon={faForwardStep} /></button>
        <span style={{ marginLeft: 4 }}>frame {Math.round(head) + 1}/{clip.frames} · keeps {e - s + 1} frames · {dur}s</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button className="g-pill g-soft" onClick={() => setRangeBoth(Math.round(frameRef.current), e)} title="Trim start to the playhead"><FontAwesomeIcon icon={faScissors} /> start here</button>
          <button className="g-pill g-soft" onClick={() => setRangeBoth(s, Math.round(frameRef.current))} title="Trim end to the playhead">end here <FontAwesomeIcon icon={faScissors} /></button>
          <button className="g-pill g-soft" onClick={() => setRangeBoth(span[0], Math.max(span[0] + 1, span[1] - 1))} title="Back to the detected signing window"><FontAwesomeIcon icon={faRotateLeft} /></button>
        </span>
      </div>

      <p style={{ fontSize: 13, color: "var(--muted)", margin: "12px 0", textAlign: "center" }}>
        The band is what gets stored — the lead-in and the hand-drop are already outside it. Adjust, then add.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="g-pill g-coral" disabled={disabled} onClick={() => onAdd(rangeRef.current, "quick")}>
          {busy === "quick" ? "Adding…" : `Add “${word.toLowerCase()}” now`}
        </button>
        {studioAvailable && (
          <button className="g-pill g-soft" disabled={disabled} onClick={() => onAdd(rangeRef.current, "studio")}
            title="Re-lift the recorded video with the WiLoR hand model — the same pipeline that built the dictionary">
            {busy === "studio" ? "Studio lift running…" : "Add in studio quality (~1 min)"}
          </button>
        )}
        <button className="g-pill g-soft" disabled={disabled} onClick={onRedo}><FontAwesomeIcon icon={faRotateLeft} /> Record again</button>
      </div>
    </div>
  );
}
