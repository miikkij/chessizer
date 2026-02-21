# Chessizer - Comprehensive Project Analysis

**Date:** 2026-02-21
**Branch:** main (commit 4f45ba3)
**Analyst:** Claude Code

---

## 1. Project Overview

Chessizer is a web application that converts chess game positions into rich audio soundscapes. Users load chess games (PGN format), navigate through positions, and experience them through sonified audio via two synthesis engines:

- **Tone.js Real-time Engine** (`SoundAgent.ts`) - JSON-driven, live audio feedback
- **Python WAV Generator** (`soundAgentsv2/`) - High-quality offline WAV rendering via FastAPI microservice

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.1.1 |
| Language | TypeScript | 5.8.3 |
| Build | Vite | 7.1.2 |
| Styling | Tailwind CSS | 3.4.17 |
| Audio (Frontend) | Tone.js | 15.1.22 |
| Chess Logic | chess.js | 1.4.0 |
| Chess Board | @mliebelt/pgn-viewer | 1.6.11 |
| UI Components | shadcn/ui (Radix) | Various |
| Backend | FastAPI (Python) | N/A |
| Audio (Backend) | NumPy | N/A |

## 3. Architecture Assessment

### 3.1 Strengths

1. **Dual-engine design** is creative and provides both real-time feedback and high-quality rendering
2. **JSON-driven configuration** allows sound customization without code changes
3. **Strong TypeScript usage** throughout with proper type definitions
4. **Modular audio system** - SoundAgent is well-encapsulated with clear API
5. **6 traversal strategies** provide sonic variety (row, column, spiral, rings, random, custom)
6. **Intensity-responsive dynamics** that adapt voice count to position complexity
7. **Good error handling** in async operations with toast notifications
8. **localStorage persistence** for user preferences with graceful fallbacks

### 3.2 Critical Issues

1. **PGNViewerWrapper is fragile** - relies on DOM polling (200ms interval), CSS class name guessing, and multiple fallback mechanisms to detect user clicks. This is the single most brittle part of the codebase.

2. **App.tsx state explosion** - 607 lines managing 11+ pieces of state with complex effect dependencies. Risk of infinite render loops (defensive checks are already present, suggesting this has happened).

3. **No resource cleanup on SoundAgent replacement** - when `handleConfigChange` creates a new SoundAgent, the old one is not disposed. Audio nodes leak.

4. **ToneEngine.ts is dead code** - 707 lines that are commented out in imports but still shipped. Confuses maintenance.

5. **WavSoundPlayer hook misuse** - `WavSoundPlayer` is a custom hook but is invoked like a function in `WavPlayerControls` (`const wavPlayer = WavSoundPlayer({...})`). While it works, this violates React conventions and can confuse tooling.

6. **PGNLoader is disconnected** - `PGNLoader.onGameLoaded` receives FEN arrays but `App.tsx` only uses `fens[0]`, discarding the rest. The loader duplicates game presets that already exist in App.

### 3.3 Code Quality Metrics

| Metric | Score | Notes |
|--------|-------|-------|
| TypeScript Coverage | 8/10 | Good types, some `any` casts in Tone.js interop |
| Component Cohesion | 5/10 | App.tsx does too much; some components are well-isolated |
| Test Coverage | 0/10 | No unit or integration tests |
| Error Handling | 6/10 | Try-catch in async paths; missing error boundaries |
| Documentation | 7/10 | Good README and design docs; inline comments sparse |
| Performance | 5/10 | Polling, new Chess instances every tick, no memoization on heavy operations |
| Accessibility | 4/10 | Basic ARIA labels; keyboard navigation incomplete |
| Bundle Size | 5/10 | Dead code (ToneEngine), unused dependencies (chessground, react-chessground) |

## 4. File-by-File Analysis

