> **Historical archive.** Archived analysis dated 2026-02-21. Findings, counts, source paths and proposed fixes below describe that snapshot and have not been revalidated as current issues. See the [current project documentation](../../../README.md).

# Chessizer - Audio System Deep-Dive & Improvement Plan

**Date:** 2026-02-21
**Focus:** Making the chess game sound better

---

## 1. Current Audio Architecture

### Tone.js Real-time Engine (SoundAgent.ts)

```
Position (FEN)
  |
  v
Chess.js Parse --> Board Snapshot
  |
  v
Traversal Strategy --> Cell ordering (which squares to sonify first)
  |
  v
Piece Selection --> Priority by type (king > queen > rook > ...)
  |
  v
Intensity Scaling --> Dynamic voice count based on position complexity
  |
  v
Earcon Scheduling --> Tone.js triggerAttackRelease with jitter
  |
  v
Per-Voice Chain: Synth -> [PitchShift] -> [Filter] -> [Panner] -> MasterGain -> Limiter -> Output
  |
  v
Drone Layer --> Continuous note with brightness mapped to material balance
```

### Python WAV Generator (soundAgentsv2/)

```
FEN + Config --> FastAPI endpoint
  |
  v
5-Layer Composition:
  1. Groove (Euclidean drum patterns)
  2. Pulse Grid (piece earcons with spatial panning)
  3. Halo Field (influence/threat visualization)
  4. Event Cues (check/capture effects)
  5. Ambient Bed (harmonic background)
  |
  v
NumPy DSP --> Stereo WAV file --> HTTP Response --> Browser playback
```

## 2. Identified Audio Glitches

### Glitch 1: Audio Stuttering on Position Change
**Cause:** Creating 3-4 new Chess instances per tick.
**Impact:** GC pressure causes Web Audio scheduling jitter (10-50ms).
**Solution:** Cache Chess instance; pre-compute per-position data.

### Glitch 2: Voice Overlap / Cacophony
**Cause:** No proper voice stealing. When maxConcurrentVoices is reached, sounds are simply not scheduled, but previously scheduled sounds continue playing.
**Impact:** Multiple ticks' worth of sound can overlap, creating mud.
**Solution:** Implement voice stealing with proper release times. Track active voices and release oldest when limit reached.

### Glitch 3: Drone Buildup
**Cause:** Drone note is triggered once and never released between positions.
**Impact:** When switching games or making many rapid moves, drone energy accumulates.
**Solution:** Add crossfade between drone states on position change.

### Glitch 4: Click/Pop on Start/Stop
**Cause:** `agent.start()` schedules transport immediately; `agent.stop()` calls `releaseAll()` abruptly.
**Impact:** Audible clicks at play/stop transitions.
**Solution:** Add 50ms fade-in on start, 100ms fade-out on stop via masterGain ramp.

### Glitch 5: Timing Drift in Long Sessions
**Cause:** `scheduleRepeat` uses Tone.Transport which is generally stable, but the callback creates a new Chess instance each time, introducing variable latency.
**Impact:** Over 5+ minutes, audio events drift from expected timing.
**Solution:** Pre-compute position data outside the audio callback. Keep callbacks lightweight.

## 3. Sound Quality Improvements

### 3.1 Better Earcon Design

**Current State:** Each piece has 1-4 note patterns using basic synthesis.

**Improvements:**

#### A. Richer Timbres
- **Pawns:** Add subtle noise burst at onset for "footstep" quality
- **Knights:** Use FM synthesis with modulation index sweep for "jumping" quality
- **Bishops:** Add slight portamento between pattern notes for "sliding" quality
- **Rooks:** Layer a sub-octave for "weight" and power
- **Queen:** Add vibrato (LFO on pitch) for "singing" quality
- **King:** Add tremolo (LFO on amplitude) for "regal wobble"

#### B. Positional Audio Mapping
Currently only white/black panning is implemented. Add:
- **File-based panning:** a-file = hard left, h-file = hard right (maps board spatially)
- **Rank-based pitch:** Higher ranks = higher pitch offset (spatial height)
- **Center vs edge:** Center pieces slightly louder (more prominent)

#### C. Dynamic Envelope Shaping
- Opening positions: Longer attack, sustained sounds (calm)
- Middlegame: Shorter attack, more percussive (tension)
- Endgame: Sparse, reverberant (space)
- Detect phase by piece count: 28+ = opening, 20-28 = middle, <20 = endgame

### 3.2 Better Event Sounds

**Current Check Sound:** Two-note glide (tension)
**Improvement:** Add a rising alarm-like sweep with increasing LFO rate. Different sounds for discovered check vs direct check vs double check.

**Current Capture Sound:** Single percussive click
**Improvement:**
- Piece-specific capture sounds (capturing a queen should sound different from capturing a pawn)
- Volume scaled by captured piece value
- Brief "crunch" noise burst for emphasis

