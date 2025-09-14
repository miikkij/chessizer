# WAV Sound Player Specifications

## Overview

The WAV Sound Player generates layered soundscapes as stereo WAV files from chess positions. It accepts FEN (Forsyth-Edwards Notation) chess positions and JSON sound configurations to render 5 distinct audio layers that represent different aspects of the chess position.

## Audio Architecture

### Layer System
The sound engine renders 5 simultaneous layers:

1. **Groove Layer**: Rhythmic foundation using Euclidean rhythms
2. **Pulse Grid Layer**: Piece-specific earcons representing individual chess pieces
3. **Halo Field Layer**: Spatial audio representing board control and threats
4. **Event Cues Layer**: Transient sounds for captures, checks, and special moves
5. **Ambient Bed Layer**: Harmonic backdrop representing material balance

## Configuration Format

### Root Configuration Object

```typescript
interface WavConfig {
    version: string;           // Configuration schema version
    name: string;             // Human-readable configuration name
    audio: AudioConfig;       // Core audio settings
    limits: LimitsConfig;     // Performance and voice limits
    groove: GrooveConfig;     // Rhythmic foundation layer
    pulseGrid: PulseGridConfig; // Piece representation layer
    halo: HaloConfig;         // Spatial field layer
    events: EventsConfig;     // Transient event layer
    ambient: AmbientConfig;   // Harmonic background layer
    traversal: TraversalConfig; // Board scanning strategy
    changeRules: ChangeRulesConfig; // Dynamic response rules
    diagnostics: DiagnosticsConfig; // Debug and analysis options
}
```

## Layer-by-Layer Specifications

### 1. Audio Configuration (`AudioConfig`)

Core audio rendering parameters that apply globally.

```typescript
interface AudioConfig {
    sampleRate: number;    // Sample rate in Hz (typically 44100 or 48000)
    bitDepth: number;      // Bit depth (16, 24, or 32)
    channels: number;      // Number of channels (1 = mono, 2 = stereo)
    lengthMs: number;      // Total duration of generated audio in milliseconds
    headroomDb: number;    // Headroom in dB to prevent clipping (typically 3-6 dB)
}
```

**Purpose**: Defines the technical audio format and prevents digital clipping by reserving headroom.

### 2. Performance Limits (`LimitsConfig`)

Controls computational complexity and audio density.

```typescript
interface LimitsConfig {
    maxConcurrentVoices: number;  // Maximum simultaneous audio voices
    onsetOffsetMs: number[];      // [min, max] timing variation in milliseconds
}
```

**Purpose**: 
- `maxConcurrentVoices`: Prevents CPU overload by limiting polyphony
- `onsetOffsetMs`: Adds natural timing variation to avoid mechanical feeling

### 3. Groove Layer (`GrooveConfig`)

Provides rhythmic foundation using Euclidean rhythm algorithms.

```typescript
interface GrooveConfig {
    tempoBpm: number;                    // Tempo in beats per minute
    bars: number;                        // Number of bars to generate
    kit: Record<string, KitVoice>;       // Drum kit voice definitions
    tracks: GrooveTrack[];               // Rhythmic pattern tracks
}

interface KitVoice {
    type: "sineClick" | "noiseSnap" | "noiseTick";  // Synthesis type
    toneHz: number;      // Fundamental frequency in Hz
    decayMs: number;     // Decay time in milliseconds
    pan: number;         // Stereo position (-1 = left, 0 = center, +1 = right)
    gainDb: number;      // Volume in decibels (negative values)
}

interface GrooveTrack {
    voice: string;       // References a kit voice by name
    steps: number;       // Total steps in the pattern (typically 16)
    pulses: number;      // Number of active pulses in the pattern
    rotate: number;      // Pattern rotation offset
}
```

**Purpose**: 
- Creates rhythmic context that varies with game tempo and intensity
- Uses Euclidean rhythms for mathematically interesting, non-repetitive patterns
- Different kit voices represent different aspects of board activity

**Euclidean Rhythm Algorithm**: Distributes `pulses` evenly across `steps`, creating natural-feeling rhythms used in world music.

