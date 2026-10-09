> **Historical archive.** Archived analysis dated 2026-02-21. Findings, counts, source paths and proposed fixes below describe that snapshot and have not been revalidated as current issues. See the [current project documentation](../../../README.md).

# Chessizer - Refactoring Roadmap

**Date:** 2026-02-21
**Goal:** Improve code quality, maintainability, and performance

---

## 1. State Management Refactoring

### 1.1 Extract App.tsx State into Custom Hooks

**Current:** App.tsx manages 11+ pieces of state directly.

**Target Architecture:**

```
App.tsx (thin shell, composition only)
  |-- useGameState()        -> gamePreset, pgnData, currentFen, moveIndex, moveCount
  |-- useAudioSettings()    -> bpm, swing, tickMs, masterVolume + persistence
  |-- useSoundAgent()       -> agent, isPlaying, init, play, stop, setPosition
  |-- useNavigation()       -> externalMoveIndex, prev, next, goTo
```

#### `useGameState.ts`
```typescript
export function useGameState() {
  const [gamePreset, setGamePreset] = useState('immortal_game');
  const [pgnData, setPgnData] = useState('');
  const [currentFen, setCurrentFen] = useState('');
  const [moveIndex, setMoveIndex] = useState(0);
  const [moveCount, setMoveCount] = useState(1);

  const gamePresets = useMemo(() => ({ /* ... */ }), []);

  const selectPreset = useCallback((id: string) => {
    setGamePreset(id);
    setPgnData(gamePresets[id]?.pgn || '');
  }, [gamePresets]);

  return { gamePreset, pgnData, currentFen, setCurrentFen,
           moveIndex, setMoveIndex, moveCount, setMoveCount,
           selectPreset, gamePresets };
}
```

#### `useAudioSettings.ts`
```typescript
export function useAudioSettings() {
  // Centralized localStorage read/write with single persistence effect
  const [settings, setSettings] = useLocalStorage('chessizer.audio', {
    bpm: 120, swing: 0, tickMs: 1000, masterVolume: 0.7
  });

  const updateSetting = useCallback((key: string, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings({ bpm: 120, swing: 0, tickMs: 1000, masterVolume: 0.7 });
  }, []);

  return { ...settings, updateSetting, resetToDefaults };
}
```

#### `useSoundAgent.ts`
```typescript
export function useSoundAgent(currentFen: string, settings: AudioSettings) {
  const agentRef = useRef<SoundAgent | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load config and create agent
  useEffect(() => { /* ... */ }, []);

  // Sync position
  useEffect(() => {
    agentRef.current?.setPosition(currentFen);
  }, [currentFen]);

  // Sync settings
  useEffect(() => {
    const agent = agentRef.current;
    if (!agent) return;
    agent.setTransport({ bpm: settings.bpm, swing: settings.swing });
    agent.setMasterVolume(settings.masterVolume);
    agent.setTickDuration(settings.tickMs);
  }, [settings]);

  const togglePlay = useCallback(async () => { /* ... */ }, []);

  // Cleanup on unmount
  useEffect(() => () => { agentRef.current?.dispose(); }, []);

  return { agent: agentRef.current, isPlaying, togglePlay };
}
```

### 1.2 Move Game Presets to Separate File

**Current:** 200+ lines of PGN strings inside App.tsx useMemo.

**Target:** `src/data/gamePresets.ts`

```typescript
export const GAME_PRESETS = {
  immortal_game: {
    name: "The Immortal Game",
    description: "Anderssen vs Kieseritzky, 1851",
    pgn: `[Event "Immortal Game"]...`
  },
  // ...
} as const;

export type GamePresetId = keyof typeof GAME_PRESETS;
```

## 2. Audio System Refactoring

### 2.1 Chess Instance Caching in SoundAgent

**Current:** New Chess instance created on every `processTick` and `computeIntensity`.

**Target:**
```typescript
class SoundAgent {
  private cachedChess: Chess | null = null;
  private cachedIntensity: number = 0;

  setPosition(fen: string): void {
    if (fen === this.currentFen) return;
    this.previousFen = this.currentFen;
    this.currentFen = fen;
    this.cachedChess = new Chess(fen);  // Create once
    this.cachedIntensity = this.computeIntensity(this.cachedChess);  // Compute once
    this.traversal = this.buildTraversal(this.cachedChess);
    // ...
  }

  private processTick(time: number): void {
    if (!this.cachedChess) return;
    // Use cached chess instance - no allocation needed
    const chess = this.cachedChess;
    // Use pre-computed intensity
    const factor = this.mapIntensityFactor(this.cachedIntensity);
    // ...
  }
}
```

**Impact:** Eliminates 3-4 Chess allocations per tick, reduces GC pressure significantly.

### 2.2 Voice Pool with Proper Lifecycle

**Current:** Voices are built once and never recycled. PitchShift aliases double node count.