### `src/components/App.tsx` (607 lines)
**Responsibility:** Application shell, state management, game presets, audio controls UI
**Issues:**
- Manages 11 useState hooks + 2 refs = too much state in one component
- Game presets hardcoded as a 200+ line useMemo block
- 4 separate useEffect hooks for localStorage persistence (one per setting)
- `handleConfigChange` creates new SoundAgent without disposing old one (memory leak)
- `handlePlay` sets isPlaying before agent.start() completes successfully
- `externalMoveIndex` cleared after 100ms timeout - fragile timing assumption

### `src/audio/SoundAgent.ts` (863 lines)
**Responsibility:** JSON-driven real-time audio synthesis engine
**Issues:**
- Creates new `Chess` instance on every `processTick` call (line 575) - should cache
- `computeIntensity` creates 2 additional Chess instances (lines 755-756) with FEN string manipulation
- `buildVoice` uses `(Tone as any)` extensively - could use a voice factory map
- No voice disposal on `setPosition` rebuild - only on full `dispose()`
- Traversal generators are not reusable between instances
- `updateDrone` calls `triggerAttack` but drone note tracking is basic

### `src/components/PGNViewerWrapper.tsx` (367 lines)
**Responsibility:** Bridge between @mliebelt/pgn-viewer and React state
**Issues:**
- 200ms polling interval runs continuously even when not needed
- DOM fallback queries CSS classes (`.move.current`, `.move.selected`, `.move.active`) that may not exist in all pgn-viewer versions
- `useLayoutEffect` with `eslint-disable-next-line react-hooks/exhaustive-deps` - intentional but risky
- Programmatic click simulation to navigate viewer (line 163) - fragile
- Multiple console.log statements left from debugging
- Creates new UUID on each render unless memoized (it is memoized, good)

