# Chessizer - Controls & UX Improvement Plan

**Date:** 2026-02-21
**Focus:** Making controls better, fixing interaction glitches

---

## 1. Current Control Issues

### 1.1 PGN Viewer Synchronization (Critical)

The most impactful UX problem is the fragile connection between clicking moves in the PGN notation panel and hearing the corresponding position audio.

**Current flow:**
```
User clicks move in pgn-viewer widget
  -> pgn-viewer updates its internal board (we can't detect this directly)
  -> 200ms poll checks for CSS class changes or API property changes
  -> Multiple fallback mechanisms try to determine which move was clicked
  -> If detected: position and audio update
  -> If not detected: nothing happens (user perceives as "frozen")
```

**Proposed flow:**
```
User clicks move in pgn-viewer widget
  -> Delegated click handler captures the click
  -> Immediately reads viewer state (no polling needed)
  -> Updates position through direct state update
  -> Audio responds within 1 frame (~16ms)
```

### 1.2 Move Navigation Buttons (High)

**Problem:** Prev/Next buttons use `externalMoveIndex` which is cleared after 100ms timeout. This creates race conditions with the polling mechanism.

**Fix:** Replace the timeout-based clearing with an acknowledgement pattern:
1. Parent sets `externalIndex`
2. PGNViewerWrapper processes it and calls `onPositionChange` with new position
3. Parent detects the new position matches what it requested and clears `externalIndex`

### 1.3 Volume Control (Medium)

**Problem:** Volume slider has 0.1 step size = only 10 distinct levels. Moving from 70% to 80% is a very audible jump.

**Fix:**
- Change step to 0.01 (100 levels)
- Add visual feedback: show dB value alongside percentage
- Add mute toggle button

### 1.4 BPM/Swing/Tick Sliders (Low)

**Problem:** Native `<input type="range">` sliders have poor accessibility and inconsistent styling across browsers.

**Fix:**
- Use the existing shadcn/ui `<Slider>` component (already imported but not used for these controls)
- Add number input alongside slider for precise values
- Add reset-to-default button per parameter

## 2. Proposed UX Improvements

### 2.1 Unified Transport Bar

Replace the scattered controls with a single transport bar:

```
[<<] [<] [ PLAY/STOP ] [>] [>>]  |  Move 15/23  |  [===---] BPM: 120  |  Vol: [====--]  70%
```

Components:
- **First/Prev/Play/Next/Last** - Standard transport controls
- **Position indicator** - Current move / total moves
- **BPM control** - Compact slider + value
- **Volume** - Compact slider + mute button
- **Auto-advance toggle** - Play through game automatically

### 2.2 Game Navigation Timeline

Add a visual timeline below the board:

```
[===o=========]  Move 15/23
 1  5  10  15  20  23
```

- Clickable timeline to jump to any position
- Visual markers for special events (captures, checks, castling)
- Color-coded sections for game phases (opening/middle/endgame)
- Scrub with mouse drag for rapid exploration

### 2.3 Audio Visualization

Add a compact visualization panel showing:
- **Waveform/spectrum analyzer** - Real-time audio output visualization
- **Active voices indicator** - Show which piece types are currently sounding
- **Traversal progress** - Visualize which squares are being scanned
- **Intensity meter** - Show current position intensity (0-100%)

### 2.4 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Stop toggle |
| `Left Arrow` | Previous move |
| `Right Arrow` | Next move |
| `Home` | First move |
| `End` | Last move |
| `+` / `-` | Volume up/down |
| `[` / `]` | BPM down/up |
| `M` | Mute toggle |
| `L` | Loop toggle (WAV engine) |
| `1-6` | Quick preset switch |

**Note:** Currently keyboard shortcuts are disabled to avoid conflicts with pgn-viewer. The fix is to:
1. Only capture keys when focus is not inside the pgn-viewer widget
2. Use a keyboard shortcut manager that respects focus context

### 2.5 Settings Panel Redesign

**Current:** Multiple scattered controls in a single column.

**Proposed:** Tabbed settings panel:

