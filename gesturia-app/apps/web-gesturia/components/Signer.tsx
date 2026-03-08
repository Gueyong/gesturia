"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

/**
 * Solid 3D signing avatar.
 * Input: per-frame 288-float poses (96 joints x3): body 0-24 (BODY_25), LH 32-52, RH 53-73, face 74-95.
 * We ANCHOR each hand onto its body wrist and rescale it to a realistic palm size (the raw hand
 * landmarks live in their own normalized box — otherwise they explode / detach), then render a
 * volumetric mannequin (capsule limbs + ball joints + head). Port of backend skel_anchor.anchored_xyz.
 */

const PALM_FRAC = 0.45;
// bone topology on the anchored 67-joint skeleton (body 0-24, LH 25-45, RH 46-66)
const DRAW_BODY: [number, number][] = [[1, 8], [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 0]];
const BODY_JOINTS: [number, number][] = [[8, 0.13], [1, 0.10], [2, 0.085], [5, 0.085], [3, 0.065], [6, 0.065], [4, 0.05], [7, 0.05]];
const HAND_BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const d3 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 288-float frame -> 67x3 anchored joints (hands placed on wrists, realistic size). */
function anchor67(f: number[]): number[][] {
  const J = (i: number): number[] => [f[i * 3] || 0, f[i * 3 + 1] || 0, f[i * 3 + 2] || 0];
  const body: number[][] = [];
  for (let i = 0; i < 25; i++) body.push(J(i));
  const anchorHand = (base: number, wrist: number[], forearm: number): number[][] => {
    const root = J(base);
    let sum = 0;
    for (let i = 0; i < 21; i++) { const p = J(base + i); sum += Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]); }
    if (sum < 1e-6) return Array.from({ length: 21 }, () => wrist.slice());
    const ref = d3(J(base + 9), root) || 1;
    const scale = ref > 1e-6 ? (PALM_FRAC * forearm) / ref : 1;
    const out: number[][] = [];
    for (let i = 0; i < 21; i++) {
      const p = J(base + i);
      out.push([wrist[0] + (p[0] - root[0]) * scale, wrist[1] + (p[1] - root[1]) * scale, wrist[2] + (p[2] - root[2]) * scale]);
    }
    return out;
  };
  const foreL = d3(body[6], body[7]) || 0.3;
  const foreR = d3(body[3], body[4]) || 0.3;
  const lh = anchorHand(32, body[7], foreL);   // left hand -> left wrist (7)
  const rh = anchorHand(53, body[4], foreR);   // right hand -> right wrist (4)
  return body.concat(lh, rh);                   // 67x3
}

// temporaries (single-threaded useFrame — safe to share)
const UP = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
const va = new THREE.Vector3(), vb = new THREE.Vector3(), vd = new THREE.Vector3(), vm = new THREE.Vector3();

function setBone(m: THREE.InstancedMesh, idx: number, pa: THREE.Vector3, pb: THREE.Vector3, r: number) {
  vd.subVectors(pb, pa); const len = vd.length();
  vm.addVectors(pa, pb).multiplyScalar(0.5); dummy.position.copy(vm);
  if (len > 1e-6) { vd.normalize(); dummy.quaternion.setFromUnitVectors(UP, vd); } else dummy.quaternion.identity();
  dummy.scale.set(r, Math.max(len, 1e-4), r); dummy.updateMatrix(); m.setMatrixAt(idx, dummy.matrix);
}
function setSphere(m: THREE.InstancedMesh, idx: number, p: THREE.Vector3, r: number) {
  dummy.position.copy(p); dummy.quaternion.identity(); dummy.scale.setScalar(r); dummy.updateMatrix(); m.setMatrixAt(idx, dummy.matrix);
}
function bodyBoneR(a: number, b: number, unit: number): number {
  const s = new Set([a, b]);
  if (s.has(1) && s.has(8)) return 0.14 * unit;
  if (s.has(0)) return 0.055 * unit;
  if ((s.has(1) && s.has(2)) || (s.has(1) && s.has(5))) return 0.09 * unit;
  if ((s.has(2) && s.has(3)) || (s.has(5) && s.has(6))) return 0.07 * unit;
  if ((s.has(3) && s.has(4)) || (s.has(6) && s.has(7))) return 0.055 * unit;
  return 0.06 * unit;
}

