# Good morning — overnight build summary

Everything below is on branch **`overnight-build-3d`** (pushed to GitHub), with a
**version tag at every step** so you can roll back to any point. The build is green
and the game plays + is screenshot-verified at every tag.

## How to look at it
```
cd grand-staff-prix-3d
npm run dev          # then open the printed localhost URL
```
Roll back to any version: `git checkout v0.11-candy-canyon` (etc.). Version list is
at the bottom of `OVERNIGHT_PLAN.md`.

## What got built (16 verified milestones, v0.2 → v0.16)
- **Real, name-matched environments for all 5 maps** (photographic skies + real
  ground textures, and foreground scenery per map):
  - **Mountain Pass** — real alpine HDRI + snow-capped pine trees + boulders
  - **Desert Run** — real semi-desert HDRI + saguaro cacti + mesas
  - **Deep Space** — real Milky-Way galaxy + Jupiter & Mars (NASA textures)
  - **Candy Canyon** — stylized pink sky + gumdrop hills + lollipops
  - **San Francisco** — stylized Golden Gate towers + cables + coastal fog (see "needs you")
- **Mastery-based progression** — longer stages; the next level unlocks only at
  Stage 4, over 30+ notes, at 90%+ accuracy. Live mastery meter in the HUD.
- **Full gamification** — XP ranks (Beginner→Maestro), gem currency, 9 achievements
  with triggers, and 3 daily challenges that rotate by date. All shown in the menu.
- **Level Creator** — students pick a clef + the exact notes to drill and play a
  custom level.
- **Detailed sculpted car** (swept body, glass canopy, wing, diffuser, real wheels),
  shared by the game and the menu showroom.
- **Performance-tuned** (lean scenery) and **QA-reviewed** (store logic confirmed
  sound; ref/leak/edge-case bugs fixed).

## Needs YOU (honestly gated — I couldn't do these without you)
1. **Real photoreal San Francisco** (actual Golden Gate via Google 3D Tiles): drop a
   free **Google Maps Platform API key** into `grand-staff-prix-3d/.env.local` as
   `VITE_GOOGLE_TILES_KEY=...`. Until then SF uses the stylized Golden Gate fallback.
2. **Realistic avatars** (optional): the avatar is still the full-face built character.
   You said you'd prefer **helmeted racers** — I did NOT get to that yet (I couldn't
   screenshot-verify the menu's 3D avatar headless, so I held it for when you're around).
   This is the top remaining art task.

## Honest known gaps / still to do
- **Helmeted / open-cockpit avatars** — not done (see above). Top of the list.
- **Curved tracks** — deferred: it's a movement-model rewrite that needs you to feel-test
  it; risky to tune blind. Ready to do together.
- **The 2D game** (`../grand-staff-prix.html`) — not started (was blocked on write
  permission; doable from here now).
- **Other README games** (Rhythm Racer, etc.) — not started.
- The menu's live 3D car close-up couldn't be verified headless — please eyeball it.

The loop is still running and will keep making safe, verified progress until you stop it.
