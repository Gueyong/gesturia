"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Real SMPL-X mesh player with a REALTIME CLIP QUEUE.
 * Loads vertex animations (verts = Float32 [T,V,3], faces = Uint32 [F,3]) and plays them back-to-back:
 * queue[0] plays once, then onFinished() fires so the page can shift the queue; the next clip is
 * prefetched while the current one plays and the seam is crossfaded (~150ms vertex lerp), so the
 * interpreter signs continuously while someone is still talking. With an empty queue he holds his
 * last pose. Data is canonicalized up=-y / chest=-z -> rotate 180° about X.
 */
export interface MeshClip { vertsUrl: string; facesUrl: string; frames: number; nverts: number; fps: number; }

type Cur = { url: string; verts: Float32Array; frames: number; nverts: number; fps: number };

const clipCache = new Map<string, Promise<Float32Array>>();
let facesCache: Promise<Uint32Array> | null = null;
let colorsCache: Promise<ArrayBuffer | null> | null = null;
let inflateCache: Promise<ArrayBuffer | null> | null = null;

function loadVerts(clip: MeshClip): Promise<Float32Array> {
  if (!clipCache.has(clip.vertsUrl)) {
    clipCache.set(clip.vertsUrl, fetch(clip.vertsUrl).then((r) => r.arrayBuffer()).then((b) => new Float32Array(b)));
    if (clipCache.size > 12) {                     // bound memory: drop the oldest cached clip
      const k = clipCache.keys().next().value;
      if (k && k !== clip.vertsUrl) clipCache.delete(k);
    }
  }
  return clipCache.get(clip.vertsUrl)!;
}