// static lower body (signing avatars keep legs still) — offsets in fractions of `unit`, screen-space (y up)
const PELVIS_W = 0.13, THIGH = 0.62, SHIN = 0.58, FOOT_FWD = 0.17, FOOT_DROP = 0.05;
function legPoints(hip: number[], u: number) {
  const H: [number, number, number] = [hip[0], -hip[1], hip[2]];
  const mk = (dx: number, dy: number, dz: number): [number, number, number] => [H[0] + dx * u, H[1] + dy * u, H[2] + dz * u];
  const hipL = mk(PELVIS_W, -0.02, 0), hipR = mk(-PELVIS_W, -0.02, 0);
  const kneeL = mk(PELVIS_W, -0.02 - THIGH, 0), kneeR = mk(-PELVIS_W, -0.02 - THIGH, 0);
  const ankL = mk(PELVIS_W, -0.02 - THIGH - SHIN, 0), ankR = mk(-PELVIS_W, -0.02 - THIGH - SHIN, 0);
  const toeL = mk(PELVIS_W, -0.02 - THIGH - SHIN - FOOT_DROP, FOOT_FWD), toeR = mk(-PELVIS_W, -0.02 - THIGH - SHIN - FOOT_DROP, FOOT_FWD);
  return { H, hipL, hipR, kneeL, kneeR, ankL, ankR, toeL, toeR };
}
const LEG_BONES_N = 8, LEG_JOINTS_N = 6;

