# PracticePal: The Music Education Platform

> **Games students want to play. Progress teachers need to see. Practice that actually happens.**

## Vision

PracticePal is a comprehensive music education platform that combines addictive, arcade-quality games with intelligent practice guidance. Unlike existing music theory apps that feel like "worksheets with skins," PracticePal games are designed from the ground up as *real games* that happen to teach music—not educational tools pretending to be games.

The platform consists of three interconnected components:

1. **The Arcade** — A suite of genuinely fun games covering note reading, rhythm, intervals, chords, sight-singing, and dictation
2. **Teacher Studio** — Where teachers assign weekly practice, track progress, and see real data on student engagement
3. **Practice Mode** — An AI-guided practice companion that walks students through their assignments, verifies they're actually practicing, and gamifies the entire experience

---

## Table of Contents

- [The Problem We're Solving](#the-problem-were-solving)
- [The Arcade: Game Suite](#the-arcade-game-suite)
- [Teacher Studio](#teacher-studio)
- [Practice Mode](#practice-mode)
- [Gamification System](#gamification-system)
- [Student Profiles & Competition](#student-profiles--competition)
- [Technical Architecture](#technical-architecture)
- [Privacy & Compliance](#privacy--compliance)
- [Competitive Analysis](#competitive-analysis)
- [Development Roadmap](#development-roadmap)
- [Design Principles](#design-principles)

---

## The Problem We're Solving

### Current Music Theory Apps Are Failing

| App | Visual Style | Game Feel | Fatal Flaw |
|-----|-------------|-----------|------------|
| **Tenuto** | Bare bones, functional | Quiz drills | Intentionally *not* fun—"no cutesy owl" |
| **Staff Wars** | 2010s space theme | Notes fly, tap letter | Homework with a skin |
| **Note Rush** | Themed (jungle, soccer) | Play into mic | Themes decorative, not integrated |
| **Music Tutor** | Plain UI | Timed recognition | Pure drill, zero game loop |
| **EarMaster** | Academic interface | Comprehensive but sterile | Designed for classrooms, not kids' free time |

**The core problem:** These apps treat games as wrapping paper for worksheets. The "game" is superficial—a background image, a timer, maybe stars. None feel like something kids would choose over Subway Surfers.

### What Kids Actually Play

Research shows the most engaging games share these traits:

- **Instant playability** — Tap and you're in, no tutorials
- **Simple controls, escalating challenge** — Swipe mechanics anyone learns, mastery takes time
- **Visible progression** — XP, streaks, leaderboards create sticky daily habits
- **Meaningful choice** — Not just correct/wrong but character selection, paths, loadouts
- **Social comparison** — Leagues and leaderboards drive 40% more activity

**Prodigy Math** has 100 million users because it looks and feels like Pokémon—you battle creatures, collect pets, explore worlds. The math is embedded in combat, not a separate "learning mode."

### The Gap

**Nobody has made a music theory game that feels like the games kids already love.**

We're building the Subway Surfers of note reading, the Duolingo of ear training, the Prodigy of music theory—games that happen to teach music, not lessons pretending to be games.

---

## The Arcade: Game Suite

### Core Philosophy

Every game must pass the "Would they play this if it didn't teach anything?" test. The learning is embedded in the core mechanic, not layered on top.

---

### 1. Grand Staff Prix (Note Reading — Racing)

**Genre:** Endless runner / racing
**Mechanic:** Steer through gates labeled with note names; the correct gate matches the note shown on staff
**Feel:** Subway Surfers meets music notation

#### Gameplay
- Pseudo-3D perspective road with parallax backgrounds
- 5 themed environments (Mountain, San Francisco, Desert, Candy Canyon, Deep Space)
- 5 selectable cars with names and personalities (Vortex GT, Brawler, Apex F1, Trailblaze, Rumble Rod)
- Tilt or touch steering
- Speed increases with stage progression
- 3-5 gates per wave (difficulty scales)

#### Progression
- 5 note sets from beginner to grand staff
- Unlock new levels by reaching Stage 3 on current level
- Unlock cars through achievements
- Daily/weekly challenges

#### Audio
- Procedural background music that speeds up with stage
- Correct note plays pitched tone
- Wrong answer: satisfying "buzz" without being punishing

---

### 2. Staff Blaster (Note Reading — Shooter)

**Genre:** Space shooter
**Versions:** 2D (integrated in Grand Staff Prix) and 3D (Three.js standalone)
**Mechanic:** Aim and fire at the orb whose letter matches the note on staff
**Feel:** Asteroids meets flash cards

#### Gameplay (3D Version)
- Immersive Three.js space environment with nebula, fog, particle effects
- Ship banking and thruster animations
- Reticle-based aiming (more skill than column alignment)
- Glowing orbs approach; shoot the correct one
- Explosions with particle systems

#### Progression
- Tiers with increasing speed
- Level Designer: teachers/students can create custom note pools
- Sharp/flat toggle for advanced levels
- Streaks multiply score

---

### 3. Rhythm Racer (Rhythm Reading)

**Genre:** Rhythm runner
**Mechanic:** Tap/hold in time with rhythmic notation scrolling toward you
**Feel:** Guitar Hero meets Subway Surfers

#### Gameplay
- Notes scroll toward a hit zone
- Quarter notes = tap, half notes = hold, rests = don't tap
- Visual feedback: perfect/good/miss ratings
- Combo system rewards consistent accuracy
- Background music syncs with rhythm patterns

#### Progression
- Start with quarter notes and rests
- Add eighth notes, dotted rhythms, syncopation
- Time signatures: 4/4 → 3/4 → 6/8 → compound meters
- "Freestyle mode" generates rhythms from actual songs

#### Technical
- Uses clap/tap detection via microphone (Web Audio API)
- Option to tap screen or use external surface

---

### 4. Interval Invaders (Interval Recognition)

**Genre:** Space defense
**Mechanic:** Aliens descend with interval labels; shoot the one that matches the played interval
**Feel:** Space Invaders meets ear training

#### Gameplay
- Two notes play (melodic or harmonic)
- 3-5 alien ships descend, each labeled (m2, M2, m3, M3, P4, etc.)
- Shoot the correct interval before they reach your base
- Wrong shots cost shields; missed correct answers damage base

#### Progression
- Level 1: M2, m2, M3, m3 only
- Gradually add P4, P5, tritone, 6ths, 7ths, octave
- Harmonic intervals (simultaneous) in advanced levels
- "Descending intervals" mode

#### Audio
- Clean piano tones for interval playback
- Option to replay before answering
- Speed increases—less time to identify

---

### 5. Chord Crusher (Chord Recognition)

**Genre:** Match-3 / Puzzle
**Mechanic:** Hear a chord, identify its quality; chains create combos
**Feel:** Candy Crush meets chord identification

#### Gameplay
- Grid of chord-quality blocks (Major, minor, dim, aug, 7th types)
- A chord plays; tap the matching block
- Matched blocks clear; chains create cascade combos
- Time pressure increases with levels

#### Progression
- Start: Major vs. minor only
- Add: diminished, augmented
- Add: dominant 7th, major 7th, minor 7th
- Advanced: inversions, extended chords

---

### 6. Melody Quest (Sight-Singing / Dictation)

**Genre:** Adventure / RPG-lite
**Mechanic:** Sing or play back melodies to progress through a story
**Feel:** Duolingo meets adventure game

#### Gameplay Modes

**Sight-Singing Mode:**
- Staff notation appears
- Sing the melody into microphone
- Real-time pitch tracking shows accuracy
- "Karaoke-style" scrolling through the phrase
- Solfege syllables optional (Do-Re-Mi overlay)

**Melodic Dictation Mode:**
- Melody plays
- Tap notes on interactive staff to transcribe
- Check answer; see where you went wrong
- Replay sections as needed

**Call & Response Mode:**
- Short phrase plays
- Sing it back
- Earn stars based on pitch accuracy

#### Progression
- Start with 3-note stepwise patterns (Do-Re-Mi)
- Add skips (Do-Mi-Sol)
- Expand range and complexity
- Minor keys, chromatic passages
- Real musical excerpts from repertoire

#### Technical
- Uses [pitchy](https://www.npmjs.com/package/pitchy) or WebAssembly pitch detection
- Tolerance settings for younger/beginning students
- Visual feedback: note-by-note accuracy display

---

### 7. Rhythm Recall (Rhythmic Dictation)

**Genre:** Memory / transcription
**Mechanic:** Hear a rhythm, notate it on a blank staff
**Feel:** Simon Says meets music notation

#### Gameplay
- 1-4 bar rhythm plays
- Drag note values onto beats to recreate it
- Submit and see accuracy
- "Echo mode": tap/clap it back instead of notating

#### Progression
- Quarter and half notes in 4/4
- Add eighth notes, rests
- Dotted rhythms, ties
- Syncopation, triplets
- Compound meters

---

### 8. Scale Sprint (Scale & Key Signature)

**Genre:** Racing / speedrun
**Mechanic:** Build scales note-by-note against the clock
**Feel:** Typing test meets music theory

#### Gameplay
- "C Major—GO!"
- Tap notes on keyboard/fretboard graphic in order
- Time bonus for speed, penalty for wrong notes
- Key signature mode: identify the key from sharps/flats shown

#### Progression
- Major scales (C, G, D, F)
- All major scales
- Natural minor
- Harmonic and melodic minor
- Modes (Dorian, Mixolydian, etc.)

---

## Teacher Studio

### Overview

A web-based dashboard where music teachers manage their studio, assign practice, and track student engagement.

### Features

#### Student Management
- Add students individually or import roster (CSV)
- Organize by group/class (e.g., "Tuesday 4pm Piano", "Youth Orchestra")
- View each student's profile, progress, and practice history
- Parent contact info for practice reminders

#### Assignment System
- **Weekly Practice Plans**: Create a week's practice with specific pieces, scales, and theory games
- **Game Assignments**: "Complete 3 rounds of Grand Staff Prix on Level 3"
- **Piece Assignments**: Assign specific repertoire with measure ranges
  - "Moonlight Sonata, mm. 1-8, hands separate, then together"
  - Attach reference recordings, annotated PDFs
- **Custom Goals**: "Practice C major scale at 80bpm, then 100bpm"

#### Progress Dashboard
- **Practice Time**: Minutes per day, weekly totals, streak count
- **Game Scores**: Best scores, accuracy percentages by game type
- **Piece Progress**: Did they practice the assigned sections? How long?
- **Audio Samples**: Listen to submitted recordings
- **Heatmap View**: Visual calendar of practice consistency

#### Communication
- In-app messaging with students/parents
- Automated practice reminders (push notifications, email, SMS)
- Lesson notes that sync to student's Practice Mode

#### Studio Management
- Scheduling integration (optional)
- Invoice/payment tracking (optional)
- Recital/event management

---

## Practice Mode

### The Vision

Press START, and the app guides you through your practice session like a personal coach. No decisions about "what should I work on?"—your teacher already assigned it. Just follow the prompts, earn points, and build streaks.

### Session Flow

```
┌─────────────────────────────────────────────────────────────┐
│  WELCOME BACK, EMMA!                                        │
│  You have 3 assignments due this week.                      │
│  Let's get started! 🎹                                      │
│                                                             │
│  [START PRACTICE]                                           │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  WARM-UP: C Major Scale                                     │
│  ──────────────────────                                     │
│  Goal: Play at 80 BPM, hands together, 2x                   │
│                                                             │
│  🎵 [Hear Example]   📖 [See Fingering]                     │
│                                                             │
│  Ready? The app is listening...                             │
│                                                             │
│  [BEGIN]                                                    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  🎹 LISTENING...                                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                               │
│  Rep 1 of 2                                                 │
│                                                             │
│  ✓ Good tempo!                                              │
│  ✓ Clean notes                                              │
│                                                             │
│  +15 XP                                                     │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  NEXT: Moonlight Sonata, mm. 1-8                            │
│  ──────────────────────────────                             │
│                                                             │
│  Your teacher says:                                         │
│  "Focus on LH voicing. Bring out the bass line."            │
│                                                             │
│  Suggested breakdown:                                       │
│  1. LH alone, mm. 1-4 (2 min)                              │
│  2. LH alone, mm. 5-8 (2 min)                              │
│  3. RH alone, mm. 1-8 (3 min)                              │
│  4. Hands together, slowly (5 min)                         │
│                                                             │
│  [START SECTION 1]                                          │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  🎹 PRACTICING: LH mm. 1-4                                  │
│                                                             │
│  ⏱️ 1:24 / 2:00                                             │
│  ━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░                             │
│                                                             │
│  [LISTENING INTERMITTENTLY]                                 │
│  The app checks in every ~30 sec to verify practice         │
│                                                             │
│  ✓ Audio detected - you're practicing!                      │
│  +5 XP per minute                                           │
│                                                             │
│  [DONE EARLY]  [ADD TIME]                                   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  BRAIN BREAK: Quick Game!                                   │
│  ──────────────────────────                                 │
│                                                             │
│  Teacher assigned: "3 rounds of Interval Invaders"          │
│                                                             │
│  Take a break from the piano and train your ear.            │
│                                                             │
│  [PLAY NOW]  [SKIP]                                         │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  SESSION COMPLETE! 🎉                                       │
│  ──────────────────────                                     │
│                                                             │
│  Time: 23 minutes                                           │
│  XP Earned: +185                                            │
│  🔥 Streak: 5 days!                                         │
│                                                             │
│  ┌─────────────────────────────────────────┐                │
│  │ LEVEL UP! You reached Level 7          │                │
│  │ New badge: "Consistent Practicer"      │                │
│  └─────────────────────────────────────────┘                │
│                                                             │
│  [SHARE WITH TEACHER]  [DONE]                               │
└─────────────────────────────────────────────────────────────┘
```

### Audio Verification

Practice Mode uses the device microphone to verify actual practice is happening:

#### How It Works
1. **Intermittent Listening**: Every 20-45 seconds (randomized), the app activates the mic for 3-5 seconds
2. **Audio Detection**: Uses pitch detection to verify musical activity
3. **Not Grading—Verifying**: The goal isn't to judge accuracy, just confirm piano/instrument sounds are happening
4. **Anti-Gaming**: Random intervals prevent students from gaming the system
5. **Grace Periods**: Pauses for page turns, adjustments, thinking time

#### What It Detects
- Presence of pitched musical tones (not TV, talking)
- Approximate pitch range (verifies correct instrument/register)
- Activity level (continuous practice vs. single notes with long gaps)

#### Privacy-First Approach
- Audio is processed **on-device only**—never uploaded
- Only metadata sent to server: "practice verified at timestamp"
- No recordings stored unless student explicitly saves one

### Smart Breakdowns

When a teacher assigns a piece, the app can suggest practice strategies:

```
Moonlight Sonata, mm. 1-8
━━━━━━━━━━━━━━━━━━━━━━━━━

Suggested breakdown (AI-generated or teacher-customized):

1. UNDERSTAND THE PATTERN (2 min)
   Look at the LH triplet pattern. It repeats throughout.

2. LH ALONE, SLOWLY (3 min)
   Focus on voicing the bass note louder than upper notes.
   [Hear Example]

3. RH MELODY (2 min)
   Sing it first, then play. Long notes need arm weight.

4. HANDS TOGETHER, HALF TEMPO (5 min)
   Use metronome at 40 BPM. Prioritize accuracy over speed.

5. GRADUAL SPEEDUP (3 min)
   Increase metronome 5 BPM at a time. Stop when it breaks down.
```

---

## Gamification System

### Core Mechanics

Based on research into Duolingo, Prodigy, and successful mobile games, the gamification system uses these proven patterns:

#### 1. Experience Points (XP)

| Action | XP Earned |
|--------|-----------|
| Complete a game round | 10-50 (based on score) |
| Practice for 1 minute | 5 |
| Complete a practice assignment | 25 |
| Perfect score on any game | 100 |
| Daily login | 10 |
| Maintain streak (per day) | 5 × streak_length |

#### 2. Levels

```
Level 1:     0 XP      "Beginner"
Level 2:   100 XP      "Novice"
Level 3:   300 XP      "Apprentice"
Level 4:   600 XP      "Student"
Level 5: 1,000 XP      "Musician"
Level 6: 1,500 XP      "Performer"
Level 7: 2,200 XP      "Artist"
...
Level 20: 50,000 XP    "Virtuoso"
Level 30: 150,000 XP   "Maestro"
```

Level-ups trigger:
- Celebratory animation
- Push notification (if app is closed)
- New profile badge frame
- Sometimes: unlock new game modes or customization

#### 3. Streaks

The most powerful retention mechanic (Duolingo reports 60% higher engagement):

- **Streak Counter**: Days in a row with qualifying practice (minimum 10 minutes or 3 game rounds)
- **Streak Freeze**: Earned every 7 days; saves one missed day
- **Streak Repair**: Pay gems to fix a broken streak (max 1 day)
- **Milestones**: Special badges at 7, 30, 100, 365 days
- **Loss Aversion UI**: Streak flame animates urgently as day ends without practice

#### 4. Achievements / Badges

Organized into collections that encourage completionist behavior:

**The Basics**
- [ ] First Note (Play your first game)
- [ ] Perfect Start (100% accuracy on first try)
- [ ] Week One (Practice 7 days total)

**Speed Demon**
- [ ] Lightning Round (Complete a game in under 30 sec)
- [ ] Speedster (Reach Stage 5 in Grand Staff Prix)
- [ ] Untouchable (No wrong answers for 50 notes)

**Ear Training Master**
- [ ] Interval Ace (Master all intervals)
- [ ] Chord Detective (Identify 100 chords correctly)
- [ ] Melody Maker (Perfect score on melodic dictation)

**Dedication**
- [ ] Early Bird (Practice before 8 AM)
- [ ] Night Owl (Practice after 9 PM)
- [ ] Marathon (Practice for 60 minutes in one session)
- [ ] Iron Will (30-day streak)
- [ ] Legendary (365-day streak)

#### 5. Leaderboards & Leagues

Weekly competitive leagues (à la Duolingo):

```
BRONZE LEAGUE
━━━━━━━━━━━━━
Your studio competes internally each week.

Top 3 promote to Silver League.
Bottom 3 stay in Bronze.

This Week's Standings:
1. 🥇 Emma T.      2,340 XP
2. 🥈 Marcus L.    2,105 XP
3. 🥉 Sophie R.    1,890 XP
4.    YOU          1,654 XP  ← 236 XP to reach 3rd!
5.    James K.     1,432 XP
```

League tiers:
- Bronze → Silver → Gold → Platinum → Diamond → Master

#### 6. Gems / Currency

Earned through practice; spent on:
- Streak Freezes
- Cosmetic items (car skins, ship skins, profile frames)
- Power-ups in games (extra life, slow-mo, hint)
- Streak repairs

**Important:** No real-money purchases for children. Currency is earned only.

#### 7. Daily Challenges

Rotating challenges that refresh at midnight:

```
TODAY'S CHALLENGES
━━━━━━━━━━━━━━━━━

🎯 Perfect a round of Staff Blaster ........... 50 XP
🔥 Practice for 20 minutes ................... 75 XP
🎵 Identify 10 intervals correctly ........... 40 XP
⭐ BONUS: Complete all 3 challenges ......... +100 XP
```

---

## Student Profiles & Competition

### Profile System

Each student has a persistent profile that tracks their entire journey:

```
┌─────────────────────────────────────────────────────────────┐
│  👤 EMMA T.                                    Level 12     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│                                                             │
│  🔥 47-day streak          ⭐ 12,450 total XP               │
│  🏆 Gold League            💎 340 gems                      │
│                                                             │
│  ┌─────────────────────────────────────────────────┐        │
│  │ BADGES                                          │        │
│  │ 🎵 🎹 🏃 🔥 ⭐ 🎯 🌙 📈 🎪 ➕12 more             │        │
│  └─────────────────────────────────────────────────┘        │
│                                                             │
│  BEST SCORES                                                │
│  ──────────────                                             │
│  Grand Staff Prix:    2,340 (Stage 6)                       │
│  Staff Blaster:       1,850 (Tier 4)                        │
│  Interval Invaders:     920                                 │
│  Rhythm Racer:        1,450                                 │
│                                                             │
│  THIS WEEK                                                  │
│  ──────────────                                             │
│  Practice time:       2h 15m                                │
│  Games played:        23                                    │
│  XP earned:           1,240                                 │
│                                                             │
│  [VIEW STATS]  [ACHIEVEMENTS]  [CUSTOMIZE]                  │
└─────────────────────────────────────────────────────────────┘
```

### Competition Modes

#### 1. Studio Leaderboard
Students within the same teacher's studio compete weekly. Fosters friendly competition among peers who see each other at lessons.

#### 2. Class Challenges
Teacher creates a class-wide challenge:
- "First to identify 500 notes wins a prize"
- "Collective goal: Our studio plays 10,000 notes this week"

#### 3. Head-to-Head (Optional Feature)
Real-time multiplayer where two students race:
- Same note sequence appears for both
- First to answer correctly gets the point
- Best of 10 rounds

#### 4. Global Leaderboard (Opt-In)
For competitive students who want to see how they rank worldwide. Privacy-protected: display name only, no real names.

### Privacy Protections for Competition

- **Usernames**: Students create display names (not real names)
- **Studio-Scoped Default**: Competition is within teacher's studio by default
- **Opt-In Global**: Wider competition requires parental consent
- **No Direct Messaging**: Students cannot message each other; only teacher can message
- **Anonymized Stats**: Teacher sees student names; leaderboards show display names only

---

## Technical Architecture

### Platform Strategy

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Games** | Web (HTML5/Canvas/Three.js) | Universal access, no app store friction, easy updates |
| **Practice Mode** | PWA + Native wrapper | Offline support, push notifications, mic access |
| **Teacher Studio** | Web app (React) | Desktop-optimized for studio management |
| **Backend** | Node.js + PostgreSQL | Scalable, well-supported |
| **Real-time** | WebSockets | Live leaderboards, multiplayer features |
| **Audio Analysis** | Web Audio API + pitchy/WASM | On-device pitch detection |

### Audio Processing Stack

```
Microphone Input
       │
       ▼
getUserMedia() ──► Audio Stream
       │
       ▼
Web Audio API ──► AudioContext
       │
       ▼
AnalyserNode ──► FFT Data
       │
       ▼
Pitch Detection (pitchy / YIN algorithm)
       │
       ▼
Note Detection ──► Game Logic / Practice Verification
```

For complex pitch detection (real-time sight-singing):
- Use WebAssembly-compiled pitch detection (Rust or C++)
- [pitchy npm package](https://www.npmjs.com/package/pitchy) for lightweight use cases
- [PitchDetect by cwilso](https://github.com/cwilso/PitchDetect) as reference implementation

### Offline Capabilities

PWA features for Practice Mode:
- Service worker caches all game assets
- Practice sessions work fully offline
- Syncs progress when connection restored
- Push notifications for streak reminders

### API Structure

```
/api/v1/
├── auth/
│   ├── login
│   ├── register
│   └── verify-parent
├── students/
│   ├── profile
│   ├── progress
│   ├── practice-log
│   └── achievements
├── teachers/
│   ├── studio
│   ├── students
│   ├── assignments
│   └── analytics
├── games/
│   ├── scores
│   ├── leaderboards
│   └── challenges
└── practice/
    ├── session/start
    ├── session/verify
    ├── session/complete
    └── recordings
```

---

## Privacy & Compliance

### Regulatory Framework

PracticePal must comply with:

1. **COPPA** (Children's Online Privacy Protection Act)
   - Applies to children under 13 in the US
   - Requires verifiable parental consent before collecting personal information
   - Schools can provide consent in educational contexts

2. **FERPA** (Family Educational Rights and Privacy Act)
   - Protects student education records
   - Restricts who can access and use student information
   - Applies when used in school settings

3. **GDPR** (if serving EU users)
   - Additional consent requirements
   - Right to data deletion
   - Data portability

### Data Collection Principles

#### What We Collect

| Data Type | Purpose | Stored Where | Retention |
|-----------|---------|--------------|-----------|
| Display name | Identification | Server | Until account deleted |
| Email (parent/teacher) | Account recovery, notifications | Server, encrypted | Until account deleted |
| Practice logs | Progress tracking | Server | Until account deleted |
| Game scores | Leaderboards, progress | Server | Until account deleted |
| Audio samples | Only if user explicitly saves | Server, encrypted | Until user deletes |

#### What We DON'T Collect

- **Real names** (display names only for students)
- **Location data**
- **Device identifiers** (beyond session management)
- **Audio recordings** (processed on-device, not uploaded)
- **Browsing history**
- **Third-party tracking**

### Audio Privacy — Critical

Practice verification listens to the microphone but:

1. **All processing happens on-device**
2. **No audio is transmitted to servers** — only "verified at [timestamp]" metadata
3. **No recordings stored** unless student explicitly saves one for teacher feedback
4. **Clear visual indicator** when mic is active
5. **Can be disabled** by parent/teacher (verification becomes optional)

### Consent Flow

```
NEW STUDENT REGISTRATION
━━━━━━━━━━━━━━━━━━━━━━━━

For students under 13:

1. Teacher creates student slot
2. Parent receives email invitation
3. Parent reviews privacy policy
4. Parent provides verifiable consent
   - Email confirmation link, OR
   - Credit card verification (small refundable charge), OR
   - Signed consent form upload
5. Student account activated

For students 13+:
- Student can register with email verification
- Parental notification sent (not consent required)
```

### Teacher Responsibilities

Teachers using PracticePal agree to:
- Use student data only for educational purposes
- Not share student information outside the platform
- Comply with their school's data privacy policies
- Inform parents about platform usage

### Data Deletion

- **Students/Parents** can request full data deletion
- **30-day deletion window** in case of accidental request
- **Teacher exit**: When teacher closes studio, student data can transfer to new teacher or be deleted
- **Annual cleanup**: Inactive accounts (no login for 2 years) are flagged for deletion

---

## Competitive Analysis

### Direct Competitors

| App | Strengths | Weaknesses | Our Advantage |
|-----|-----------|------------|---------------|
| **Tenuto** | Comprehensive drills, cheap ($5) | Zero gamification, sterile UI | Fun-first design |
| **Note Rush** | Mic input, themes | Themes superficial, no practice tracking | Integrated practice system |
| **Staff Wars** | Game-like, recognizable | Dated visuals, limited scope | Modern aesthetic, full suite |
| **EarMaster** | Professional-grade, school-focused | Expensive, academic feel | Kid-friendly, teacher-friendly |
| **Yousician** | Excellent UX, mic feedback | Expensive subscription, broad focus | Music theory depth, teacher control |
| **Simply Piano** | Smooth onboarding, gamified | Piano-only, no theory games | Multiple instruments, theory focus |

### Practice Tracking Competitors

| App | Strengths | Weaknesses | Our Advantage |
|-----|-----------|------------|---------------|
| **Tonara** | AI feedback, gamification | Discontinued (2023) | We exist! |
| **Modacity** | Great practice tools | No teacher integration, no games | Games + teacher dashboard |
| **Practice Space** | Teacher features, rewards | No games, limited engagement tools | Full arcade of games |

### Key Differentiators

1. **Games First**: Our games pass the "would they play this for fun?" test
2. **Integrated Platform**: Games + Practice + Teacher Dashboard in one ecosystem
3. **Practice Verification**: AI listens to confirm real practice happening
4. **Duolingo-Level Gamification**: Streaks, leagues, achievements that actually work
5. **Teacher Control**: Teachers assign, track, and guide—not just "assign an app"

---

## Development Roadmap

### Phase 1: Foundation (Months 1-3)

**Goal**: Launch MVP with core games and basic teacher features

- [ ] Grand Staff Prix (note reading racer) — *polishing existing*
- [ ] Staff Blaster (note reading shooter) — *polishing existing*
- [ ] Student profile system with XP and levels
- [ ] Streak system
- [ ] Basic Teacher Studio (add students, view scores)
- [ ] PWA wrapper for mobile
- [ ] Privacy policy and COPPA compliance framework

**Launch**: Beta with 5-10 pilot teachers

### Phase 2: Practice Mode (Months 4-6)

**Goal**: Introduce guided practice with audio verification

- [ ] Practice Mode UI and flow
- [ ] Assignment creation in Teacher Studio
- [ ] Audio verification system (on-device)
- [ ] Piece breakdown suggestions
- [ ] Practice time tracking
- [ ] Parent notification system

### Phase 3: Expanded Games (Months 7-9)

**Goal**: Full arcade covering rhythm, ear training, theory

- [ ] Rhythm Racer (rhythm reading)
- [ ] Interval Invaders (interval recognition)
- [ ] Chord Crusher (chord identification)
- [ ] Daily challenges system
- [ ] Achievements system (full badge collection)
- [ ] Gems currency

### Phase 4: Advanced Features (Months 10-12)

**Goal**: Sight-singing, dictation, competition features

- [ ] Melody Quest (sight-singing with pitch detection)
- [ ] Rhythm Recall (rhythmic dictation)
- [ ] Weekly leagues and leaderboards
- [ ] Head-to-head multiplayer (optional)
- [ ] Advanced analytics for teachers
- [ ] API for school LMS integration

### Phase 5: Scale (Year 2)

- [ ] Native apps (iOS/Android) for better performance
- [ ] School/district licensing
- [ ] Curriculum alignment tools
- [ ] Additional instruments beyond piano
- [ ] Community features (teacher resource sharing)
- [ ] Internationalization

---

## Design Principles

### 1. Fun First, Education Embedded

> "The best educational games are sometimes the games that don't even seem like they are educational."

Every game must be genuinely fun. The learning is the core mechanic, not a layer on top.

### 2. Respect the Player

> "Users, especially Gen Z and Gen Alpha, have experienced expert-level game design since early childhood. They instantly identify manipulative design patterns."

No dark patterns. No predatory monetization. No insulting their intelligence by slapping XP bars on worksheets.

### 3. Teacher as Coach, Not Cop

Teachers should feel empowered to guide, not police. The system provides data; the teacher provides wisdom.

### 4. Privacy as Feature

We can build trust by collecting *less* data, not more. Audio verification works on-device because it should.

### 5. Progression Over Perfection

Celebrate growth. A student who improves from 60% to 80% deserves as much recognition as one who maintains 95%.

### 6. Consistency Beats Intensity

A 15-minute daily practice is worth more than a 2-hour cram session. The gamification system rewards consistency.

### 7. One More Round

The ultimate test: after losing, does the player immediately tap "Play Again"? If not, the game isn't good enough.

---

## Contributing

[To be added: contribution guidelines, code of conduct, development setup]

---

## License

[To be determined]

---

## Contact

[Project contact information]

---

## References & Research

### Gamification Research
- [Duolingo Gamification Case Study](https://trophy.so/blog/duolingo-gamification-case-study)
- [Prodigy Math Gamification Strategy](https://trophy.so/blog/prodigy-math-game-gamification-case-study)
- [31 Core Gamification Techniques](https://sa-liberty.medium.com/the-31-core-gamification-techniques-part-1-progress-achievement-mechanics-d81229732f07)
- [108 Gamification Elements and Mechanics](https://mambo.io/blog/gamification-elements-and-mechanics)

### Music Education Apps
- [Best Ear Training Apps 2026](https://sonofield.com/blog/best-ear-training-apps-2026)
- [Top Rhythm Reading Apps](https://midnightmusic.com/2024/05/top-11-rhythm-reading-apps-for-music-teachers/)
- [Sight Singing Pro](https://apps.apple.com/us/app/sight-singing-pro-solfege-us/id1631774557)
- [EarMaster Review](https://singingcommunity.com/earmaster-review/)

### Practice Tracking
- [Tonara Platform](https://www.tonara.com/)
- [Modacity Features](https://www.modacity.co/)
- [Practice Space App](https://www.practicespaceapp.com/)

### Technical Resources
- [Web Audio API Pitch Detection](https://alexanderell.is/posts/tuner/)
- [pitchy npm package](https://www.npmjs.com/package/pitchy)
- [PitchDetect GitHub](https://github.com/cwilso/PitchDetect)

### Privacy & Compliance
- [COPPA and Schools Explained](https://www.edweek.org/technology/coppa-and-schools-the-other-federal-student-privacy-law-explained/2017/07)
- [Building Privacy-Compliant EdTech Systems](https://6b.education/insight/building-privacy-compliant-systems-edtech-development-under-gdpr-coppa-and-ferpa/)
- [FERPA, PPRA, and COPPA Overview](https://studentprivacymatters.org/ferpa_ppra_coppa/)

---

*Last Updated: June 2026*
