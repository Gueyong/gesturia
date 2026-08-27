# GESTURIA — The Precision Report
### Deep research: why our signs aren't perfect yet, how the world's best do it, and the exact road to excellence
*2026-08-26 · prepared before the deaf-community rendezvous · forensic audit of our own 3,713 signs + published state of the art*

---

## 1 · THE VERDICT (read this first)

**The bottleneck is not our models. It is not our code. It is the pixels we feed them.**

Forensic audit of our own dictionary (300-sign random sample):

| What we measured | Result | Meaning |
|---|---|---|
| Body/arm coverage | **median 1.00** — perfect | Arms & orientation: solved. Multi-HMR does its job. |
| Right-hand confidence | median 0.56, 20% below 0.5 | Fingers degraded on 1 in 5 signs |
| **Left-hand confidence** | **median 0.50 · 41% below 0.5 · lost entirely in ~10%** | The weak hand is the weak link |
| Face channels | **empty in 76/80 signs** | Confirmed: no mouthing, no brows |
| Frames per sign | uniformly ~36 (25 fps sources) | Temporal detail capped by source frame-rate |
| **Pixels on the hand (WLASL sources)** | **~45 px median** (person bbox median 360×346; 63% of clips under 400 px tall; 100% at 25 fps) | **The smoking gun** |

WiLoR — like every state-of-the-art hand model — is trained on **256-pixel hand crops**. Our source
videos give it **~45 pixels**. Below ~100 px, finger articulation *is not present in the data*.
No model on Earth reconstructs what the pixels never contained. The same physics explains the
vocab recorder: it captured at **640×480** (hand ≈ 50–70 px) — that is *why* it felt like garbage.

**Consequences, in order:**
1. Re-extracting the same WLASL videos with any better model ≈ marginal gains. **Better input beats better models.**
2. The vocab recorder — fixed today to capture 1080p — becomes our **highest-quality source**, better than the dataset that built the dictionary.
3. **The deaf-community rendezvous is not a demo — it is our first studio session.** Record them properly and every sign they give us enters the dictionary at a fidelity WLASL can never reach.

---

## 2 · HOW THE WORLD'S BEST ACTUALLY DO IT (verified sources)

**The gold standard is a controlled room, not a better algorithm.**