**Current Checkmate Sound:** Multi-note sequence
**Improvement:** Add reverb tail, decrease tempo, add final chord resolution. Consider a brief moment of silence before the checkmate sound for dramatic effect.

### 3.3 Better Traversal Sonification

**Current:** All traversal strategies produce similar sonic results because they differ only in square ordering.

**Improvements:**

#### Temporal Spreading
Instead of scheduling all cells in a tick simultaneously (with random jitter), spread them across the tick duration:
```
tick duration = 1000ms, 8 cells
cell 0: t+0ms, cell 1: t+125ms, ..., cell 7: t+875ms
```
This creates rhythmic "sweeping" patterns that make traversal strategy audible.

#### Velocity Curves
Apply distance-based velocity curves:
- **ringsFromKing:** Pieces close to king are louder, distant pieces softer
- **spiralFromCenter:** Center pieces louder, edge pieces softer
- **rowSequential:** Slight crescendo within each row

### 3.4 Harmonic Intelligence

**Current:** Pieces play fixed patterns regardless of musical context.

**Improvements:**

#### A. Key Detection
Analyze the current set of active notes and choose a compatible key/scale. Quantize earcon pitches to this scale to avoid dissonance.

#### B. Chord Progression
Map position evaluation (material balance, king safety) to chord quality:
- Equal position: Major 7th (warm)
- Slight advantage: Dominant 7th (tension)
- Large advantage: Augmented (unstable, exciting)
- Disadvantage: Minor 7th (somber)

#### C. Rhythmic Variation
Use position complexity to vary rhythmic density:
- Quiet positions: Half-note and quarter-note patterns
- Tactical positions: Eighth and sixteenth-note patterns
- Add swing based on material imbalance (more swing = more dynamic position)

### 3.5 Master Bus Processing

**Current:** Gain -> Limiter -> Output

**Improvements:**
```
MasterGain
  -> Compressor (threshold: -18dB, ratio: 3:1, knee: 6dB)
  -> EQ3 (low: +2dB warmth, mid: 0dB, high: -1dB smooth)
  -> Reverb (room: 0.3, wet: 0.15 for spatial depth)
  -> Limiter (threshold: -3dB, release: 50ms)
  -> Output
```

Add a sidechain-style ducking: when event sounds (check, capture) play, duck the piece earcons by 3-6dB briefly. This creates clarity and punch.

## 4. Controls Improvement Plan

### 4.1 Real-time Parameter Control

Add MIDI-style continuous control for:
- **Filter cutoff sweep:** Map to mouse X position when hovering over board
- **Reverb wet/dry:** Map to position complexity
- **Tempo:** Auto-adjust based on game phase
- **Stereo width:** Narrow in endgame, wide in middlegame

### 4.2 Transport Controls Enhancement

**Current:** Play/Stop only.

**Add:**
- **Auto-advance:** Play through entire game with configurable pause per move
- **Speed control:** 0.25x to 4x playback speed for game traversal
- **Loop section:** Loop a range of moves for focused listening
- **A/B comparison:** Switch between two positions to hear the difference

### 4.3 Preset System

**Current:** Single JSON config that must be edited manually.

**Add:**
- Named presets with descriptions (Ambient, Percussive, Minimal, Orchestral)
- Quick-switch buttons in UI
- Import/export as shareable links
- "Randomize" button for exploration

## 5. Implementation Priority

### Phase 1: Fix Glitches (Week 1)
1. Cache Chess instance in SoundAgent
2. Fix audio node leak on config change
3. Add start/stop fade in/out
4. Fix drone release on position change
5. Implement proper voice stealing

### Phase 2: Sound Quality (Week 2-3)
6. Add file-based spatial panning
7. Improve earcon timbres (FM synthesis, noise layers)
8. Add game-phase detection for envelope shaping
9. Improve event sounds (piece-specific captures)
10. Add master bus processing chain

### Phase 3: Musical Intelligence (Week 4-5)
11. Add temporal spreading to traversal
12. Implement velocity curves per traversal strategy
13. Add basic key/scale quantization
14. Add chord progression mapping

### Phase 4: Controls (Week 6)
15. Auto-advance playback
16. Preset system with quick-switch
17. Speed control for game traversal
18. Loop section feature

## 6. WAV Generator Improvements

### Current Issues
- 1-3 second generation latency
- No streaming (full WAV loaded in memory)
- Limited to pre-defined groove patterns

### Improvements
1. **WebSocket streaming:** Stream audio chunks as they're generated
2. **Worker-based generation:** Move NumPy processing to background worker
3. **Caching:** Cache generated WAVs by FEN hash for instant replay
4. **Quality presets:** Quick/Draft (22kHz, 2s) vs Full (48kHz, 4s)
5. **MIDI export:** Allow exporting position sonification as MIDI file