function Rig({ poses, fps, playing }: { poses: number[][]; fps: number; playing: boolean }) {
  const t = useRef(0);
  const bodyBones = useRef<THREE.InstancedMesh>(null!);
  const bodyJoints = useRef<THREE.InstancedMesh>(null!);
  const handBones = useRef<THREE.InstancedMesh>(null!);
  const handJoints = useRef<THREE.InstancedMesh>(null!);
  const legBones = useRef<THREE.InstancedMesh>(null!);
  const legJoints = useRef<THREE.InstancedMesh>(null!);
  const head = useRef<THREE.Mesh>(null!);

  // anchor every frame once; derive size unit + auto-fit scale/offset over the whole clip (incl. legs+head)
  const { frames, unit, scale, offset } = useMemo(() => {
    const fr = poses.map(anchor67);
    const f0 = fr.find((a) => d3(a[1], a[8]) > 1e-3) || fr[0] || [];
    const u = f0.length ? Math.max(d3(f0[1], f0[8]), d3(f0[2], f0[5]) * 0.9, 0.3) : 1;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const a of fr) {
      for (let i = 0; i < 67; i++) { const x = a[i][0], y = -a[i][1]; if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
      const hip = a[8], nose = a[0], neck = a[1];
      const headY = (d3(nose, neck) > 0.12 * u ? -nose[1] : -(neck[1] + (hip[1] - neck[1]) * 0.4)) + 0.2 * u;
      if (headY > ymax) ymax = headY;
      const feetY = -hip[1] - (0.02 + THIGH + SHIN + FOOT_DROP) * u;
      if (feetY < ymin) ymin = feetY;
      const lx = hip[0] + (PELVIS_W + 0.09) * u, rx = hip[0] - (PELVIS_W + 0.09) * u;
      if (lx > xmax) xmax = lx; if (rx < xmin) xmin = rx;
    }
    const h = Math.max(ymax - ymin, 1e-3), w = Math.max(xmax - xmin, 1e-3);
    const s = 2.55 / Math.max(h, w * 1.15);
    return { frames: fr, unit: u, scale: s, offset: [-(xmin + xmax) / 2 * s, -(ymin + ymax) / 2 * s] as [number, number] };
  }, [poses]);

  useFrame((_, dt) => {
    if (!frames.length || !bodyBones.current) return;
    if (playing) { t.current += dt * fps; if (t.current >= frames.length) t.current = 0; }
    const a = frames[Math.min(Math.floor(t.current), frames.length - 1)];
    const hip = a[8];

    DRAW_BODY.forEach(([i, j], k) => {
      va.set(a[i][0], -a[i][1], a[i][2]); const pa = va.clone();
      vb.set(a[j][0], -a[j][1], a[j][2]);
      setBone(bodyBones.current, k, pa, vb, bodyBoneR(i, j, unit));
    });
    BODY_JOINTS.forEach(([i, r], k) => { va.set(a[i][0], -a[i][1], a[i][2]); setSphere(bodyJoints.current, k, va, r * unit); });

    [25, 46].forEach((off, hnd) => {
      HAND_BONES.forEach(([i, j], k) => {
        va.set(a[off + i][0], -a[off + i][1], a[off + i][2]); const pa = va.clone();
        vb.set(a[off + j][0], -a[off + j][1], a[off + j][2]);
        setBone(handBones.current, hnd * HAND_BONES.length + k, pa, vb, 0.024 * unit);
      });
      for (let i = 0; i < 21; i++) { va.set(a[off + i][0], -a[off + i][1], a[off + i][2]); setSphere(handJoints.current, hnd * 21 + i, va, 0.026 * unit); }
    });

    // static legs from the hip
    const L = legPoints(hip, unit);
    const legB: [number[], number[], number][] = [
      [L.H, L.hipL, 0.11 * unit], [L.H, L.hipR, 0.11 * unit],
      [L.hipL, L.kneeL, 0.09 * unit], [L.hipR, L.kneeR, 0.09 * unit],
      [L.kneeL, L.ankL, 0.07 * unit], [L.kneeR, L.ankR, 0.07 * unit],
      [L.ankL, L.toeL, 0.055 * unit], [L.ankR, L.toeR, 0.055 * unit],
    ];
    legB.forEach(([pa, pb, r], k) => { va.set(pa[0], pa[1], pa[2]); const A = va.clone(); vb.set(pb[0], pb[1], pb[2]); setBone(legBones.current, k, A, vb, r); });
    const legJ: [number[], number][] = [[L.hipL, 0.10], [L.hipR, 0.10], [L.kneeL, 0.075], [L.kneeR, 0.075], [L.ankL, 0.06], [L.ankR, 0.06]];
    legJ.forEach(([p, r], k) => { va.set(p[0], p[1], p[2]); setSphere(legJoints.current, k, va, r * unit); });

    // head at the nose (0); if nose degenerate, sit it above the neck
    const nose = a[0], neck = a[1];
    if (d3(nose, neck) > 0.12 * unit) vm.set(nose[0], -nose[1], nose[2]);
    else vm.set(neck[0], -(neck[1] + (hip[1] - neck[1]) * 0.4), neck[2]);
    head.current.position.copy(vm); head.current.scale.setScalar(0.18 * unit);

    bodyBones.current.instanceMatrix.needsUpdate = true;
    bodyJoints.current.instanceMatrix.needsUpdate = true;
    handBones.current.instanceMatrix.needsUpdate = true;
    handJoints.current.instanceMatrix.needsUpdate = true;
    legBones.current.instanceMatrix.needsUpdate = true;
    legJoints.current.instanceMatrix.needsUpdate = true;
  });

  const skin = <meshStandardMaterial color="#EC6A4E" roughness={0.5} metalness={0.05} />;
  const gold = <meshStandardMaterial color="#F4B81F" roughness={0.4} metalness={0.1} />;

  return (
    <group scale={scale} position={[offset[0], offset[1], 0]}>
      <instancedMesh ref={bodyBones} args={[undefined, undefined, DRAW_BODY.length]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[1, 1, 1, 14]} />{skin}
      </instancedMesh>
      <instancedMesh ref={bodyJoints} args={[undefined, undefined, BODY_JOINTS.length]} frustumCulled={false} castShadow>
        <sphereGeometry args={[1, 20, 20]} />{skin}
      </instancedMesh>
      <instancedMesh ref={legBones} args={[undefined, undefined, LEG_BONES_N]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[1, 1, 1, 12]} />{skin}
      </instancedMesh>
      <instancedMesh ref={legJoints} args={[undefined, undefined, LEG_JOINTS_N]} frustumCulled={false} castShadow>
        <sphereGeometry args={[1, 16, 16]} />{skin}
      </instancedMesh>
      <instancedMesh ref={handBones} args={[undefined, undefined, HAND_BONES.length * 2]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[1, 1, 1, 8]} />{gold}
      </instancedMesh>
      <instancedMesh ref={handJoints} args={[undefined, undefined, 21 * 2]} frustumCulled={false} castShadow>
        <sphereGeometry args={[1, 10, 10]} />{gold}
      </instancedMesh>
      <mesh ref={head} castShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#EC6A4E" roughness={0.45} metalness={0.05} />
      </mesh>
    </group>
  );
}

export default function Signer({ poses, fps = 30, playing = true }: { poses: number[][]; fps?: number; playing?: boolean }) {
  const empty = !poses?.length;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 18, overflow: "hidden",
      background: "radial-gradient(120% 90% at 50% 0%, #1a2340 0%, #0c1122 60%, #080b16 100%)" }}>
      {empty ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#5b6b8c", fontSize: 14 }}>
          Avatar idle — translate something to sign it
        </div>
      ) : (
        <Canvas shadows camera={{ position: [0, 0, 3.4], fov: 42 }} dpr={[1, 2]}>
          <hemisphereLight args={["#cfe0ff", "#20263a", 0.65]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[2.5, 4, 4]} intensity={1.25} castShadow shadow-mapSize={[1024, 1024]} />
          <pointLight position={[-3, 1, 2]} intensity={0.5} color="#F4B81F" />
          <Rig poses={poses} fps={fps} playing={playing} />
          <OrbitControls enablePan={false} minDistance={1.8} maxDistance={7} target={[0, 0, 0]} />
        </Canvas>
      )}
    </div>
  );
}