```
[Tone.js] [WAV Engine] [Traversal] [Display]

Tab: Tone.js
  Transport:   BPM [===] 120   Swing [===] 30%
  Timing:      Tick [===] 1.0s
  Volume:      Master [===] 70%  [Mute]
  [Reset Defaults]

Tab: WAV Engine
  Server:      http://localhost:8001 [Test Connection]
  Quality:     [Draft] [Normal] [High]
  Playback:    Speed [===] 1.0x  [Loop]
  [Play WAV]

Tab: Traversal
  Strategy:    [ringsFromKing v]
  Parameters:  cellsPerTick [===] 64
  [Apply]  [Preview] (preview shows traversal pattern on board)

Tab: Display
  Board Size:  [Small] [Medium] [Large]
  Theme:       [Brown] [Blue] [Green]
  Pieces:      [Merida] [Alpha] [Leipzig]
```

## 3. PGN Viewer Integration Overhaul

### 3.1 Problem Analysis

The `@mliebelt/pgn-viewer` library is designed as a standalone widget, not as a controlled React component. The current integration uses:

1. `pgnView()` to create the widget (imperative API)
2. DOM event delegation to detect user clicks
3. 200ms polling to detect state changes
4. Programmatic `.click()` calls to set position
5. Multiple CSS class fallbacks to find current move

This is inherently fragile because we're fighting the library's design.

### 3.2 Options

#### Option A: Improve Current Integration (Low Effort)
- Remove polling; rely solely on delegated click handler + MutationObserver
- Use MutationObserver to watch for class changes on move elements
- Replace programmatic `.click()` with viewer's own navigation API

#### Option B: Build Custom PGN Move List (Medium Effort)
- Keep pgn-viewer only for the **board** rendering
- Build our own move list component that:
  - Renders moves from our `gameData` array
  - Handles click directly (no DOM guessing needed)
  - Highlights current move with our own state
  - Synchronizes with board via pgn-viewer's `onMove` callback

#### Option C: Replace pgn-viewer Entirely (High Effort)
- Use `chess.js` for game logic (already present)
- Use `chessground` for board rendering (already a dependency, currently unused!)
- Build custom move list component
- Full control over all interactions

**Recommendation:** Option B provides the best effort/reward ratio. We already parse the PGN ourselves - we just need to render our own clickable move list.

### 3.3 Custom Move List Component Design

```tsx
interface MoveListProps {
  moves: { san: string; fen: string }[];
  currentIndex: number;
  onMoveClick: (index: number) => void;
}

// Renders moves in standard chess notation format:
// 1. e4 e5  2. Nf3 Nc6  3. Bb5 a6
// With the current move highlighted and auto-scrolled into view
```

This eliminates:
- 200ms polling
- CSS class guessing
- DOM fallback mechanisms
- Programmatic click simulation
- The `programmaticChangeRef` timing guard

## 4. Responsive Design

### Current State
- Fixed 3-column grid layout
- Board size fixed at 400px
- Controls overflow on narrow screens

### Improvements
- **Mobile:** Single column, board on top, collapsible controls below
- **Tablet:** 2 columns, board + controls
- **Desktop:** Current 3-column layout with flexible sizing
- **Board auto-sizing:** Fill available width up to maximum

```
Breakpoints:
  < 768px:  Stack layout, compact controls
  768-1024: 2-column, medium board
  > 1024:   3-column, large board
```

## 5. Accessibility Improvements

### 5.1 Screen Reader Support
- Add `aria-live` region for position changes
- Announce move in algebraic notation when navigating
- Announce audio state changes (playing, stopped)
- Add `role="application"` to board area

### 5.2 Keyboard Navigation
- Ensure all controls are keyboard-accessible
- Add visible focus indicators
- Support Tab navigation through control groups
- Add skip links to jump between sections

### 5.3 High Contrast Mode
- Add high contrast theme option
- Ensure all text meets WCAG AA contrast ratios
- Use distinct patterns (not just color) for status indicators

## 6. Implementation Roadmap

### Phase 1: Critical Fixes (3-5 days)
1. Fix Prev/Next race condition (acknowledgement pattern)
2. Fix volume slider step size
3. Add keyboard shortcuts (with focus context)
4. Replace native sliders with shadcn/ui Slider

### Phase 2: Navigation Overhaul (1 week)
5. Build custom MoveList component
6. Implement timeline scrubber
7. Add auto-advance playback
8. Add game phase detection visual

### Phase 3: UX Polish (1 week)
9. Implement tabbed settings panel
10. Add audio visualization
11. Responsive layout implementation
12. Accessibility improvements

### Phase 4: Advanced Features (2 weeks)
13. Board-aware panning (mouse position -> audio parameter)
14. Preset quick-switch system
15. Move annotation markers on timeline
16. Export/share game sonification settings