**Target:**
```typescript
class VoicePool {
  private pool: Map<string, BuiltVoice[]> = new Map();
  private active: Map<string, BuiltVoice> = new Map();
  private maxPerType: number;

  acquire(voiceId: string): BuiltVoice | null { /* ... */ }
  release(instanceId: string): void { /* ... */ }
  releaseAll(): void { /* ... */ }
  dispose(): void { /* ... */ }
}
```

### 2.3 Extract Traversal Strategies to Separate Module

**Current:** 6 traversal factory functions (200+ lines) inline in SoundAgent.ts.

**Target:** `src/audio/traversal/`
```
src/audio/traversal/
  index.ts              - Factory function and type exports
  rowSequential.ts      - makeRowSequential
  columnSequential.ts   - makeColumnSequential
  spiralFromCenter.ts   - makeSpiralFromCenter
  ringsFromKing.ts      - makeRingsFromKing
  randomSeeded.ts       - makeRandomSeeded
  customList.ts         - makeCustomList
  types.ts              - Shared types (TraversalResult, Traversal interface)
```

Define a common interface:
```typescript
interface Traversal {
  nextTick(): { startTime: number; cells: string[]; done: boolean };
  reset(): void;
}

type TraversalFactory = (chess?: Chess, params?: Record<string, unknown>) => Traversal;
```

### 2.4 Proper Agent Disposal

**Current:** `handleConfigChange` in App.tsx replaces agent without disposing.

**Target:** Add cleanup to useSoundAgent hook:
```typescript
const replaceAgent = useCallback((newConfig: SoundAgentConfig) => {
  const oldAgent = agentRef.current;
  if (oldAgent) {
    oldAgent.stop();
    oldAgent.dispose();  // Disposes all Tone.js nodes
  }
  const newAgent = new SoundAgent(newConfig);
  agentRef.current = newAgent;
}, []);
```

## 3. Component Refactoring

### 3.1 Decompose App.tsx

**Current:** 607 lines, single file.

**Target:**
```
src/components/
  App.tsx                  (~100 lines - composition shell)
  layout/
    Header.tsx             (branding, game selector)
    NavigationBar.tsx       (game presets, PGN loader, PGN display)
  audio/
    ToneJsControls.tsx     (BPM, swing, tick, volume, play/stop)
    WavControls.tsx         (WAV player controls - existing WavPlayerControls)
    TransportBar.tsx        (unified playback controls)
  chess/
    BoardPanel.tsx          (board + viewer wrapper)
    MoveList.tsx            (custom move list, replaces pgn-viewer move panel)
    GameInfo.tsx            (game metadata display)
  settings/
    TraversalControls.tsx   (existing, cleaned up)
    EarconTester.tsx        (existing)
    ConfigEditor.tsx        (existing)
```

### 3.2 Fix WavSoundPlayer Hook

**Current:** Named `WavSoundPlayer` (component naming convention) but is a hook returning an object.

**Changes:**
1. Rename to `useWavPlayer`
2. Move from `.tsx` to `.ts` (no JSX)
3. Fix the invocation in WavPlayerControls to follow hook convention

```typescript
// Before
const wavPlayer = WavSoundPlayer({ currentFen, ... });

// After
const wavPlayer = useWavPlayer({ currentFen, ... });
```

### 3.3 Remove Dead Code

**Files to remove:**
- `src/audio/ToneEngine.ts` (707 lines, fully commented out in imports)
- `src/audio/engine.ts` (empty file)

**Dependencies to remove from package.json:**
- `chessground` (not imported anywhere)
- `react-chessground` (not imported anywhere)
- `@radix-ui/react-select` (not used in any component)
- `@types/chess.js` (chess.js 1.x includes its own types)

### 3.4 Consolidate Game Presets

**Current:** Game presets exist in both `App.tsx` (6 games) and `PGNLoader.tsx` (5 games, overlapping).

**Target:** Single source of truth in `src/data/gamePresets.ts`, consumed by both components.

### 3.5 Centralize Validation

**Current:** Ajv is instantiated in App.tsx, ConfigEditor.tsx, and conceptually in WavSoundPlayer.

**Target:** `src/utils/validation.ts`
```typescript
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });

// Cache compiled validators
const validators = new Map<string, ValidateFunction>();

export function validate(schemaId: string, data: unknown): ValidationResult {
  let validator = validators.get(schemaId);
  if (!validator) {
    const schema = getSchema(schemaId); // Load from schemas/
    validator = ajv.compile(schema);
    validators.set(schemaId, validator);
  }
  const valid = validator(data);
  return { valid, errors: valid ? [] : formatErrors(validator.errors) };
}
```

## 4. Performance Improvements

### 4.1 Reduce Re-renders

**Add React.memo to:**
- `EarconTester` (only depends on agent, rarely changes)
- `TraversalControls` (only depends on agent)
- `GameInfo` (only depends on game metadata)
- `ConfigEditor` (only depends on onConfigChange callback)

### 4.2 Debounce Config Editor

**Current:** Validates JSON on every keystroke.

**Target:** Debounce 300ms, only validate and notify parent after pause.

### 4.3 Lazy-load Heavy Components

