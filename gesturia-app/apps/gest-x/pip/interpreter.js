/* Gest-X self-contained floating interpreter — Olo signs anything you hear.
 * Renders the SMPL-X avatar itself (bundled three.js, no dependency on the web app), and interprets:
 *   - your MICROPHONE (speak and be signed)
 *   - THIS TAB's audio
 *   - SYSTEM / any-app audio (a movie in VLC, a call, anything) via getDisplayMedia("share system audio")
 *   - selected text (?text=...)
 * Audio -> server feed (whisper) -> signs. A NO-DROP FIFO queue: words never get thrown away for being
 * late; when signing falls behind it catches up a touch (max ~1.25x, stays legible) and shows the lag.
 */
import * as THREE from "../vendor/three.module.min.js";

const API = "http://127.0.0.1:8020";   // 127.0.0.1 not "localhost": Windows resolves localhost to IPv6 first (~2s failover)
const qs = new URLSearchParams(location.search);
const SESSION = "gx" + Math.random().toString(36).slice(2, 10);   // continuity key for smooth transitions

// ---------------- avatar renderer ----------------
let renderer, scene, camera, meshObj, geom;
let facesU32 = null, colorsU8 = null, geoReady = false;
const vcache = new Map();                 // vertsUrl -> Promise<Float32Array>
const queue = [];                         // FIFO clips {url, facesUrl, frames, nverts, fps} — NEVER dropped
let cur = null;                           // {url, verts, frames, nverts, fps}
let tcur = 0, rate = 1, paused = false;
let lastPose = null, blend = 1, advancedFor = "";
let signedCount = 0;

function initThree(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 3.6);
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x20263a, 0.75));
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const d = new THREE.DirectionalLight(0xffffff, 1.3); d.position.set(2.5, 4, 4); scene.add(d);
  const p = new THREE.PointLight(0xF4B81F, 0.5); p.position.set(-3, 1, 2); scene.add(p);
  geom = new THREE.BufferGeometry();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide });
  meshObj = new THREE.Mesh(geom, mat);
  meshObj.rotation.x = Math.PI;           // data canonicalized up=-y -> rotate 180° about X
  scene.add(meshObj);
  resize();
  window.addEventListener("resize", resize);
  renderer.setAnimationLoop(frame);
}
function resize() {
  const c = renderer.domElement, w = c.clientWidth || 320, h = c.clientHeight || 380;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

function loadVerts(url) {
  if (!vcache.has(url)) {
    vcache.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => new Float32Array(b)));
    if (vcache.size > 14) { const k = vcache.keys().next().value; if (k && k !== url) vcache.delete(k); }
  }
  return vcache.get(url);
}
async function ensureStatics(clip) {
  if (!facesU32) facesU32 = await fetch(clip.facesUrl).then((r) => r.arrayBuffer()).then((b) => new Uint32Array(b));
  if (colorsU8 === null) colorsU8 = await fetch(`${API}/v1/smplx/asset/colors`).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => b ? new Uint8Array(b) : undefined).catch(() => undefined);
}

let loadingHead = "";
async function pumpHead() {
  const head = queue[0];
  if (!head || head.url === loadingHead) return;
  loadingHead = head.url;
  try {
    await ensureStatics(head);
    const verts = await loadVerts(head.url);
    if (queue[1]) loadVerts(queue[1].url);            // prefetch next
    if (!geoReady) {
      geom.setIndex(new THREE.BufferAttribute(facesU32, 1));
      geom.setAttribute("position", new THREE.BufferAttribute(verts.slice(0, head.nverts * 3), 3));
      if (colorsU8 && colorsU8.byteLength === head.nverts * 3) geom.setAttribute("color", new THREE.BufferAttribute(colorsU8, 3, true));
      geom.computeVertexNormals(); geoReady = true;
    }
    if (cur) { const pos = geom.getAttribute("position"); if (pos) { lastPose = pos.array.slice(); blend = 0; } }
    cur = { url: head.url, verts, frames: head.frames, nverts: head.nverts, fps: head.fps };
    tcur = 0;
  } catch (e) {
    // a broken clip must never stall the queue
    if (queue.length > 1) { queue.shift(); loadingHead = ""; pumpHead(); }
  }
}

