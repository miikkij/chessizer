> **Historical archive.** Archived analysis dated 2026-02-21. Findings, counts, source paths and proposed fixes below describe that snapshot and have not been revalidated as current issues. See the [current project documentation](../../../README.md).

# Chessizer - Bug Report & Glitch Analysis

**Date:** 2026-02-21
**Scope:** All identified bugs, glitches, and runtime issues

---

## Critical Bugs (Cause Audio/UI Glitches)

### BUG-001: Audio Node Memory Leak on Config Change
**File:** `src/components/App.tsx:164`
**Severity:** Critical
**Symptoms:** Audio becomes distorted, crackling, or silent after changing config multiple times

**Root Cause:** When `handleConfigChange` creates a new `SoundAgent`, the old agent is never disposed:
```typescript
// Line 164: Old agent is replaced without cleanup
const newAgent = new SoundAgent(config as SoundAgentConfig);
setAgent(newAgent); // Old agent's Tone.js nodes still connected to audio graph
```

**Fix:** Dispose the previous agent before creating a new one:
```typescript
if (agent) {
    agent.stop();
    agent.dispose();
}
const newAgent = new SoundAgent(config as SoundAgentConfig);
```

---

### BUG-002: Excessive Chess Instance Creation Causes Audio Stuttering
**File:** `src/audio/SoundAgent.ts:575, 755-756`
**Severity:** Critical
**Symptoms:** Audio glitches, timing jitter, dropped sounds during complex positions

**Root Cause:** Every `processTick` call creates 1 new Chess instance (line 575). `computeIntensity` creates 2 more (lines 755-756) by manipulating FEN strings. That's 3 Chess instances per tick, and ticks fire every 250-1000ms.

```typescript
// Line 575 - new Chess every tick
const chess = new Chess(this.currentFen)
this.processTick(chess, time)

// Lines 755-756 - two MORE Chess instances for intensity
const cw = new Chess(fen.replace(/ (w|b) /, ' w '))
const cb = new Chess(fen.replace(/ (w|b) /, ' b '))
```

**Fix:** Cache Chess instance on `setPosition` and reuse. Pre-compute intensity on position change, not every tick.

---

### BUG-003: PGN Viewer Click Detection Fails Intermittently
**File:** `src/components/PGNViewerWrapper.tsx:199-277`
**Severity:** Critical
**Symptoms:** Clicking a move in the PGN notation sometimes doesn't update the audio; position appears stuck

**Root Cause:** The delegate click handler relies on multiple fallback mechanisms:
1. First tries `viewerRef.current?.base?.currentMove` (API not guaranteed)
2. Falls back to DOM class queries (`.move.current`, `.move.selected`, `.move.active`)
3. Falls back to reading internal chess FEN from viewer internals
4. 200ms polling catches what clicks miss

If all three click fallbacks fail AND the polling doesn't detect the change (e.g., viewer uses different CSS class names), the position is never updated.

**Fix:** Use pgn-viewer's official event/callback API if available. If not, abstract the synchronization into a dedicated service with explicit state tracking.

---

### BUG-004: Race Condition in External Move Navigation
**File:** `src/components/App.tsx:350-356, PGNViewerWrapper.tsx:145-166`
**Severity:** High
**Symptoms:** Pressing Prev/Next buttons sometimes moves 2 positions or skips back

**Root Cause:**
1. App sets `externalMoveIndex` which triggers PGNViewerWrapper to simulate a click
2. After 100ms, App clears `externalMoveIndex` to `undefined`
3. Meanwhile, PGNViewerWrapper's poll (200ms) may detect the programmatic click as a user click
4. The `programmaticChangeRef` guard has a 300ms window but timing is not guaranteed

```typescript
// App.tsx:352 - 100ms to clear external index
const timer = setTimeout(() => {
    setExternalMoveIndex(undefined);
}, 100);

// PGNViewerWrapper.tsx:207 - 300ms guard
const sinceProgrammatic = Date.now() - programmaticChangeRef.current
if (programmaticChangeRef.current && sinceProgrammatic < 300) {
    return // ignore
}
```

The 100ms clear + 200ms poll + 300ms guard creates a complex timing dependency that can fail.

**Fix:** Use a proper command/acknowledgement pattern instead of timeouts.

---

### BUG-005: Drone Note Never Releases on Position Change
**File:** `src/audio/SoundAgent.ts:840-848`
**Severity:** High
**Symptoms:** Drone sound becomes stuck or overlapping when rapidly changing positions

**Root Cause:** `updateDrone` triggers attack once and tracks `droneActive`, but when `setPosition` is called, the traversal is rebuilt and `processTick` runs immediately. The drone is never released between positions - only on `stop()`.

```typescript
// The drone is started once and never explicitly stopped between positions
if (!this.droneActive) {
    voice.node.triggerAttack(d.baseNote, Tone.now() + 0.02, vel)
    this.droneActive = true
}
```

**Fix:** Release and retrigger drone on position change, or use a continuous drone that adjusts parameters without retrigger.

---

## High Severity Bugs