### `src/audio/WavSoundPlayer.tsx` (487 lines)
**Responsibility:** WAV generation via Python microservice
**Issues:**
- Named `.tsx` but returns no JSX (it's a hook) - should be `.ts`
- `audioUrl` in dependency array of `generateAndPlay` causes stale closure issues
- Auto-regenerate effect (line 428) has no debounce - 100ms setTimeout is not sufficient for rapid position changes
- `lastFenPlayed` state may get out of sync with actual playback
- Missing abort on unmount for the auto-regenerate timeout

### `src/audio/ToneEngine.ts` (707 lines)
**Responsibility:** Legacy/alternative audio engine
**Issues:**
- Entirely unused (commented out in App.tsx imports)
- Uses `setInterval` for tick scheduling instead of Web Audio API timing
- Hardcoded base64 WAV data for percussion (line 296) - non-functional placeholder
- Should be removed or moved to a separate branch

### `src/components/WavPlayerControls.tsx` (356 lines)
**Responsibility:** UI controls for WAV generator
**Issues:**
- Calls `WavSoundPlayer()` as a function, not as a hook with `use` prefix naming convention
- `handlePlay` callback has `wavPlayer` in dependencies but `wavPlayer` is recreated every render
- Status state (`idle/generating/playing/error`) duplicates wavPlayer's internal state
- Config editor `updateConfig` does shallow copy - nested object mutations possible

### `src/components/ConfigEditor.tsx` (389 lines)
**Responsibility:** JSON configuration editor with validation
**Issues:**
- Creates new Ajv instance on every validation (lines 94, 155) - should be cached
- No debounce on textarea input - validates on every keystroke
- Configs loaded conditionally on `schemas` being non-empty, but some configs have no schema
- Initial load fails silently if no schemas exist (loadConfigs never called)

### `src/components/TraversalControls.tsx` (106 lines)
**Responsibility:** Traversal strategy selector
**Issues:**
- `ParamEditor` created inside `useMemo` with JSX return - should be a proper component
- Type casting throughout (`params as { rowsPerTick?: number }`) is fragile
- No validation on numeric inputs (can enter negative or extremely large values)

### `src/components/EarconTester.tsx` (48 lines)
**Responsibility:** Test individual piece sounds
**Issues:**
- Calls `playEarcon` and `playVoice` directly without checking if agent is initialized
- No audio context resume handling (requires user gesture)
- Limited note range for voice testing (only C4, E4, G4)

### `src/components/PGNLoader.tsx` (120 lines)
**Responsibility:** Load custom PGN games
**Issues:**
- Duplicates famous games already in App.tsx game presets
- Uses `alert()` for errors instead of toast notifications
- `parsePGN` doesn't handle multi-game PGN files
- Clipboard API `readText()` may fail silently in some browsers

## 5. Dependency Analysis

### Active Dependencies
| Package | Used By | Status |
|---------|---------|--------|
| tone | SoundAgent.ts | Active, core |
| chess.js | SoundAgent, PGNViewerWrapper, PGNLoader, ToneEngine | Active, core |
| @mliebelt/pgn-viewer | PGNViewerWrapper | Active, core |
| axios | WavSoundPlayer | Active |
| ajv | App.tsx, ConfigEditor | Active |
| animejs | App.tsx (animations) | Active, minimal use |
| react-hot-toast | Multiple | Active |
| lucide-react | WavPlayerControls | Active |
| uuid | PGNViewerWrapper | Active |

### Potentially Unused Dependencies
| Package | Notes |
|---------|-------|
| chessground | Not imported anywhere in src/ |
| react-chessground | Not imported anywhere in src/ |
| @radix-ui/react-select | Not used in any component |

### Recommendation
Remove `chessground`, `react-chessground`, and `@radix-ui/react-select` to reduce bundle size.

## 6. Performance Bottlenecks

### Critical Path: Position Change -> Audio Output
```
User clicks move in pgn-viewer
  -> 200ms poll detects change (BOTTLENECK: polling delay)
  -> setCurrentMoveIndex triggers re-render
  -> useLayoutEffect sends FEN to App
  -> App.setCurrentFen triggers useEffect
  -> agent.setPosition creates new Chess instance
  -> buildTraversal creates new traversal
  -> processTick creates ANOTHER Chess instance (BOTTLENECK: redundant)
  -> computeIntensity creates 2 MORE Chess instances (BOTTLENECK: 3 total per tick)
  -> scheduleEarconAt schedules Tone.js events
  -> Audio plays (total latency: 200-300ms)
```

### Memory Concerns
1. **Chess instance creation:** 3-4 new Chess objects per tick at ~2KB each
2. **Voice nodes:** PitchShift aliases double the number of Tone.js nodes
3. **No voice pooling:** New nodes created but never returned to a pool
4. **Blob URLs:** WAV blob URLs revoked but timing depends on React state updates

## 7. Security Assessment

| Area | Status | Notes |
|------|--------|-------|
| Input Validation | Good | Ajv schema validation, chess.js validates FEN/PGN |
| XSS Protection | Good | React's default escaping, no dangerouslySetInnerHTML |
| CORS | Acceptable | Python microservice has explicit origin allowlist |
| Dependencies | Monitor | Large dependency tree; no known CVEs at time of analysis |
| Auth | N/A | No authentication (local-only application) |
| Secrets | Clean | No hardcoded credentials or API keys |

## 8. Summary of Priority Issues

### P0 - Must Fix (Causes Glitches)
1. PGNViewerWrapper polling/click detection fragility
2. SoundAgent not disposed on config change (audio node leak)
3. Chess instance creation in processTick (performance)

### P1 - Should Fix (Improves Quality)
4. Extract App.tsx state into custom hooks
5. Remove ToneEngine dead code
6. Fix WavSoundPlayer hook naming/invocation
7. Add error boundaries

### P2 - Nice to Have (Polish)
8. Remove unused dependencies
9. Add unit tests
10. Improve accessibility
11. Add debouncing to ConfigEditor
12. Consolidate game presets (remove duplication between PGNLoader and App)