### 4. Pulse Grid Layer (`PulseGridConfig`)

Represents individual chess pieces as distinct audio signatures.

```typescript
interface PulseGridConfig {
    earcons: Record<string, Earcon>;     // Piece-specific sound signatures
    register: Record<string, string>;   // Base pitch per side ("C3", "C5", etc.)
    pan: Record<string, number>;        // Stereo positioning per side
    gainDb: Record<string, number>;     // Volume per side in dB
}

interface Earcon {
    osc: "sine" | "triangle" | "square" | "saw";  // Oscillator waveform
    env: Envelope;                                // Amplitude envelope
    durMs: number;                               // Total duration in milliseconds
    pattern?: PatternStep[];                     // Sequential note pattern
    chord?: number[];                            // Simultaneous notes (semitones)
    arp?: number[];                              // Arpeggiated notes (semitones)
    dyad?: number[];                             // Two-note harmony (semitones)
    stepMs?: number;                             // Arpeggio step timing
}

interface Envelope {
    a: number;    // Attack time in milliseconds
    d: number;    // Decay time in milliseconds
    s: number;    // Sustain level (0.0 to 1.0)
    r: number;    // Release time in milliseconds
}

interface PatternStep {
    t: number;        // Time offset in milliseconds
    semitone: number; // Pitch offset in semitones
    durMs: number;    // Duration of this step
}
```

**Purpose**:
- Each piece type has a unique audio signature for instant recognition
- White and black pieces are pitched in different registers for side identification
- Stereo panning separates sides spatially

**Piece Mapping Strategy**:
- **Pawn**: Simple two-note pattern (basic unit)
- **Knight**: Three-note pattern reflecting L-shaped movement
- **Bishop**: Two-note glide representing diagonal movement
- **Rook**: Power chord representing straight-line strength
- **Queen**: Arpeggiated chord showing versatility
- **King**: Dyad (two-note harmony) representing importance

### 5. Halo Field Layer (`HaloConfig`)

Creates spatial audio field representing board control and threats.

```typescript
interface HaloConfig {
    mode: "threat" | "control" | "mobility";    // Analysis mode
    kernel: number[][];                         // Convolution kernel for spatial blur
    brightnessHz: { min: number; max: number }; // Frequency range for intensity
    width: { min: number; max: number };        // Stereo width range
}
```

**Purpose**:
- Visualizes abstract chess concepts through spatial audio
- `kernel`: 3x3 matrix for blurring piece influence across squares
- `brightnessHz`: Maps board activity to spectral brightness
- `width`: Varies stereo field based on position complexity

**Analysis Modes**:
- **threat**: Emphasizes attacking relationships
- **control**: Shows square control patterns
- **mobility**: Represents piece movement options

### 6. Event Cues Layer (`EventsConfig`)

Handles transient sounds for significant game events.

```typescript
interface EventsConfig {
    capture: EventCue;   // Sound for piece captures
    check: EventCue;     // Sound for check conditions
}

interface EventCue {
    type: "click" | "glide";                    // Sound synthesis type
    durMs?: number;                             // Duration in milliseconds
    leadMs?: number;                            // Pre-emphasis timing
    gainDb?: number;                            // Volume in dB
    panBySide?: Record<string, number>;         // Side-specific panning
    fromHzWhite?: number;                       // Glide start frequency (white)
    toHzWhite?: number;                         // Glide end frequency (white)  
    fromHzBlack?: number;                       // Glide start frequency (black)
    toHzBlack?: number;                         // Glide end frequency (black)
}
```

**Purpose**:
- Provides immediate audio feedback for important game events
- Different sounds for white vs. black actions
- `leadMs`: Anticipatory timing for rhythmic placement

### 7. Ambient Layer (`AmbientConfig`)

Creates harmonic backdrop representing overall game state.

```typescript
interface AmbientConfig {
    mode: "triad" | "drone" | "field";                    // Harmonic mode
    root: string;                                          // Root note (e.g., "C2")
    qualityByMaterial: Record<string, "major" | "minor">; // Chord quality per side
    brightnessHz: Record<string, number>;                  // Spectral brightness per side
    gainDb: number;                                        // Overall volume in dB
}
```