function loadStatics(clip: MeshClip) {
  const origin = (() => { try { return new URL(clip.vertsUrl).origin; } catch { return ""; } })();
  if (!facesCache) facesCache = fetch(clip.facesUrl).then((r) => r.arrayBuffer()).then((b) => new Uint32Array(b));
  if (!colorsCache) colorsCache = fetch(`${origin}/v1/smplx/asset/colors`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  if (!inflateCache) inflateCache = fetch(`${origin}/v1/smplx/asset/inflate`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  return Promise.all([facesCache, colorsCache, inflateCache]);
}

function Mesh({ queue, loop, onFinished, paused = false, rate = 1, restartNonce = 0 }:
  { queue: MeshClip[]; loop: boolean; onFinished?: (url: string) => void; paused?: boolean; rate?: number; restartNonce?: number }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const t = useRef(0);
  const cur = useRef<Cur | null>(null);
  const lastPose = useRef<Float32Array | null>(null);   // outgoing pose snapshot for the crossfade
  const blend = useRef(1);                              // 0 -> showing lastPose, 1 -> fully on current clip
  const advancedFor = useRef<string>("");
  const inflateRef = useRef<Float32Array | null>(null);
  const geoReady = useRef(false);

  const head = queue[0];
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => { t.current = 0; advancedFor.current = ""; }, [restartNonce]);   // ⟲ restart current clip

  useEffect(() => {
    if (!head) return;
    let alive = true;
    (async () => {
      try {
        const [faces, cb, ib] = await loadStatics(head);
        const verts = await loadVerts(head);
        if (queue[1]) loadVerts(queue[1]);              // prefetch the next clip while this one plays
        if (!alive || !meshRef.current) return;
        if (!geoReady.current) {
          const g = new THREE.BufferGeometry();
          g.setIndex(new THREE.BufferAttribute(faces, 1));
          g.setAttribute("position", new THREE.BufferAttribute(verts.slice(0, head.nverts * 3), 3));
          if (cb && cb.byteLength === head.nverts * 3) g.setAttribute("color", new THREE.BufferAttribute(new Uint8Array(cb), 3, true));
          inflateRef.current = ib && ib.byteLength === head.nverts * 4 ? new Float32Array(ib) : null;
          g.computeVertexNormals();
          meshRef.current.geometry = g;
          geoReady.current = true;
        }
        // snapshot the currently displayed pose so the new clip fades in from it (seamless seam)
        if (cur.current) {
          const pos = meshRef.current.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
          if (pos) { lastPose.current = (pos.array as Float32Array).slice(); blend.current = 0; }
        }
        cur.current = { url: head.vertsUrl, verts, frames: head.frames, nverts: head.nverts, fps: head.fps };
        t.current = 0;
      } catch (e: any) {
        if (e?.name !== "AbortError") console.warn("[MeshSigner] clip load skipped:", e?.message || e);
        // a broken clip must never stall the queue
        if (alive && onFinishedRef.current && queue.length > 1) onFinishedRef.current(head.vertsUrl);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head?.vertsUrl]);

  useFrame((_, dt) => {
    const c = cur.current;
    if (!c || !meshRef.current || !geoReady.current) return;
    // Legible catch-up: signed output runs longer than speech, so when the backlog is deep the
    // interpreter signs a TOUCH faster — but never past ~1.25x, so signs stay readable. We do NOT rush
    // illegibly and we NEVER drop queued signs; a growing backlog is surfaced to the UI (queue depth)
    // instead of being hidden. `rate` is the user's speed control; `paused` freezes time.
    const behind = Math.max(0, queue.length - 2);
    const speed = rate * (1 + Math.min(0.25, 0.05 * behind));
    if (!paused) t.current += dt * c.fps * speed;
    let fi = Math.floor(t.current);
    if (fi >= c.frames) {
      if (queue.length > 1 && advancedFor.current !== c.url && onFinishedRef.current) {
        advancedFor.current = c.url;
        onFinishedRef.current(c.url);                   // page shifts the queue -> effect loads the next clip
        fi = c.frames - 1;
      } else if (loop && queue.length <= 1) {
        t.current = 0; fi = 0;
      } else {
        fi = c.frames - 1;                              // hold the final pose while waiting for more speech
      }
    }
    // Sub-frame INTERPOLATION: the clip runs at c.fps (often 15-30 after the server caps to <=220 frames)
    // but the display refreshes at 60-144Hz. Lerping between the two neighbouring frames makes the motion
    // glide like professional video instead of stepping frame-to-frame — the standard "in-betweening".
    let frac = t.current - fi;
    const hasNext = fi + 1 < c.frames;
    if (!hasNext) frac = 0;                             // last frame / hold: nothing to lerp toward
    const stride = c.nverts * 3;
    const geo = meshRef.current.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    if (!pos) return;
    const pa = pos.array as Float32Array;
    const f0 = c.verts.subarray(fi * stride, fi * stride + stride);
    const f1 = hasNext ? c.verts.subarray((fi + 1) * stride, (fi + 1) * stride + stride) : null;
    if (blend.current < 1 && lastPose.current && lastPose.current.length === stride) {
      // cross-clip seam smoother (the SERVER already transitions each clip from the last one in rotation
      // space, so this stays short) — blended ON TOP of the interpolated in-between frame
      blend.current = Math.min(1, blend.current + dt / 0.07);
      const b = blend.current, last = lastPose.current;
      for (let i = 0; i < stride; i++) {
        const s = f1 ? f0[i] + (f1[i] - f0[i]) * frac : f0[i];
        pa[i] = last[i] * (1 - b) + s * b;
      }
    } else if (f1) {
      for (let i = 0; i < stride; i++) pa[i] = f0[i] + (f1[i] - f0[i]) * frac;
    } else {
      pa.set(f0);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // dress him: push clothing verts out along their (per-frame) normals -> fitted garment silhouette
    const inf = inflateRef.current;
    const nrm = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
    if (inf && nrm && inf.length === c.nverts) {
      const na = nrm.array as Float32Array;
      for (let i = 0; i < inf.length; i++) {
        const d = inf[i]; if (!d) continue;
        const k = i * 3; pa[k] += na[k] * d; pa[k + 1] += na[k + 1] * d; pa[k + 2] += na[k + 2] * d;
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[Math.PI, 0, 0]} castShadow>
      <bufferGeometry />
      <meshStandardMaterial vertexColors color="#ffffff" roughness={0.72} metalness={0.02} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function MeshSigner({ queue, loop = false, onFinished, hint = true, paused = false, rate = 1, restartNonce = 0 }:
  { queue: MeshClip[]; loop?: boolean; onFinished?: (url: string) => void; hint?: boolean; paused?: boolean; rate?: number; restartNonce?: number }) {
  const [ever, setEver] = useState(false);
  const controlsRef = useRef<any>(null);
  useEffect(() => { if (queue.length) setEver(true); }, [queue.length]);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden",
      background: "radial-gradient(120% 90% at 50% 0%, #1a2340 0%, #0c1122 60%, #080b16 100%)" }}
      onDoubleClick={() => controlsRef.current?.reset()} title="Double-click to reset the camera">
      <Canvas shadows camera={{ position: [0, 0, 3.6], fov: 38 }} dpr={[1, 2]}>
        <hemisphereLight args={["#cfe0ff", "#20263a", 0.7]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[2.5, 4, 4]} intensity={1.3} castShadow />
        <pointLight position={[-3, 1, 2]} intensity={0.5} color="#F4B81F" />
        <Mesh queue={queue} loop={loop} onFinished={onFinished} paused={paused} rate={rate} restartNonce={restartNonce} />
        {/* clamped orbit: you can peek around him but never lose him sideways; double-click resets */}
        <OrbitControls ref={controlsRef} enablePan={false} minDistance={1.6} maxDistance={8} target={[0, 0, 0]}
          minAzimuthAngle={-0.55} maxAzimuthAngle={0.55}
          minPolarAngle={Math.PI / 2 - 0.5} maxPolarAngle={Math.PI / 2 + 0.35} />
      </Canvas>
      {!ever && hint && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#5b6b8c", fontSize: 14, pointerEvents: "none" }}>
          The interpreter appears here — speak or type to sign
        </div>
      )}
    </div>
  );
}