- **[How2Sign](https://how2sign.github.io/)** (CVPR 2021, the reference ASL corpus): green-screen studio,
  frontal HD + lateral HD + depth camera, **1280×720 @ 30 fps** — modest resolution, but the signer fills
  the frame under controlled light ([paper](https://openaccess.thecvf.com/content/CVPR2021/papers/Duarte_How2Sign_A_Large-Scale_Multimodal_Dataset_for_Continuous_American_Sign_Language_CVPR_2021_paper.pdf)).
  Their premium subset used CMU's Panoptic dome (480+ cameras) — that's the ceiling, not the requirement.
- **[SignAvatars](https://github.com/ZhengdiYu/SignAvatars)** (ECCV 2024, the dataset our avatar tech descends from):
  fits SMPL-X to How2Sign's green-screen multi-view clips — i.e. *the best 3D sign corpus in the world is built
  from exactly the pipeline family we run*, fed with studio-grade video.
- **Sign4all** (Nature Scientific Data 2026): purpose-built sign dataset — **one** Azure Kinect at 2560×1440 @ 30 fps,
  lens at 117 cm, signer 1–1.7 m away, controlled lighting. One good camera, close, well-lit. Notably: **it also
  ships no facial data** — our face gap is the industry's gap, and closing it puts us *ahead*.
- **[Mocaplab](https://vimeopro.com/mocaplab/mocaplab-and-sign-language-avatars/video/219374139)** (Paris): the luxury tier —
  marker-based mocap suits + finger markers for sign avatars. Beautiful, ~€1000s/day, not needed to beat WLASL.
- **[Signapse](https://zeroproject.org/view/project/100ff85a-f64c-f011-8779-7c1e527683f1)** (commercial leader): moved *away*
  from traditional mocap to AI-from-video precisely because studio mocap doesn't scale — validating our architecture.

**Conclusion:** the minimum rig that reaches deaf-community-approved fidelity is
**one good camera + signer filling the frame + flat bright light + our existing WiLoR/Multi-HMR lift.**
We already own every piece except the capture discipline.

---

## 3 · THE MODEL UPGRADES THAT ARE ACTUALLY WORTH IT (ranked)

1. **Face — [SMIRK](https://github.com/georgeretsi/smirk)** (CVPR 2024): FLAME expression + jaw from video frames;
   [preferred over EMOCA in evaluations, 14× smaller](https://arxiv.org/html/2404.04104v1) → fits our 8 GB GPU.
   SMPL-X's head *is* FLAME, so SMIRK output maps directly into our (T,182) params — jaw 156:159 + expression 169:179.
   **Use it twice**: (a) retro-extract faces for legacy signs from the original videos (needs F: drive), (b) in the
   lift pipeline for every new recording. This single item closes the "signs have no face" gap completely.
2. **Sign-specific refinement — [DexAvatar](https://arxiv.org/abs/2512.21054)** (WACV 2026): reconstruction with learned
   hand+body priors, **+35% body/hand accuracy over SOTA on the SGNify benchmark**, code released. Evaluate as the
   next-generation lifter core; its priors specifically fight the self-occlusion and motion blur that hurt our left hands.
3. **Whole-body — [SMPLest-X](https://github.com/wqyin/SMPLest-X)** (TPAMI 2025, successor of
   [SMPLer-X](https://github.com/SMPLCap/SMPLer-X)): foundation model with expressly improved articulated hands,
   SOTA on 7 benchmarks. Candidate replacement for Multi-HMR; benchmark head-to-head on 20 of our own clips before adopting.
4. Also cross-checked and *not* urgent: our WiLoR remains top-tier for hands; MediaPipe stays the right choice for the
   live browser mirror (it is a feedback tool, not the stored product).

---

## 4 · THE PLAN

### Phase 1 — before the rendezvous (this week; mostly DONE today)
- ✅ **Recorder captures 1080p** (was 640×480 — the single biggest fix in this whole report), tracking on a
  downscaled copy so the live mirror stays fast; VP9 at 8 Mbps; lifter keeps native fps/resolution (it silently
  forced 25 fps before); frame cap raised 80→160.
- ✅ Faces already captured live (blendshapes+head) and merged into studio-lift commits.
- **Capture protocol for the session** (print this):
  - Camera at chest height, signer **1–1.5 m** away, upper body + hands filling ≥70% of frame height
  - Flat, bright, front light (two lamps at 45°, no window behind the signer); plain contrasting backdrop
  - Signer in plain sleeves (no patterns/jewelry); hands start and end at rest
  - Record each sign 2–3×; the Clip Studio editor trims; commit via **studio-quality (WiLoR) path**
  - 1080p webcam minimum; if a phone is available, a modern phone camera at 1080p60 beats most webcams

### Phase 2 — the rendezvous itself (turn the meeting into the first studio session)
- Frame it to the community exactly as the truth: *"you are the authors of this dictionary."*
- Target the **200 most-used signs** re-recorded by native signers at the new quality → these become the
  reference tier of the dictionary, replacing their WLASL versions.
- Capture consent + credit (name the contributors in the app — dignity is the product).

### Phase 3 — production hardening (next 4–8 weeks)
- SMIRK retro-face pass over legacy signs (plug F: back in; face crops from original videos → jaw+expression channels).
- DexAvatar/SMPLest-X bake-off on 20 signs; adopt the winner into the lifter.
- Progressive dictionary refresh: every community re-recording supersedes its WLASL ancestor; quality metadata
  (already stored per sign) drives a visible "reference-grade" badge.
- ⚠️ **LICENSING (production-blocking):** SMPL-X/MANO/FLAME are research-licensed. Commercial use requires a
  [Meshcapade](https://meshcapade.com/smpl/) license (email smpl@max-planck-innovation.de; pricing is negotiated) —
  and **Epic Games acquired Meshcapade in Feb 2026**, so terms may be moving. Start this conversation *now*,
  before grants/production contracts; an academic/social-impact deal is plausible but must be in writing.

### Budget tiers
| Tier | Cost | What you get |
|---|---|---|
| **Now** (this laptop) | $0 | 1080p recorder (done) + capture protocol + SMIRK faces → already beats the current dictionary |
| **Booth** | ~$300–800 | 1080p60/4K webcam or phone rig + 2 softbox lights + backdrop + tripod → How2Sign-grade input |
| **Studio** | $3–5k | Workstation GPU (24 GB: run DexAvatar/SMPLest-X/large models comfortably) + 2-camera rig (frontal+lateral like How2Sign) + audio for mouthing alignment |

---

## 5 · WHAT CHANGED IN THE CODE TODAY
- `SignEvaluator`: camera 640×480 → **1920×1080 ideal**, tracking on 640-wide offscreen canvas (mirror stays realtime)
- Recorder: VP9, 8 Mbps
- `lift_one_video.py`: native fps kept (removed forced 25 fps), native resolution kept, cap 80→160

**Bottom line:** we don't need to buy precision — we need to *record* it. The models are ready. The room is the upgrade.
The people you meet this week are the studio.