### BUG-006: Volume Slider Step Size Too Coarse
**File:** `src/components/App.tsx:519`
**Severity:** Medium
**Symptoms:** Volume jumps in 10% increments, making fine control impossible

```html
<input type="range" min="0" max="1" step="0.1" ... />
```

**Fix:** Change step to `0.01` for smooth volume control.

---

### BUG-007: WAV Auto-regenerate Has No Debounce
**File:** `src/audio/WavSoundPlayer.tsx:437`
**Severity:** Medium
**Symptoms:** When looping WAV and clicking through moves quickly, multiple overlapping HTTP requests are sent to the Python microservice

**Root Cause:** 100ms setTimeout is not sufficient debounce. Each FEN change triggers a new timeout, and the previous one is only cleared if the component unmounts.

```typescript
timeoutId = setTimeout(async () => {
    await generateAndPlayRef.current();
}, 100);
```

**Fix:** Use proper debounce (300-500ms) and abort previous in-flight requests.

---

### BUG-008: Swing Slider Value Mismatch
**File:** `src/components/App.tsx:143-145, 486-487`
**Severity:** Low
**Symptoms:** Swing display and internal value may drift due to float precision

```typescript
const v = value[0] / 100; // slider 0..100 -> 0..1
// Then displayed as:
Math.round(swing * 100) + '%'
```

For values like 33/100 = 0.33, `Math.round(0.33 * 100)` = 33, which is correct. But for edge cases with slider steps, floating point can cause display of 99% instead of 100%.

**Fix:** Store as integer (0-100) internally, convert to float only when passing to audio engine.

---

### BUG-009: PGNLoader Uses alert() Instead of Toast
**File:** `src/components/PGNLoader.tsx:57`
**Severity:** Low
**Symptoms:** Browser-native alert dialog blocks UI when PGN parsing fails

```typescript
alert('Error parsing PGN. Please check the format.');
```

**Fix:** Use `toast.error()` from react-hot-toast (already a dependency).

---

### BUG-010: ConfigEditor Initial Load Race Condition
**File:** `src/components/ConfigEditor.tsx:130-134`
**Severity:** Medium
**Symptoms:** Config editor may show empty content on first open if schemas have no entries

**Root Cause:** `loadConfigs` is only triggered when `schemas` object has keys, but if no schema files load successfully, configs are never loaded.

```typescript
useEffect(() => {
    if (Object.keys(schemas).length > 0) {
        loadConfigs(); // Never called if no schemas load
    }
}, [schemas, loadConfigs]);
```

**Fix:** Always call `loadConfigs`, with or without schemas. Schema validation is optional.

---

### BUG-011: Traversal Completes But Never Auto-Restarts Cleanly
**File:** `src/audio/SoundAgent.ts:670-675`
**Severity:** Medium
**Symptoms:** After traversal completes one full cycle, there may be a brief silence before restart

**Root Cause:** When traversal returns empty cells, a new traversal is built and `nextTick()` is called again. But the `processTick` return happens after the new traversal's first tick, which means one tick's worth of audio may be scheduled with stale timing.

```typescript
let tick = this.traversal?.nextTick()
if (!tick || tick.cells.length === 0) {
    this.traversal = this.buildTraversal(chess)
    tick = this.traversal?.nextTick()
}
```

**Fix:** Pre-build next traversal before current one completes, or use a ring-buffer approach.

---

### BUG-012: Console Logging Left in Production Code
**Files:** Multiple (PGNViewerWrapper, App, WavSoundPlayer, ToneEngine)
**Severity:** Low
**Symptoms:** Console is flooded with debug messages, affecting performance and readability

**Examples:**
- `PGNViewerWrapper.tsx:55` - "PGNViewer: Parsing PGN:"
- `PGNViewerWrapper.tsx:87` - Logs every applied move
- `App.tsx:322` - "App: Position changed:"
- `SoundAgent.ts:717` - "[SoundAgent] tick" (diagnostic, but always on)

**Fix:** Use the diagnostics.logLevel from config; remove development console.logs or gate behind `import.meta.env.DEV`.

---

## Potential Bugs (Need Verification)

### BUG-013: Capture Detection May Miss En Passant
**File:** `src/audio/SoundAgent.ts:636-654`
**Severity:** Low

Capture detection compares piece count between positions. En passant removes a pawn from a different square than the destination, but since we count total pieces, this should still work. However, promotions (pawn count drops, new piece appears) could give a false "no capture" if a pawn promotes without capturing.

### BUG-014: PGN Parsing Removes Move Numbers Incorrectly
**File:** `src/components/PGNViewerWrapper.tsx:76`

```typescript
const tokens = moveText.replace(/\d+\./g, '').split(/\s+/)
```

This regex removes all digit-dot patterns, which could incorrectly modify move notations like `R1e1` (rook on rank 1 moves to e1). The `1.` would be removed, leaving `Re` which is invalid.

**Fix:** Use `\d+\.(?=\s)` or `\d+\.{1,3}` to only match move numbers (which are always followed by space or `...`).
