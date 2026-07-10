# GESTURIA — Conference Runbook (Healing Streams, July 6)

## Bring everything up (after any reboot / crash)

```
powershell -File C:\Users\lenovo\Documents\gesturia\START_GESTURIA.ps1
```

One script: starts the engine (:8020, network-bound, GPU translate) + the web app (:3003),
disables sleep, verifies both, prints all URLs including the phone/LAN address.

## The broadcast, step by step

1. Open **http://localhost:3003/studio** (Gestlingua).
2. **Stream** tab → paste the Healing Streams link (YouTube live or any platform/m3u8) → **Interpret**.
3. Pastor Chris appears in the stage; the interpreter signs in his movable box; captions run below.
4. **Share** (gold button) → copies the public viewer link → send to anyone on the network.
5. **TV**: add that viewer link as a *Browser Source* in OBS → stream to any RTMP destination.
6. Player controls (bottom-left of stage): fullscreen · pause · restart · speed (0.5×–1.25×).
   Viewers can tap any phrase in "Phrases" to replay it.

## If something goes wrong mid-service

| Symptom | Fix |
|---|---|
| Avatar stops / API dead | Re-run START_GESTURIA.ps1 (10 s outage; viewers auto-reconnect on next poll) |
| F: drive disconnects | NOTHING breaks — every sign falls back to the C: mirror automatically |
| Stream audio stalls | Stop → Interpret again (new session resolves fresh) |
| Whole PC reboots | START_GESTURIA.ps1, then re-paste the stream link |

## Where things live

- Engine: `C:\gesturia-train\proj` (venv: `C:\gesturia-train\venv`) — logs in `proj\reports\`
- Web app: `C:\Users\lenovo\Documents\gesturia\gesturia-app\apps\web-gesturia`
- Dictionary: `F:\signavatars\lifted_3d` (mirror: `C:\gesturia-train\mirror\lifted_3d`)
- Whisper model (local, no internet needed): `C:\gesturia-train\whisper_models`
- Extension (Gest-X): `gesturia-app\apps\gest-x` → chrome://extensions → Load unpacked

## The demo tour (for guests / press / ministry)

1. `/` — the vision. 2. `/studio` — speak, he signs as you talk. 3. `/solo` — tell Uria your
name, walk "Say hello", earn a Gestificate. 4. `/verify/<your serial>` — your name on a national
document. 5. `/aula` — type a lesson, Lea signs it. 6. `/gestx` — select a sentence, watch the
floating interpreter sign it.

*Gesturia. A country of gestures. Every sign belongs somewhere.*