let lastT = performance.now();
function frame() {
  const now = performance.now(); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!cur || !geoReady) { renderer.render(scene, camera); if (queue[0]) pumpHead(); return; }
  // legible catch-up: a touch faster when the backlog is deep, capped so signs stay readable; never drop
  const behind = Math.max(0, queue.length - 2);
  const speed = rate * (1 + Math.min(0.25, 0.05 * behind));
  if (!paused) tcur += dt * cur.fps * speed;
  let fi = Math.floor(tcur);
  if (fi >= cur.frames) {
    if (queue.length > 1 && advancedFor !== cur.url) {
      advancedFor = cur.url; queue.shift(); loadingHead = ""; pumpHead(); fi = cur.frames - 1;
    } else fi = cur.frames - 1;                        // hold last pose until more arrives (never loop/skip)
  }
  const stride = cur.nverts * 3;
  const pos = geom.getAttribute("position"); if (!pos) return;
  const pa = pos.array;
  const off = fi * stride;
  if (blend < 1 && lastPose && lastPose.length === stride) {
    blend = Math.min(1, blend + dt / 0.07);   // short seam-smoother; server does rotation-space continuity
    for (let i = 0; i < stride; i++) pa[i] = lastPose[i] * (1 - blend) + cur.verts[off + i] * blend;
  } else {
    for (let i = 0; i < stride; i++) pa[i] = cur.verts[off + i];
  }
  pos.needsUpdate = true; geom.computeVertexNormals();
  renderer.render(scene, camera);
  updateStatus();
}

function enqueueMesh(m) {                              // NO DROP — always append
  queue.push({ url: `${API}/v1/smplx/mesh/${m.token}/verts`, facesUrl: `${API}/v1/smplx/mesh/${m.token}/faces`,
               frames: m.frames, nverts: m.nverts, fps: m.fps });
  signedCount++;
  if (!cur) pumpHead();
}

