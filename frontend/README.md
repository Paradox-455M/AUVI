# Auvi Frontend

A cinematic, motion-heavy editorial music player with a WebGL visualizer. Built as a React SPA with an asymmetric, gallery-driven design language.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 + semantic CSS classes |
| Animation | Framer Motion 10 |
| State | Zustand 4 + module-level state |
| Audio | Web Audio API (AudioContext → GainNode → AnalyserNode) |

## Architecture

```
src/
├── App.tsx                   ← Root: route state (library | player), view transitions
├── main.tsx                  ← Vite entry
├── routes/
│   ├── Library.tsx           ← Gallery view with upload + tag management
│   └── Player.tsx            ← Audio player (lazy-loaded for code splitting)
├── audio/
│   ├── useAudioPlayer.ts     ← Primary playback hook (Web Audio API graph)
│   ├── AudioEngine.ts        ← Analysis singleton for visualizer PCM data
│   ├── useAudio.ts           ← Audio utilities
│   └── types.ts
├── music/
│   ├── useMusicLibrary.ts    ← Track state management (uploads, blob URLs)
│   ├── metadata.ts           ← Filename → title/artist parsing, duration extraction
│   ├── tagUtils.ts           ← Tag grouping/ordering for gallery
│   └── types.ts              ← Track type definition
├── components/
│   ├── Gallery.tsx           ← Tag-grouped track grid
│   ├── TagSection.tsx        ← Single tag group with tracks
│   ├── TrackItem.tsx         ← Individual track card
│   ├── UploadTrigger.tsx     ← File upload UI
│   └── Text.tsx              ← Typography components
├── ui/
│   ├── AppChrome.tsx         ← App shell / layout wrapper
│   ├── Controls.tsx          ← Playback controls
│   ├── HeroStack.tsx         ← Hero visual element
│   ├── SongCard.tsx          ← Song display card
│   ├── PageTransition.tsx    ← Framer Motion page transitions
│   └── Transitions.tsx       ← Shared transition presets
├── visualizer/
│   ├── VisualizerCanvas.tsx  ← Full-bleed canvas (rAF render loop)
│   ├── ProjectMEngine.ts     ← WebGL stub (future projectM WASM)
│   └── PresetManager.ts      ← MilkDrop preset management
├── styles/
│   ├── globals.css           ← CSS custom properties, Tailwind layers, utilities
│   ├── typography.css        ← Named typographic classes
│   └── layout.css            ← Structural layout classes
├── motion/
│   └── tokens.ts             ← Animation tokens (easing: [0.22,1,0.36,1], 600-1200ms)
├── data/
│   └── tracks.ts             ← Static hardcoded catalog (3 tracks)
├── hooks/
│   └── useMotion.ts          ← Motion utilities
├── types/
│   └── song.ts               ← Song type
└── utils/
    └── gpuDetection.ts       ← GPU capability detection
```

## Design System

- **Motion:** Cinematic easing `[0.22, 1, 0.36, 1]`, transitions 600ms–1200ms
- **Layout:** Intentionally asymmetric, editorial spacing
- **Typography:** Named classes (`.display-cinematic`, `.track-title-elegant`, `.body-editorial`)
- **Effects:** Grain overlay, hover drift, glassmorphism

## Data Flow

```
Upload → useMusicLibrary.addFiles() → blob URL + Track object
                    ↓
Gallery → tagUtils groups by tag → TagSection → TrackItem
                    ↓ (click)
App.tsx (selectedSongId = blob URL) → Player view transition
                    ↓
Player → useAudioPlayer.load(url) → Web Audio API graph
                    ↓
VisualizerCanvas ← AudioEngine.getAnalysis() → rAF render loop
```

## Setup

```bash
npm install
npm run dev        # Start Vite dev server (http://localhost:5173)
npm run build      # Type-check (tsc) + production build
npm run preview    # Serve the built dist/
```

Path alias: `@/` maps to `src/`

---

## ✅ What's Built

- [x] Two-route SPA (Library ↔ Player) with Framer Motion transitions
- [x] File upload with blob URL generation
- [x] Filename-based metadata parsing (title, artist, duration)
- [x] Tag management and tag-grouped gallery view
- [x] Full Web Audio API playback (play/pause, volume, gain ramping)
- [x] AnalyserNode feeding real-time PCM data to visualizer
- [x] WebGL canvas with rAF render loop
- [x] MilkDrop preset manager (1 default preset)
- [x] Code splitting (Player is lazy-loaded)
- [x] Cinematic design system (motion tokens, editorial typography, grain overlay)
- [x] GPU capability detection

## 🔲 What's Remaining

- [ ] **Backend integration** — replace blob URLs with API-served audio (connect to Go backend)
- [ ] **ProjectM WASM visualizer** — `ProjectMEngine.ts` is currently a stub
- [ ] **Persistent library** — tracks are lost on page refresh (no backend storage yet)
- [ ] **Search & filtering** — search tracks by title, artist, tag
- [ ] **Playlist / queue** — play multiple tracks sequentially
- [ ] **Responsive design** — optimize for mobile and tablet
- [ ] **Keyboard shortcuts** — space for play/pause, arrows for seek
- [ ] **Audio streaming** — serve audio from backend instead of blob URLs
- [ ] **User accounts** — saved libraries, preferences
- [ ] **Additional presets** — more MilkDrop-style visualizer presets
- [ ] **Waveform display** — visual waveform alongside playback controls
- [ ] **Performance** — virtualized track lists for large libraries
