# THE GESTURIA DOOR — extraction pipeline, every layer, every law
*The door is how a signer's video becomes a sign in the dictionary. Every law below was paid for
by a named defect. Nothing here is assumed good — every layer is measured, render-verified, and
review-gated. Written 2026-09-04 (the night loop), maintained as the door evolves.*

## Architecture: separate layers, composed at serve time

```
video ─► HANDS+BODY (v3_extract, wilor_venv) ──► smplx (T,182)     ─┐
      ─► FACE PASS (face_pass.py, main venv)  ─► face layer         ├─► SIGN.pkl
      ─► EVIDENCE (2D truth: kp px, depth, anchors) ─► evidence     │   (layers stored apart)
                    HANDSHAPE PASS (holds → consensus)  ─ in place  │
                    CONTACT PASS (solver on evidence)   ─ in place ─┘
serve: coarticulate.load_params composes face onto motion (GESTURIA_FACE=0 disables)
```
Each layer re-runs alone; deleting a layer reverts it; hands/body bytes never change when face or
contact re-run. Orchestrated by `scripts/lift_one_video.py` (the vocab studio's lifter).

## Layer 1 — hands + body (`v3_extract.py`, deployed at C:\gesturia-train\multihmr)

Multi-HMR (body, orientation, arms) + WiLoR (hands). The hand reader is a three-tier chain:
1. **Native-resolution detection** (adaptive imgsz to the frame, conf 0.1, size sanity band).
   *Law origin: the stock pipeline detected hands on a ~512px downscale of 1080p footage — 32% of
   HELLO's frames blind on studio video (68%→96% after the fix).*
2. **Tracked rescue**: a miss re-runs the pose head on the last-known box, re-tracks from the
   hand's own predicted keypoints; a hand undetected for 8 true frames is gone.
3. **Body-wrist anchor**: when detection+track fail, the crop comes from Multi-HMR's projected
   wrist — the body never lost tracking on any bench clip. Anchored reads never steer the tracker
   and are reported separately (`handX_anchor`). *Origin: contact/overlap blinds the detector
   (GIRL 0.58→1.00, MOTHER 0.67→1.00).*

**Rest laws.** A run of anchor-only reads whose anchor stays still is suppressed; a hand whose
wrist never travels a hand's length in the whole clip is RESTING the whole clip → rendered
neutral, flagged `handX_rest` (triage honors the flag: quiet ≠ blind — BOY was quarantined by his
own resting hand before the flag existed). *Origin: claw poses at clip edges; THANK_YOU's phantom.*

**Label continuity.** One physical hand never wears both labels: when L and R land within a
hand's breadth, track history decides which stays. *Origin: 31% of THANK_YOU frames double-labeled
— the phantom second hand.*

**Wrist graft.** Palm orientation comes from WiLoR's hand global orientation (seen up close, same
camera), not the body model's weakest joint: `wrist_local = R_forearm(MH chain)^T · R_hand(WiLoR)`.
*Origin: BOY's inward half-curl end.*

## Layer 2 — face (`scripts/face_pass.py`)

MediaPipe FaceLandmarker (Apache-2.0) on the same frame selection; blendshapes map through the
SAME calibrated directions the live mirror uses. Stored under `face`; composed at serve. Also
exports the contact anchors in pixels: forehead, nose, lips, chin, jaw-left/right.
*Windows lesson: np.load holds the npz open — eager-copy + close before delete.*

## Layer 3 — handshape consensus (`scripts/handshape_pass.py`)

A handshape is a linguistic unit, not 60 per-frame guesses (SGNify's constancy prior, implemented
natively). Hold phases (low finger velocity) snap to the confidence-weighted consensus shape
(det > rescue > anchor; outliers rejected); transitions keep motion; wrists same treatment. Runs
BEFORE contact (contact FK depends on final fingers).

## Layer 4 — contact solve (`contact_solve.py` via `scripts/contact_pass.py`)

The video's own 2D is ground truth for WHAT TOUCHED WHAT; monocular depth error (MOTHER's thumb
10.4cm off the chin, THANK_YOU 19.5cm) is corrected by direct optimization (torch autograd on
shoulders+elbows through the real SMPL-X forward — analytic IK fought an unknown global frame and
diverged). Laws:
- **Sliding targets**: face contact is a POSITION (two-anchor blend per frame), not a joint —
  pinned targets erased GIRL's jaw stroke.
- **Identity by majority; ambiguity = abstain** (<60% majority → no action). **Dominant-anchor**:
  one face-contact story per clip; fly-by runs die (MOTHER's nose approach). Taps stay separate —
  only detected frames fill.
- **Resting hands can't be partners** (recently-active test + whole-clip travel).
- **Depth gates**: hand-vs-hand by WiLoR's own z (|Δz|≤0.30 — tighter killed FREE's true touch);
  hand-vs-face by a per-clip calibrated bridge that ABSTAINS when uncalibratable.
- **Physical gaps**: face = 1.2cm skin gap (brow anchors for the forehead — SMPL-X has no
  forehead joint and the silent nose fallback put FATHER's thumb on the nose); hand-hand = sum of
  part radii (wrist centres can't be 1.2cm apart) — interpenetration impossible by construction.
- **Torso wall** at the chest surface (0.11m — 0.06 was inside the body: hands emerged from the
  chest). **Shoulder-contact class BENCHED** (fired on every raise) until a hold-requirement design.
- Loss scales: metres² contact terms need ~60× against rad² regularizers.

## Layer 5 — multi-take fusion (`scripts/fuse_takes.py`)

All available renditions of a gloss complement each other: every direct-URL WLASL take lifts
through the full door; the REFERENCE is chosen by coverage × NET contact-region stroke (path-sum
rewards jitter; endpoints measure the sign — coverage alone picked GIRL's stroke-less take);
others DTW-align on root-relative wrist paths and donate hands/wrists by coverage-weighted
consensus (outlier frames rejected). Arms stay with the reference — no cross-signer guessing.
1 take in → honest passthrough. *First victory: GIRL's 2.8cm jaw stroke, recovered from a
secondary take her primary never contained.*

## Acceptance tests (render-verified, start+mid+end minimum, vs incumbent)

MOTHER: chin-only double tap, nose untouched. THANK_YOU: strictly one-handed. GIRL: jaw stroke
present. BOY/FATHER: forehead contact. FREE: hands touch, never pass through. All: quiet rests at
clip edges, no torso penetration, no phantom motion. *Never judge on one frame or one sign; no
silent anatomical fallbacks; roll back first on user-reported regression.*

## Open ledger

- WELCOME's long tight clasp (0.62 coverage; sole direct-URL take is the failing one) — community
  re-record class.
- FREE's fast cross defeats the hand-depth gate; serves its v3.3 result (0.22cm touch).
- 240p sources cap handshape detail regardless of coverage — fusion mitigates, re-recording cures.
- DexAvatar (WACV'26, MIT, code released) — specialized-lifter bench pending (heavy setup).
- Depth remains monocular-estimated: the community protocol's second camera turns it into
  measurement.
