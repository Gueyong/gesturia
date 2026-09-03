# GESTURIA — THE ROOT-UP REBUILD
### Built with the deaf community of Cameroon, or not at all.
*2026-09-03 — written the day the community judged us. They were right.*

---

## 1. The honest state (no varnish)

The audit of all 3,713 dictionary signs (`scripts/triage_dictionary.py`, report in
`reports/dictionary_triage.json`) says what the professionals saw:

| Verdict | Signs | Meaning |
|---|---|---|
| **RED** | **1,715 (46%)** | The extractor recorded it was blind (hand coverage <45%) or fingers came out dead/noisy. These were performed anyway. **Now quarantined — they fingerspell instead.** |
| **YELLOW** | 1,605 (43%) | Extraction was unsure (45–72% coverage, noisy). Serve provisionally, priority for review. |
| **GREEN** | 393 (11%) | Strong extraction signal. STILL not "correct" until a fluent signer approves it. |

Why it happened, in order of importance:

1. **Wrong language.** WLASL/ASL-Citizen are American Sign Language. Cameroon signs CamSL — an
   ASL+LSF blend with real regional languages (Douala SL, Bamenda SL, Maroua SL / Extreme-North
   CamSL). Even a *perfect* extraction of an ASL sign can read as foreign or wrong to a
   Cameroonian professional.
2. **Source pixels.** Research videos carry ~45px hands. No extractor on earth recovers exact
   handshape from 45 pixels. Professional *signers*, amateur *capture* — for our purpose.
3. **No verification loop.** Nothing was ever approved by a fluent signer before being served.
   Machine metrics were treated as truth. That was the core process failure — and it is the one
   thing that can never happen again.
4. Monocular 3D lifting noise + a retarget/render chain that until recently added its own errors
   (many now fixed and render-verified, but fixes to a wrong-language, low-signal dictionary
   cannot make it right).

**The law, from today:** *Gesturia never performs a sign no fluent signer has trusted.*
Trust = native-signer approval in review, or analytically authored closed sets (alphabet, digits).
Everything else is provisional or quarantined. Fingerspelling — which never lies — covers the gap.

---

## 2. What shipped today (already live)

- **Triage + quarantine.** Every RED sign fingerspells instead of performing garbage.
- **Native-signer review** (`/review` page + `/v1/review/*`): a fluent signer watches each sign
  exactly as stored and rules — Approve / Reject (never performs again) / Re-record. Keyboard-fast
  (A/R/E/S), decisions signed with the reviewer's name, persisted, and they override everything.
  Throughput math: ~6s per ruling → **the whole dictionary is reviewable in ~6 focused hours**;
  a 5-person community session clears it in an afternoon.
- **Verified-only mode** (`GESTURIA_VERIFIED_ONLY=1`): for professional/government settings —
  performs ONLY approved + authored signs, fingerspells everything else. Zero bluffing.
- **Authored digits 0–9** (exact ASL number handshapes, palm-in 1–5 / palm-out 6–9), joining the
  authored alphabet. Numbers appear in every government demo; they are now exact by construction.
- **Multi-dialect foundation** (`dialects.py`): signs collected, stored, reviewed and served
  **per region** — `CM-NATIONAL` + the ten regions. Resolution chain: requested region →
  CM-NATIONAL → legacy. Community data beats legacy the moment it exists. Intake
  (`/v1/vocab/commit-params` with `region` + `signer`) stores provenance and the sign
  **cannot perform until its region's signers approve it** (the door law).
- The legacy ASL-derived dictionary is hereby a **placeholder scheduled for replacement**, not a
  foundation.

## 3. The doors — highest-precision intake for Cameroonian recordings

When the community hands us video, what Gesturia makes of it must be the best the world knows how.

**3a. Recording protocol (what to tell the signers)** — per sign, 3 takes:
- 1080p minimum (any modern phone), 30fps+, landscape, tripod or propped phone.
- Signer framed hips-to-above-head, **hands never leave frame**; plain background, front light
  (window facing the signer), no backlight.
