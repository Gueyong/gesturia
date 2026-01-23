# Gesturia — a country of gestures

Real-time, 3D sign-language translation and learning. Speech and text become a signing avatar; a webcam
grades how precisely you sign. Built for bilingual (English/French) live events and classrooms.

> This is the **app** repository (web + browser extension + launchers). The Python engine
> (translation API, 3D extraction, evaluator) lives in its own repo at `C:\gesturia-train\proj`.

## Products

| Surface | Route | What it is |
|---|---|---|
| **Gestlingua** | `/studio` | Speak / type / stream → a live 3D interpreter. Mic auto-detects language (EN/FR). |
| **Gestsolo** | `/solo` | "Duolingo for hands" — learn signs from a 3D teacher, then **perform them to your camera and get graded**. |
| **Gestaula** | `/aula` | Classroom / live-session bridge. |
| **Gestify** | `/verify` | Certificates (Gestificates) on a public registry. |
| **Gest-X** | `apps/gest-x` | Browser extension — sign any tab / system / mic audio, floating over anything. |

## Run it (one click)

```
Start Gesturia.bat        # starts the engine (:8020) + web (:3003), opens the Studio
Extract Videos.bat        # drag a folder of sign videos to lift them into the dictionary
```

Both use `START_GESTURIA.ps1`. Open **http://127.0.0.1:3003** (use `127.0.0.1`, not `localhost` —
Windows resolves `localhost` to IPv6 first and adds ~2 s per request).

## The evaluator (Gestsolo)

Webcam → MediaPipe hand + pose landmarks → the server scores your sign along the four phonological
parameters of sign language — **handshape, location, movement, palm orientation** — plus an overall
0-100 with feedback. Fully offline: run once after `npm install`:

```
powershell -File apps/web-gesturia/scripts/setup-mediapipe.ps1
```

## Layout

```
gesturia-app/
  apps/web-gesturia/     # Next.js app — all product surfaces
    app/                 # routes (studio, solo, aula, verify, gestx, watch, ...)
    components/          # MeshSigner (SMPL-X avatar), SignEvaluator (webcam judge), ...
  apps/gest-x/           # browser extension (self-contained interpreter)
  packages/              # shared code
START_GESTURIA.ps1       # launcher
```

## Stack

Next.js (App Router) · React Three Fiber (SMPL-X mesh) · MediaPipe Tasks (webcam capture) ·
FastAPI engine (separate repo). Brand & identity: `gesturia-app/docs`.
