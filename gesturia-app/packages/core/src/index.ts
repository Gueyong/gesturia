export * from "./types";
export * from "./client";
export * from "./theme";

/** Decode SMPL-X-ish pose frames into the structure the <Signer> drives. */
export function framesFromAnimation(a: { poses: number[][]; blend_weights?: number[][]; fps?: number }) {
  return { poses: a.poses || [], blends: a.blend_weights || [], fps: a.fps || 30, n: (a.poses || []).length };
}