- The money shot: hands ≥200px across in frame — stand ~1.5–2m from a phone at 1080p.
- One sign per clip (2–4s), neutral rest → sign → neutral rest. Say/mouth the word naturally —
  facial grammar is part of the language and IS captured.
- Name files `REGION_GLOSS_SIGNER_TAKE.mp4` (e.g. `CM-CENTRE_BONJOUR_MARIE_1.mp4`), or ingest
  through the vocab studio which tags region + signer automatically.

**3b. Extraction bench (before trusting any lifter on community data)** — with the first ~20
community clips: run the current pipeline (Multi-HMR + WiLoR) against upgrade candidates —
video-native hand models (HaPTIC — extends HaMeR with temporal trajectory; Hamba; WiLoR-video),
SMPLest-X for whole body, SMIRK for the face. Judge every candidate **on the avatar** at
microscope zoom, side-by-side with the source video, and let a fluent signer pick. The winner
becomes the door. Nothing is assumed good — the bench decides.

**3c. Where the ceiling really is — deaf-led motion capture.** The systems the deaf community
actually accepts (research consensus + industry practice: Signapse-class production, mocap-driven
avatar pipelines) capture native signers with markers/sensors on face, body and fingers — not
monocular lifting. The affordable path for Cameroon:
- **Rokoko Smartgloves (~$895/pair)** for finger-exact capture, phone video for body+face —
  a hybrid studio for under $1,000 that rivals lab pipelines on the part that matters most (hands).
- StretchSense MoCap Pro (~$3.5k) / Perception Neuron ($1.5k) as the scale-up tier — Perception
  Neuron is literally what published ASL-recognition research uses.
- Grant line item: **one community capture kit** = gloves + tripod + light + phone mount.

## 4. The community program (what to bring to the president of the deaf community)

1. **Review sessions first** (this week): fluent signers clear the existing dictionary on
   `/review` — approve what is genuinely right, kill the rest. Output: the honest verified
   vocabulary, however small. Small and true beats large and false, in front of government most
   of all.
2. **Recording days, region by region**: start with CM-CENTRE (Yaoundé) — the 200 most-used
   everyday signs per the protocol above, native signers, 3 takes each. One afternoon per ~100
   signs per signer. Each region's deaf association owns THEIR dialect's store.
3. **Ingest → review → live**: every recorded sign flows through the door (extraction bench
   winner), lands in its region's store with the signer's name, appears in review, and performs
   the moment their community approves it. The signers see their own signing on the avatar —
   they are the QA, the teachers, and the authors.
4. **Dialect-aware product**: translation requests carry the region; regional users see their own
   signs, with CM-NATIONAL as the shared floor. (Only ~10 interpreters serve ~30,000 deaf
   Cameroonians — regional correctness is not a luxury, it is the product.)

## 5. Bar for the government demo

- Verified-only mode ON. Every performed sign approved by a named fluent signer.
- The demo vocabulary: community-recorded, community-approved, in the audience's dialect.
- Numbers, names, and anything unverified: fingerspelled exactly (authored, verified by
  construction).
- Shown WITH members of the deaf community on stage — Gesturia is built with them, and the
  provenance page proves it (every sign carries its signer and its approver).

## 6. What I will not do again

- Claim "fixed" from my own metrics. A sign fix is DONE when a fluent signer approves it —
  "changed, awaiting deaf review" until then.
- Serve anything the extractor itself flagged as blind.
- Build features on top of unverified foundations before the foundation is verified.

*Sources: SignAvatars (ECCV — 70k-video SMPL-X sign dataset), mocap sign-language dataset
literature (LREC/aclanthology; Mada/Nafath technical reports), HaPTIC (arXiv 2501.08329),
WiLoR (CVPR 2025), Rokoko/StretchSense/Perception Neuron pricing (vendor pages, fxguide),
Cameroon sign-language documentation (ELAR archive: Extreme-North CamSL; Kentalis Cameroon;
African sign-language surveys).*
