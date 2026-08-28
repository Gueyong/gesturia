"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** CHOOSE YOUR INTERPRETER — a standard humanoid character signing the live translation.
 *  The rig GLB loads ONCE; every phrase arrives as a tiny per-bone quaternion clip (bake-on-demand)
 *  and plays through an AnimationMixer with crossfades. No vertex streaming, no SMPL-X — pure motion. */

export interface CharClip {
  token: string; frames: number; fps: number;
  tracks: { bone: string; q: number[] }[];             // q = flat (T*4) xyzw
}

function toClip(c: CharClip): THREE.AnimationClip {
  const times = new Float32Array(c.frames);
  for (let i = 0; i < c.frames; i++) times[i] = i / c.fps;
  const tracks = c.tracks.map((tr) =>
    new THREE.QuaternionKeyframeTrack(`${tr.bone}.quaternion`, times as any, Float32Array.from(tr.q) as any));
  return new THREE.AnimationClip(`SIGN_${c.token}`, c.frames / c.fps, tracks);
}

function Rig({ api, rig, queue, onFinished, onProgress, paused = false, rate = 1 }: {
  api: string; rig: string; queue: CharClip[]; onFinished?: (token: string) => void;
  onProgress?: (token: string, frame: number, fps: number) => void; paused?: boolean; rate?: number;
}) {
  const group = useRef<THREE.Group>(null!);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const action = useRef<THREE.AnimationAction | null>(null);
  const curTok = useRef<string>("");
  const advancedFor = useRef<string>("");
  const lastProg = useRef(0);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const onFinishedRef = useRef(onFinished); onFinishedRef.current = onFinished;
  const onProgressRef = useRef(onProgress); onProgressRef.current = onProgress;

  useEffect(() => {
    let alive = true;
    new GLTFLoader().load(`${api}/v1/character/rigs/${rig}.glb`, (g) => {
      if (!alive) return;
      const box = new THREE.Box3().setFromObject(g.scene);
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      // SIGNING FRAMING: the camera's subject is hands+face+torso, never the legs — put the CHEST at
      // the origin (72% up the body), so default zoom reads like a broadcast interpreter shot
      g.scene.position.set(-c.x, -(box.min.y + s.y * 0.72), -c.z);
      setModel(g.scene);
      mixer.current = new THREE.AnimationMixer(g.scene);
    });
    return () => { alive = false; };
  }, [api, rig]);

  const head = queue[0];
  useEffect(() => {
    if (!head || !mixer.current || head.token === curTok.current) return;
    curTok.current = head.token;
    const next = mixer.current.clipAction(toClip(head));
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.reset();                                        // fresh weights/time BEFORE the fade
    if (action.current) {
      action.current.crossFadeTo(next, 0.14, false);
      const prev = action.current;
      setTimeout(() => { try { prev.stop(); mixer.current?.uncacheClip(prev.getClip()); } catch {} }, 400);
    }
    next.play();
    action.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head?.token, model]);

  useFrame((_, dt) => {
    const m = mixer.current, a = action.current, h = queue[0];
    if (!m || !a || !h) return;
    const behind = Math.max(0, queue.length - 2);
    if (!paused) m.update(dt * rate * (1 + Math.min(0.6, 0.09 * behind)));
    const t = a.time;
    const now = performance.now();
    if (onProgressRef.current && now - lastProg.current > 90) {
      lastProg.current = now;
      onProgressRef.current(h.token, Math.min(h.frames - 1, t * h.fps), h.fps);
    }
    if (t >= h.frames / h.fps - 1e-3 && queue.length > 1 && advancedFor.current !== h.token) {
      advancedFor.current = h.token;
      onFinishedRef.current?.(h.token);
    }
  });

  return model ? <primitive ref={group} object={model} position={[0, -0.15, 0]} /> : null;
}

export default function CharacterStage({ api, rig, queue, onFinished, onProgress, paused, rate = 1, hint = true }: {
  api: string; rig: string; queue: CharClip[]; onFinished?: (token: string) => void;
  onProgress?: (token: string, frame: number, fps: number) => void; paused?: boolean; rate?: number; hint?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden",
      background: "radial-gradient(120% 90% at 50% 0%, #1a2340 0%, #0c1122 60%, #080b16 100%)" }}>
      <Canvas camera={{ position: [0, 0.06, 1.35], fov: 38 }} dpr={[1, 2]}>
        <hemisphereLight args={["#cfe0ff", "#20263a", 0.9]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[2.5, 4, 4]} intensity={1.5} />
        <pointLight position={[-3, 1, 2]} intensity={0.6} color="#F4B81F" />
        <Rig api={api} rig={rig} queue={queue} onFinished={onFinished} onProgress={onProgress} paused={paused} rate={rate} />
        {/* orbit pivots on the CHEST — zooming in goes to the hands and face, never the legs */}
        <OrbitControls enablePan={false} minDistance={0.55} maxDistance={4} target={[0, 0.02, 0]}
          minAzimuthAngle={-0.6} maxAzimuthAngle={0.6} minPolarAngle={Math.PI / 2 - 0.5} maxPolarAngle={Math.PI / 2 + 0.35} />
      </Canvas>
      {queue.length === 0 && hint && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#5b6b8c", fontSize: 14, pointerEvents: "none" }}>
          The interpreter appears here — speak or type to sign
        </div>
      )}
    </div>
  );
}
