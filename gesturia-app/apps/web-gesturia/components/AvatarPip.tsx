"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpDownLeftRight, faExpand, faDownLeftAndUpRightToCenter } from "@fortawesome/free-solid-svg-icons";
import MeshSigner, { type MeshClip } from "./MeshSigner";

/**
 * The Gesturia interpreter as a floating broadcast picture-in-picture:
 * drag the header to move it anywhere, drag the corner to resize, dock it back into the stage.
 */
const SIZES = { S: 210, M: 300, L: 400 } as const;
type SizeKey = keyof typeof SIZES;

export default function AvatarPip({ queue, live, loop = false, onFinished, onDock, paused, rate, restartNonce }:
  { queue: MeshClip[]; live: boolean; loop?: boolean; onFinished?: (url: string) => void; onDock?: () => void;
    paused?: boolean; rate?: number; restartNonce?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number>(SIZES.M);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const rez = useRef<{ x0: number; w0: number } | null>(null);
  const H = Math.round(w * 1.24); // portrait interpreter frame

  // default: bottom-right, once we know the viewport
  useEffect(() => {
    if (pos) return;
    const m = 24;
    setPos({ x: window.innerWidth - w - m, y: window.innerHeight - H - m });
  }, [pos, w, H]);

  const clamp = useCallback((x: number, y: number) => ({
    x: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
    y: Math.max(8, Math.min(y, window.innerHeight - H - 8)),
  }), [w, H]);

  const onDragDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-nodrag]")) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - (pos?.x ?? 0), dy: e.clientY - (pos?.y ?? 0) };
  };
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    rez.current = { x0: e.clientX, w0: w };
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
    else if (rez.current) setW(Math.max(160, Math.min(560, rez.current.w0 + (e.clientX - rez.current.x0))));
  };
  const onUp = () => { drag.current = null; rez.current = null; };

  const cycle = () => setW((cur) => {
    const order: SizeKey[] = ["S", "M", "L"];
    const i = order.findIndex((k) => SIZES[k] === cur);
    return SIZES[order[(i + 1) % order.length] ?? "M"];
  });

  if (!pos) return null;
  return (
    <div
      ref={boxRef}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{ position: "fixed", left: pos.x, top: pos.y, width: w, zIndex: 60, touchAction: "none" }}
    >
      <div
        style={{
          width: w, borderRadius: 22, overflow: "hidden", background: "#0c1120",
          border: `2px solid ${live ? "var(--coral)" : "rgba(255,255,255,.7)"}`,
          boxShadow: "var(--shadow-pop)",
        }}
      >
        {/* drag header */}
        <div
          onPointerDown={onDragDown}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 10px", cursor: "grab",
            background: "linear-gradient(180deg, rgba(8,11,20,.92), rgba(8,11,20,.35))",
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 18, height: 18, borderRadius: 6, background: "var(--coral)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 11 }}>G</span>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 12, letterSpacing: ".02em" }}>Gesturia</span>
            {live && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 10, fontWeight: 700 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--coral)" }} /> LIVE
            </span>}
          </div>
          <div style={{ display: "flex", gap: 4 }} data-nodrag>
            {onDock && <button onClick={onDock} title="Dock into the stage" style={pipBtn}><FontAwesomeIcon icon={faDownLeftAndUpRightToCenter} /></button>}
            <button onClick={cycle} title="Resize" style={pipBtn}><FontAwesomeIcon icon={faExpand} /></button>
            <span title="Drag to move" style={{ ...pipBtn, cursor: "grab" }}><FontAwesomeIcon icon={faUpDownLeftRight} /></span>
          </div>
        </div>

        {/* avatar */}
        <div style={{ width: w, height: H }}>
          <MeshSigner queue={queue} loop={loop} onFinished={onFinished} paused={paused} rate={rate} restartNonce={restartNonce} />
        </div>

        {/* resize handle */}
        <div
          onPointerDown={onResizeDown}
          data-nodrag
          style={{ position: "absolute", right: 0, bottom: 0, width: 22, height: 22, cursor: "nwse-resize",
                   display: "grid", placeItems: "center", color: "rgba(255,255,255,.6)", zIndex: 2 }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </div>
      </div>
    </div>
  );
}

const pipBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 7, border: "none", cursor: "pointer",
  background: "rgba(255,255,255,.16)", color: "#fff", fontSize: 11,
  display: "grid", placeItems: "center",
};