// ---------------- feed (audio -> whisper -> signs) ----------------
let sid = null, seqAfter = 0, pollTimer = null;
async function ensureFeed() {
  if (sid) return sid;
  const r = await fetch(`${API}/v1/stream/feed/start`, { method: "POST" });
  sid = (await r.json()).id; seqAfter = 0;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollFeed, 1200);
  return sid;
}
async function pollFeed() {
  if (!sid) return;
  try {
    const j = await (await fetch(`${API}/v1/stream/${sid}/poll?after=${seqAfter}`)).json();
    for (const ev of j.events || []) {
      seqAfter = Math.max(seqAfter, ev.seq);
      if (ev.mesh?.token) enqueueMesh(ev.mesh);
      if (ev.text) pushCaption(ev.text);
    }
  } catch { /* transient */ }
}
async function signText(text) {
  const t = (text || "").trim(); if (!t) return;
  try {
    const m = await (await fetch(`${API}/v1/smplx/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t, session: SESSION }) })).json();
    if (m.token) { enqueueMesh(m); pushCaption(t); }
  } catch (e) { setStatus("translate failed", true); }
}

// ---------------- audio capture ----------------
let audioStream = null, recorder = null, capturing = false, captureLabel = "", tabEcho = null;
function stopCapture() {
  capturing = false;
  try { recorder && recorder.state !== "inactive" && recorder.stop(); } catch {}
  try { audioStream && audioStream.getTracks().forEach((t) => t.stop()); } catch {}
  try { tabEcho && tabEcho.close(); } catch {}
  audioStream = null; recorder = null; captureLabel = ""; tabEcho = null;
  document.querySelectorAll(".src").forEach((b) => b.classList.remove("on"));
  setStatus("stopped");
}
function recordLoop(stream) {
  let first = true;
  const cycle = () => {
    if (!capturing || !stream.active) return;
    let rec;
    try { rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" }); }
    catch { rec = new MediaRecorder(stream); }
    recorder = rec; const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      if (blob.size > 1500 && sid) { try { await fetch(`${API}/v1/stream/${sid}/feed`, { method: "POST", body: blob }); } catch {} }
      cycle();
    };
    rec.start();
    // short first blob so the first sign lands ~2s in; then longer windows -> more context = fewer
    // mis-hears (Whisper is far more accurate on ~5s than on 3.5s, at a small latency cost)
    const dur = first ? 2200 : 5000; first = false;
    setTimeout(() => { try { rec.state !== "inactive" && rec.stop(); } catch {} }, dur);
  };
  cycle();
}
async function startSource(kind) {
  stopCapture();
  try {
    let stream;
    if (kind === "mic") {
      // clean the VOICE for Whisper: echo-cancel + denoise + auto-gain lift accuracy a lot vs raw mic
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      captureLabel = "microphone";
    } else if (kind === "system") {
      // any app / movie on the PC: user picks a screen/window and ticks "Share system audio"
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const at = ds.getAudioTracks()[0];
      ds.getVideoTracks().forEach((t) => t.stop());   // we only need the audio
      if (!at) { setStatus("no system audio — tick 'Share audio'", true); return; }
      stream = new MediaStream([at]);
      captureLabel = "system audio";
    } else if (kind === "tab") {
      const resp = await new Promise((res) => chrome.runtime.sendMessage({ type: "gestx-tabid" }, (r) => res(r || { error: "no response" })));
      if (resp.error || !resp.streamId) {
        setStatus("Tab audio: " + (resp.error || "no capturable tab — play audio in a normal web tab, then try again"), true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: resp.streamId } } });
      } catch (e) { setStatus("Tab audio failed: " + (e?.message || e), true); return; }
      // tab-capture MUTES the page by default -> route the audio back so the user still hears the video
      try { tabEcho = new AudioContext(); tabEcho.createMediaStreamSource(stream).connect(tabEcho.destination); } catch {}
      captureLabel = "browser tab";
    }
    if (!stream) return;
    audioStream = stream; capturing = true;
    await ensureFeed();
    recordLoop(stream);
    document.querySelectorAll(".src").forEach((b) => b.classList.toggle("on", b.dataset.k === kind));
    setStatus(`listening — ${captureLabel}`);
  } catch (e) {
    setStatus((e && e.name === "NotAllowedError") ? "permission denied" : "capture failed", true);
  }
}

// ---------------- UI ----------------
const capEl = () => document.getElementById("cap");
const statusEl = () => document.getElementById("status");
const qEl = () => document.getElementById("qdepth");
let capWords = [];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function pushCaption(text) {
  const added = text.split(/\s+/).filter(Boolean);
  if (!added.length) return;
  capWords = capWords.concat(added).slice(-18);
  const e = capEl(); if (!e) return;
  const freshFrom = Math.max(0, capWords.length - added.length);   // just-heard words glow gold
  e.innerHTML = capWords.map((w, i) => `<span class="word${i >= freshFrom ? " fresh" : ""}">${esc(w)}</span>`).join(" ");
}
function setStatus(msg, warn) { const e = statusEl(); if (e) { e.textContent = msg; e.style.color = warn ? "#CF4629" : "#9C9179"; } }
function updateStatus() {
  const e = qEl(); if (!e) return;                    // brand palette: muted -> gold -> coral as backlog grows
  const n = queue.length;
  if (n > 1) { e.innerHTML = `<span class="dot"></span>${n - 1} behind`; e.style.color = n > 6 ? "#CF4629" : n > 3 ? "#F4B81F" : "#9C9179"; }
  else { e.textContent = cur ? "live" : ""; e.style.color = "#9C9179"; }
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5];
function bindUI() {
  document.querySelectorAll(".src").forEach((b) => b.addEventListener("click", () => {
    if (b.classList.contains("on")) stopCapture(); else startSource(b.dataset.k);
  }));
  const sp = document.getElementById("speed");
  sp && sp.addEventListener("click", () => { rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; sp.textContent = rate + "×"; });
  const pa = document.getElementById("pause");
  pa && pa.addEventListener("click", () => { paused = !paused; pa.textContent = paused ? "▶" : "⏸"; });
  const pin = document.getElementById("pin");
  pin && pin.addEventListener("click", enterDocPiP);
  // ⌨️ toggles the text-input row so it never overlaps the captions and frees space when unused
  const kbd = document.getElementById("kbd");
  const row = document.getElementById("inputRow");
  const inp = document.getElementById("textin");
  kbd && kbd.addEventListener("click", () => {
    const show = row.hasAttribute("hidden");
    if (show) { row.removeAttribute("hidden"); kbd.classList.add("on"); inp && inp.focus(); }
    else { row.setAttribute("hidden", ""); kbd.classList.remove("on"); }
    setTimeout(resize, 30);   // stage height changed -> keep the avatar crisp
  });
  const send = document.getElementById("send");
  const go = () => { if (inp && inp.value.trim()) { signText(inp.value); inp.value = ""; } };
  send && send.addEventListener("click", go);
  inp && inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}

// float over everything (incl. outside the browser) via Document Picture-in-Picture
async function enterDocPiP() {
  try {
    if (!("documentPictureInPicture" in window)) { setStatus("PiP unsupported — window already floats", false); return; }
    const pw = await window.documentPictureInPicture.requestWindow({ width: 320, height: 420 });
    document.querySelectorAll("style,link[rel=stylesheet]").forEach((s) => pw.document.head.appendChild(s.cloneNode(true)));
    pw.document.body.appendChild(document.getElementById("app"));
    // three renders into the same canvas which moved with #app
    setTimeout(resize, 50);
  } catch (e) { setStatus("PiP blocked", true); }
}

// ---------------- boot ----------------
window.addEventListener("DOMContentLoaded", () => {
  initThree(document.getElementById("stage"));
  bindUI();
  const text = qs.get("text");
  if (text) { signText(text); pushCaption(text); }
  const preSid = qs.get("sid");
  if (preSid) { sid = preSid; seqAfter = 0; pollTimer = setInterval(pollFeed, 1200); setStatus("live feed"); }
  setStatus(text ? "signing selection" : "pick a source to interpret");
});
