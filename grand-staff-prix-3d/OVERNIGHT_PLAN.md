# Overnight Autonomous Build — Plan & Progress

Self-driving queue. Each loop iteration: pick the next unchecked task → do it →
**verify (`npm run build` must pass + headless `node smoke.mjs` for the 3D game)**
→ `git add -A && git commit` a checkpoint on branch `overnight-build-3d`
→ **`git push origin overnight-build-3d`** (durable, recoverable history)
→ tick the box here → continue. Read this file at the start of every iteration.

### Versioning (push throughout the night so we can roll back to any point)
- **Push every checkpoint commit** to `origin/overnight-build-3d` so each step is recoverable on GitHub.
- **Tag each milestone** (a completed feature or game) as an annotated version and push the tag:
  `git tag -a vX.Y-<short-name> -m "..." && git push origin vX.Y-<short-name>`.
  Baseline is `v0.1-overnight-baseline`. Increment the minor (`v0.2`, `v0.3`, …) per milestone
  so the morning has a clean list of restorable versions.
- Keep a running version list in the Log section at the bottom.

## ANTI-SLOP QA GATE — applies to the WHOLE experience, not just maps (the user will be furious if they wake to slop)
The bar covers EVERYTHING: cars, avatars, the menu/garage, the avatar builder, the HUD/note card,
every map, how it PLAYS and FEELS, the level/mastery progression, the audio, and every game.
Before ticking any box or committing:
1. **Gameplay works**: `npm run build` green AND `node smoke.mjs` reaches `playing`, the
   loop advances (`hudChanged`), and `pageErrors`/`consoleErrors` are empty. Non-working
   gameplay → revert, do not ship.
2. **Nothing looks/feels trashy — anywhere**: capture screenshots of EVERY surface the change
   touches (menu, garage/car, avatar, HUD, the map, game-over) and **critically self-review each
   PNG (main thread Reads the images) — judge as harshly as the user would**: cheap / flat /
   uncanny / blocky / barren / off-brand / doesn't-match-its-name / clunky = FAIL. Also sanity-check
   feel (controls, pacing, level difficulty/mastery). Spawn a QA review agent for a second opinion.
3. **Ship only on PASS of BOTH.** If graphics still look cheap, do NOT commit — iterate with
   real downloaded assets, or `git checkout -- <files>` back to the last good checkpoint.
   Never leave shipped slop. Log honestly here what passed/failed each iteration.
4. The morning state must be: builds, plays, and looks intentional — or reverted to the last
   thing that did. No exceptions.

## Hard rules (NON-NEGOTIABLE)
- **Never leave the build red.** If a change breaks it, fix or revert before moving on.
- **Never run destructive commands** — no `rm`/`rmdir`/`mv` of existing files, no
  `git reset --hard`, no `git clean`, nothing that deletes or could harm the machine.
  Only additive edits + new files. Commits only (they preserve, never destroy).
- **Real assets for all art — never ship procedural-primitive slop.** The MAIN thread
  can download (curl works here); subagents CANNOT (network-caged) — so all asset
  fetching + art integration is done by the main thread, not delegated.
- **Verify before checkpoint.** Build + smoke-test every change.
- Subagents only for pure code/logic on DISJOINT files; run them in waves; QA-review after.