**Purpose**:
- Reflects material balance through chord quality (major = advantage, minor = disadvantage)
- Provides tonal context for the entire position
- `brightnessHz`: Adds spectral character based on position type

### 8. Traversal Strategy (`TraversalConfig`)

Defines how the engine scans the board to trigger piece sounds.

```typescript
interface TraversalConfig {
    strategy: "spiralFromCenter" | "leftToRight" | "kingDistance"; // Scanning pattern
    params: Record<string, any>;                                   // Strategy parameters
    tickDurationMs: number;                                        // Time per square visit
}
```

**Strategy Types**:
- **spiralFromCenter**: Starts from center squares, spirals outward
- **leftToRight**: Traditional left-to-right, top-to-bottom scanning
- **kingDistance**: Prioritizes squares by distance from kings

**Purpose**: Different traversal patterns create different rhythmic feels and can emphasize different aspects of the position.

### 9. Change Rules (`ChangeRulesConfig`)

Dynamic response system for position changes.

```typescript
interface ChangeRulesConfig {
    onMaterialSwing: { points: number; action: string };
    onCheck: { action: string; amount: number };
    onCapture: { action: string };
    onQuiet: { action: string; amount: number };
}
```

**Trigger Types**:
- **onMaterialSwing**: Material advantage changes by threshold
- **onCheck**: King is in check
- **onCapture**: Piece is captured
- **onQuiet**: No captures or checks (positional play)

**Action Types**:
- **addHatFill**: Increases hi-hat density
- **raiseBrightness**: Increases spectral content
- **kickFill**: Adds extra kick drum hits
- **reduceHalo**: Decreases spatial field intensity

### 10. Diagnostics (`DiagnosticsConfig`)

Development and debugging options.

```typescript
interface DiagnosticsConfig {
    writeStemWavs: boolean;    // Export individual layer WAV files
    logSchedule: boolean;      // Log timing and synthesis events
}
```

**Purpose**:
- `writeStemWavs`: Allows analysis of individual layers
- `logSchedule`: Helps debug timing and synthesis issues

## Request/Response Protocol

### Generate Request

```typescript
interface GenerateRequest {
    fen: string;                    // Chess position in FEN notation
    config: WavSoundConfig;         // Complete configuration object
    previousFen?: string;           // Optional previous position for change detection
}
```

### Response

- **Success**: Binary WAV file with appropriate HTTP headers
- **Error**: JSON object with detailed validation errors

## Audio Processing Pipeline

1. **FEN Parsing**: Convert chess position to internal board representation
2. **Analysis Phase**: Calculate threats, mobility, material balance
3. **Layer Generation**: 
   - Generate groove patterns using Euclidean rhythms
   - Create earcon sequences based on piece positions
   - Compute halo field using convolution
   - Identify events (captures, checks)
   - Generate ambient harmonic content
4. **Synthesis**: Render each layer to audio buffers
5. **Mixing**: Combine layers with spatial positioning and dynamics
6. **Mastering**: Apply limiting and format conversion
7. **Export**: Generate final stereo WAV file

## Performance Considerations

- **Voice Limiting**: `maxConcurrentVoices` prevents CPU overload
- **Chunk Processing**: Large positions processed in time slices
- **Memory Management**: Efficient buffer allocation for real-time performance
- **Caching**: Earcon synthesis results cached for repeated pieces

## Use Cases

1. **Chess Training**: Audio feedback for position evaluation
2. **Accessibility**: Non-visual chess analysis for visually impaired players
3. **Composition**: Algorithmic music generation from chess games
4. **Research**: Sonification of strategic concepts
5. **Entertainment**: Novel way to experience famous chess games

## Extension Points

- **Custom Earcons**: Define new piece sound signatures
- **Analysis Modes**: Add new halo field algorithms
- **Synthesis Types**: Implement additional oscillator types
- **Export Formats**: Support for other audio formats beyond WAV

This specification provides a complete framework for chess-to-audio conversion with extensive customization options for different musical and analytical purposes.