```typescript
const ConfigEditor = lazy(() => import('./ConfigEditor'));
const EarconTester = lazy(() => import('./EarconTester'));
```

These components are rarely used and add to initial bundle size.

### 4.4 Web Worker for Chess Analysis

Move `computeIntensity` to a Web Worker:
```typescript
// worker.ts
self.onmessage = (e) => {
  const { fen } = e.data;
  const chess = new Chess(fen);
  const intensity = computeIntensity(chess);
  self.postMessage({ intensity });
};
```

This prevents Chess analysis from blocking the audio thread.

## 5. Testing Strategy

### 5.1 Unit Tests (Priority)

**Audio Logic:**
- `SoundAgent.computeIntensity()` - Test with known positions
- `SoundAgent.mapIntensityFactor()` - Test all curves
- Traversal factories - Test cell ordering for each strategy
- `scheduleEarconAt()` - Test pattern scheduling

**State Management:**
- `useGameState` - Test preset selection, FEN updates
- `useAudioSettings` - Test persistence, reset, validation

**Utility Functions:**
- `mulberry32` - Test PRNG determinism
- `hashString` - Test distribution
- `sqToCoord` - Test coordinate conversion

### 5.2 Integration Tests

- Load PGN -> parse -> navigate -> verify FEN sequence
- Config change -> agent recreation -> audio output verification
- Volume/BPM/swing change -> verify agent receives values

### 5.3 E2E Tests (Nice to Have)

- Full play-through of a game preset
- Config editor open -> edit -> save -> verify applied
- WAV generation (requires Python microservice running)

## 6. File Structure (Target)

```
src/
  components/
    App.tsx                    # Thin composition shell
    layout/
      Header.tsx
      NavigationBar.tsx
    audio/
      ToneJsControls.tsx
      TransportBar.tsx
    chess/
      BoardPanel.tsx
      MoveList.tsx
      GameInfo.tsx
    settings/
      TraversalControls.tsx
      EarconTester.tsx
      ConfigEditor.tsx
      WavPlayerControls.tsx
    ui/
      button.tsx
      dialog.tsx
      slider.tsx

  audio/
    SoundAgent.ts              # Core audio engine
    useWavPlayer.ts            # Renamed from WavSoundPlayer.tsx
    traversal/
      index.ts
      types.ts
      rowSequential.ts
      columnSequential.ts
      spiralFromCenter.ts
      ringsFromKing.ts
      randomSeeded.ts
      customList.ts
    voicePool.ts               # New: voice lifecycle management

  hooks/
    useGameState.ts
    useAudioSettings.ts
    useSoundAgent.ts
    useNavigation.ts
    useLocalStorage.ts

  data/
    gamePresets.ts             # Extracted from App.tsx

  utils/
    cn.ts                      # Existing
    validation.ts              # New: centralized Ajv

  types/
    pgn-viewer.d.ts            # Existing
    audio.ts                   # New: shared audio types

  __tests__/
    audio/
      SoundAgent.test.ts
      traversal.test.ts
    hooks/
      useGameState.test.ts
      useAudioSettings.test.ts
    components/
      MoveList.test.tsx
```

## 7. Migration Steps

### Step 1: Extract Game Presets (Low Risk)
- Create `src/data/gamePresets.ts`
- Import in App.tsx and PGNLoader.tsx
- Remove duplicated data
- No behavior change

### Step 2: Extract Custom Hooks (Medium Risk)
- Create hook files one at a time
- Replace usage in App.tsx incrementally
- Verify each hook in isolation
- App.tsx shrinks from 607 to ~100 lines

### Step 3: Remove Dead Code (Low Risk)
- Delete ToneEngine.ts, engine.ts
- Remove unused dependencies
- Run `pnpm build` to verify no breakage

### Step 4: Fix SoundAgent Performance (Medium Risk)
- Add Chess caching
- Pre-compute intensity
- Add agent disposal on replacement
- Test audio output matches before/after

### Step 5: Extract Traversal Strategies (Low Risk)
- Create traversal/ directory
- Move functions one at a time
- SoundAgent imports from new location
- No behavior change

### Step 6: Component Decomposition (Medium Risk)
- Create layout components
- Move sections from App.tsx
- Verify styling preserved
- Test all interactions

### Step 7: PGN Viewer Integration (High Risk)
- Build custom MoveList component
- Run in parallel with existing pgn-viewer
- Verify position sync works reliably
- Replace old code once stable

### Step 8: Add Tests (Low Risk)
- Set up Jest + React Testing Library
- Write tests for extracted modules
- Add to CI/CD pipeline

## 8. Estimated Impact

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| App.tsx lines | 607 | ~100 | -84% |
| SoundAgent.ts lines | 863 | ~500 | -42% |
| Total dead code | ~800 lines | 0 | -100% |
| Chess instances/tick | 3-4 | 0 | -100% |
| Audio latency (click to sound) | 200-300ms | 20-50ms | -85% |
| Test coverage | 0% | 60%+ | +60% |
| Bundle size (unused deps) | ~150KB | 0KB | -100% |