## Credential-gated (needs the user in the morning — prep but don't block on these)
- [ ] **Photoreal San Francisco** via Google Photorealistic 3D Tiles (`3d-tiles-renderer`)
  needs a **Google Maps Platform API key** (user's Google account). Build the integration
  behind an env var `VITE_GOOGLE_TILES_KEY`; until set, fall back to the best keyless
  option (SF/Golden-Gate panorama or HDRI + stylized bridge). Document in README.
- [ ] **Ready Player Me** avatar creator — confirm keyless/free subdomain works for a kids
  game; if an appId/subdomain is needed, stub it behind `VITE_RPM_SUBDOMAIN` + fallback to
  a clean **helmeted racer (visor down, NO face)** so there is never an uncanny face.

## PHASE 1 — Realism (main thread; uses downloaded assets in public/hdri, public/tex, public/models)
- [x] Fix the roadside-prop popping bug — REMOVED the cheap procedural props + silhouette mountains entirely (no popping); HDRI horizon replaces distance. [v0.2]
- [x] Wire HDRI skies as photographic backgrounds per theme via drei Environment. [v0.2]
- [x] Texture the ground per theme with real PBR textures (public/tex) in Track. [v0.2]
- [ ] **NAME-MATCH each map (HARD REQUIREMENT — the scene must look like its name):**
  - **Mountain Pass** → full-environment mountain HDRI (real peaks+snow) + real CC0 pine trees + bright sun.
  - **Desert Run** → desert HDRI (dunes/mesas) + real CC0 cacti + rocks.
  - **San Francisco** → Golden Gate Bridge + SF skyline + fog. PRIMARY: Google Photorealistic 3D Tiles via
    `3d-tiles-renderer/r3f` behind `VITE_GOOGLE_TILES_KEY` (user-provided). FALLBACK: hunt a CC0 Golden Gate
    Bridge GLB + SF panorama; if neither, leave wired for the key + flag for morning. Do NOT ship a generic city as "SF".
  - **Candy Canyon** → deliberately stylized candy hills + lollipops (no real-world place; make it charming, not cheap).
  - **Deep Space** → starfield + real planet/asteroid models.
  - GATE: each map's gameplay screenshot must read as its name, or revert.
- [ ] Add real CC0 vegetation/rock/landmark GLBs as instanced scenery, smoothly recycled (per-theme list above).
- [ ] Cars: use **OPEN-COCKPIT** car bodies so the driver/avatar is clearly visible (download CC0 open-top/F1-style GLB, or build a clean open-cockpit body). Tint paint per car; integrate into CarModel; re-tune the seated avatar.
- [ ] Avatars (helmeted racer — NO uncanny face): a helmet with the visor showing only the skin around the eyes, hair peeking out under the helmet, racing suit. Customizable: **helmet color, suit/clothes color, hair style+color (under helmet), skin tone (visor opening), optional beard/mustache**. Replace the current full-face character. Full body shown in the builder preview; visible in the open cockpit.
- [ ] San Francisco: see NAME-MATCH item above (Google 3D Tiles behind VITE_GOOGLE_TILES_KEY; else hunt Golden Gate GLB; never ship a generic city as SF).

## PHASE 2 — Features (subagent waves on disjoint files + main-thread backbone)
- [ ] Curved-course backbone (main thread): spline-based track, straight for beginner levels → gentle curves later; car/camera/gates follow the spline. Verify drivable via smoke test.
- [ ] Level creator: students build custom note sets (pick clef/notes/range) saved per profile, playable as a level. (store + notes + new UI)
- [ ] Track types: multiple track styles selectable.
- [ ] Gamification for 3D: XP/levels/ranks, achievements, gems, daily challenges (per README).
- [ ] **Mastery-based level design (THINK THIS THROUGH — current "reach Stage 3" unlock is far too easy/short):**
  - Stages must be longer and progressively harder (more notes, faster, fewer lives margin).
  - Unlocking the NEXT level requires demonstrated **mastery**, not just survival — e.g. sustain a high
    accuracy (~90%+) over a meaningful sample of notes AND clear the level's final stage, ideally across
    more than one run. Track per-note-set accuracy/attempts so mastery is measured, not luck.
  - Show a mastery meter / "X% to mastery" so students see the bar. Award a mastery badge + bonus XP on clearing.
  - XP curve: meaningful, rewards accuracy + streaks + speed; ranks feel earned. Re-read README XP table and
    design real numbers (don't hand-wave).
- [ ] 2D game (`../grand-staff-prix.html`): main-thread redesign + gamification (subagents are permission-blocked on it; do it from main thread).

## PHASE 3 — QA
- [ ] After each feature: spawn review agent(s) for correctness/quality; fix findings; build + smoke.

## PHASE 4 — Other README games (scaffold in the SAME Vite+R3F stack; share engine/components)
**For EACH game below, in this order — do NOT skip research:**
1. **Deep research** (deep-research workflow): existing games in that genre/skill — what
   works, what fails, mechanics, monetization-free fun loops, and how to make a *world-class*
   game that teaches this specific music-theory skill. Save findings to `RESEARCH-<game>.md`.
2. **Design** from the research (core loop, progression, why it's fun + educational).
3. **Build** in the shared stack with real assets.
4. **QA** review + build/smoke verify + checkpoint.

- [ ] Rhythm Racer (rhythm reading)
- [ ] Interval Invaders (interval recognition)
- [ ] Chord Crusher (chord recognition)
- [ ] Melody Quest (sight-singing/dictation)
- [ ] Rhythm Recall (rhythmic dictation)
- [ ] Scale Sprint (scales/key signatures)

## Log / version list
- `v0.1-overnight-baseline` (42660b8) — checkpoint before overnight run.
- `v0.2-real-skies` — real photographic HDRI skies + PBR ground textures; removed cheap procedural mountains/props. Build green, smoke pass, screenshot reviewed (photographic sky + asphalt road — real, not slop).
- `v0.3-real-mountains` — full-environment HDRIs: Mountain Pass = real alpine mountains (verified), Desert Run = real semi-desert (goegap).
- `v0.4-deep-space` — Deep Space = real Milky-Way galaxy + Jupiter/Mars planets (verified). Added THEME_INDEX to smoke.mjs to screenshot each map.

### NAME-MATCH AUDIT (verified via screenshots)
- Mountain Pass ✅ real mountains (TODO: add pine trees + snow for full polish)
- Desert Run ✅ real arid landscape (TODO: add cacti/dunes polish)
- Deep Space ✅ galaxy + planets
- San Francisco ✗ GATED — needs Golden Gate (VITE_GOOGLE_TILES_KEY 3D-tiles, or a GG GLB model). Do not ship generic city.
- Candy Canyon ✗ pastel sky only — needs deliberate STYLIZED candy art (hills/lollipops); no real-world asset exists.
NEXT iterations: candy stylized art; mountain pines+snow; desert cacti; then cars (open cockpit), helmeted avatars, mastery levels.
