# Grand Staff Prix — Progression & Scoring Redesign

## 1. What's broken today (from the code)

- **Score is inflated & meaningless.** Per correct note: `100 × (1 + streak·0.12) × stage × (0.6 + 0.4·accuracy)` → 200–500+ *per note*, thousands per race. Big numbers for low effort → they stop meaning anything.
- **Three overlapping currencies.** Race **Score**, permanent **XP**, and **Gems** all move at once, none with a clear job. XP only really comes from mastery (+250); gems = `score/400 + bonuses` but have nothing to spend on → "what does XP mean / badges don't matter."
- **No visible goal per level.** Unlock = reach Stage 4, 30 notes, ≥90% — a reasonable bar, but it's invisible, so it feels arbitrary/easy.
- **No risk/reward.** Speed (the core racing verb) doesn't affect score at all. Going fast should be the skillful, riskier, higher-scoring choice.
- **No retention loop.** No daily streak (the single biggest proven lever), no "one more race" hook.
- **No path for advanced students** to skip ahead.

## 2. What the research says

- **Duolingo:** XP gives a sense of forward motion; **streaks** drive retention hardest (loss aversion, +60% commitment, 7-day streakers 3.6× more likely to stay); variable rewards; *layered* mechanics for different player stages; forgiveness (streak freeze cut churn 21%); autonomy (set your own goal). [1]
- **Mastery learning:** advance only after demonstrating **80–90% accuracy**; higher thresholds → better outcomes; demonstrate skill, don't just survive. [2]
- **Arcade scoring:** reward *skillful/risky* play; combos/multipliers for sustained good play; **speed as a reward**; if rewards are too easy the achievement evaporates; juicy immediate feedback. [3]
- **Core loop / retention:** first reward in **30–60s**; a session should feel complete in **2–10 min**; reward the player for taking "one more" (restart with a reward block). [4]
- **Music apps:** Note Rush = adjustable difficulty (few notes → wide range), **timed race-the-clock OR untimed** for beginners. Yousician = leveled path with a **"skills test" to place out** and jump ahead. [5]

## 3. Proposed system

### 3a. Give each currency one clear job
- **Race Score** — *this race only*, the arcade number. Earned by **speed + accuracy + combo**. Drives "beat your best" + the leaderboard. Resets each race.
- **XP (permanent) = your learning.** Earn it for *reading* (1 XP per correct note) and *mastering levels* (+50–150). Never from speed/combo. This is the honest "how far I've come" number → Rank (Beginner→Maestro). Re-tune ranks to ~1 XP/note.
- **Gems = cosmetics.** Spend on cars / composers / trails (a real sink). If we don't want a shop, drop gems entirely and keep XP + Score only.

### 3b. Rescore each note (smaller, earned, risk/reward)
`points = 10 (base) × speedMult(1.0–3.0) × comboMult(1–5)`
- **speedMult** scales with how fast you're going when you take the gate — *accelerating into the correct answer pays more* (your idea), but fast = less reaction time = riskier. This makes the racing verb the scoring verb.
- **comboMult** rises with streak, resets on a miss (classic arcade tension).
- Numbers land in the hundreds–low-thousands per race, all *earned*.

### 3c. Visible, real per-level goals + stars
- Each level shows a **checklist/progress bar** to unlock the next: e.g. "Read 25 notes · 90%+ accuracy · reach Stage 4."
- **3 stars per level** (the meaningful badge): ★ complete · ★★ 90%+ · ★★★ 95%+ and no misses. Need ≥1★ (mastery) to unlock the next; stars drive completion %.

### 3d. Let advanced students start higher (Yousician skills test)
- A **"Test out"** button on any locked level: pass a short high-bar check (e.g. 20 notes @ 95%) → instantly unlock it and mark earlier levels mastered. No grinding through beginner content.

### 3e. Retention hooks
- **Daily streak** (+ streak freeze) — the biggest lever. "Play 1 race today."
- **"One more race" bonus** — finish a race, and the next race within ~30s earns **+25% XP** (escalating "hot streak"). Rewards the one-more.
- **Badges → milestones + small rewards:** "Treble Master" (3★ all treble levels), "Sharp Eye" (100% race), 7-day streak, etc. Surfaced on the profile, each grants XP/gems.

### 3f. New modes (your ideas)
- **Time Attack (Sprint):** 60s, name as many as you can, accelerate at your own risk. Score = correct count × speed. Own leaderboard, infinitely replayable ("beat your count").
- **Practice / Zen:** untimed, no lives — just read. For beginners / warm-up (Note Rush's hide-the-timer mode).
- These sit alongside the **Journey** (the mastery-gated curriculum) and the existing Name-the-note / Find-the-note variants.

## 4. Phased build
1. **Rescore** — small base + speed/risk + combo; XP = learning only; re-tune ranks.
2. **Visible goals + 3-star mastery** + unlock progress bar.
3. **Test-out** placement for advanced students.
4. **Daily streak** + "one more race" bonus + badge rewards surfaced.
5. **Time Attack** + **Practice** modes.

## 5. Open decisions
- Keep **Gems** as a cosmetic currency (gate cars/composers) or drop the third currency?
- **Speed bonus** tied to actual throttle/velocity — confirm the mechanic feel.
- Advanced start: **per-level "test out"** vs a one-time **onboarding placement**?
- Build **Time Attack + Practice** as full separate modes now, or after the core rescore?

## Sources
1. https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo · https://trophy.so/blog/duolingo-gamification-case-study
2. https://en.wikipedia.org/wiki/Mastery_learning · https://www.gettingsmart.com/2019/09/04/mastery-learning-objectives-and-mastery-thresholds-in-the-classroom/
3. https://itch.io/blog/810141/what-makes-a-great-scoring-system-lessons-from-the-arcade.amp · https://tvtropes.org/pmwiki/pmwiki.php/Main/ScoreMultiplier
4. https://www.gameanalytics.com/blog/how-to-perfect-your-games-core-loop · https://gdevelop.io/blog/casual-game-loops
5. https://www.noterushapp.com/ · https://www.pianodreamers.com/yousician-piano-review/
