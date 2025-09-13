# soundAGENTS.md

Configuration system and traversal control for chess board sonification with Tone.js

Status
Stable draft for implementation

Author
Valto assistant

Date
2025 09 13

---

## 1 Purpose and scope

This document defines a configuration system and an execution model that let you render any chess position as a short and information rich sound scene using Tone.js. It covers a complete JSON schema, traversal programming, event cue design, voice limits, and reference code. The target is fast and accurate recognition of side strength and threats using audio only.

## 2 System overview

A Sound Agent is a small engine that reads JSON and renders a two to five second clip from a board state. The agent has five parts.

* Transport control manages tempo and timing
* Traversal program generates a time ordered list of cells or rings
* Mapping engine turns pieces and events into earcons and icons
* Voice graph builds Tone.js instruments and effect chains
* Scheduler places events on the transport with micro offsets

The agent receives

* A chess state expressed as FEN or a typed structure
* A SoundAgentConfig JSON document
* Optional seed for any pseudo random traversal

The agent produces

* Audio to the destination
* Logs and metrics for later analysis

## 3 Data model and JSON configuration

The configuration is one JSON object with nested sections. All keys are lowerCamelCase. Times are in milliseconds unless a Tone time string is used. Frequencies are in hertz or in musical pitch names. Gains are in decibels. Angles use degrees.

### 3.1 Top level schema

```json
{
  "version": "1.0",
  "name": "hybridEarconsRowScan",
  "transport": { },
  "limits": { },
  "voices": { },
  "mappings": { },
  "colors": { },
  "traversal": { },
  "events": { },
  "scaling": { },
  "diagnostics": { }
}
```

### 3.2 Transport

Controls Tone.Transport and global clocking.

```json
{
  "transport": {
    "bpm": 120,
    "swing": 0.0,
    "timeSignature": [4, 4],
    "latencyHint": "interactive",
    "quantize": "16n",
    "startOffset": "0:0:0"
  }
}
```

Notes

* A single global transport exists in Tone.js and schedules events with sample accurate times in callbacks. Use it for all scans. citeturn0search0
* Audio starts after a user gesture with `Tone.start()` or `Tone.start` depending on version. Call it from a click or keypress handler before any playback. citeturn0search1turn0search8turn0search17

### 3.3 Limits and selection policy

```json
{
  "limits": {
    "maxConcurrentVoices": 4,
    "onsetOffsetMs": [20, 50],
    "hardHeadroomDb": 6,
    "clipLengthMs": 2200,
    "voicePriority": ["king", "queen", "checking", "capturing", "rook", "bishop", "knight", "pawn"]
  }
}
```

### 3.4 Voices and node graphs

Define instruments and effect chains. Each voice has a Tone graph and optional defaults.

```json
{
  "voices": {
    "synthPawn": {
      "type": "PolySynth",
      "voice": "Synth",
      "options": {
        "maxPolyphony": 8,
        "envelope": {"attack": 0.01, "decay": 0.08, "sustain": 0.2, "release": 0.1},
        "oscillator": {"type": "triangle"}
      },
      "chain": [
        {"node": "Filter", "options": {"type": "lowpass", "frequency": 3800, "Q": 1.0}},
        {"node": "Panner", "options": {"pan": 0}},
        {"node": "Limiter", "options": {"threshold": -2}}
      ],
      "toDestination": true,
      "volumeDb": -6
    },
    "synthKnight": { "type": "PolySynth", "voice": "Synth", "options": {}, "chain": [], "toDestination": true },
    "samplerIcons": {
      "type": "Sampler",
      "options": {
        "urls": {
          "C5": "sounds/click_hi.wav",
          "C3": "sounds/click_lo.wav"
        },
        "attack": 0.001,
        "release": 0.05
      },
      "chain": [{"node": "Panner", "options": {"pan": 0}}],
      "toDestination": true
    },
    "synthGlide": { "type": "Synth", "options": {"portamento": 0.02}, "chain": [{"node": "Panner", "options": {"pan": 0}}], "toDestination": true },
    "droneBed": {
      "type": "Synth",
      "options": {"oscillator": {"type": "sawtooth"}, "envelope": {"attack": 0.2, "decay": 0.3, "sustain": 0.1, "release": 0.5}},
      "chain": [{"node": "Filter", "options": {"type": "lowpass", "frequency": 600}}],
      "toDestination": true,
      "volumeDb": -18
    }
  }
}
```

Notes

* Use PolySynth for note clusters and fast allocation. It manages a pool of monophonic voices. citeturn0search5turn0search12
* Use Sampler or Player for icons and captured audio files. Sampler maps pitches to urls and repitches across notes. Player handles single file playback. citeturn0search13turn0search11
* Use Panner or Panner3D to set lateral or three dimensional positions that separate sides. citeturn0search3turn0search15

### 3.5 Mappings for piece types

Mappings define how a piece class yields an earcon pattern. Each pattern is a list of steps with relative times inside the tick.

```json
{
  "mappings": {
    "pieceEarcons": {
      "pawn": {
        "voiceId": "synthPawn",
        "register": {"white": "C5", "black": "C3"},
        "pattern": [
          {"t": 0, "n": "+0", "d": 120, "v": 0.8},
          {"t": 140, "n": "+2", "d": 100, "v": 0.8}
        ]
      },
      "knight": {
        "voiceId": "synthKnight",
        "register": {"white": "A4", "black": "A3"},
        "pattern": [
          {"t": 0, "n": "+0", "d": 80, "v": 0.85},
          {"t": 110, "n": "+3", "d": 90, "v": 0.85},
          {"t": 220, "n": "-1", "d": 90, "v": 0.85}
        ]
      },
      "bishop": { "voiceId": "synthKnight", "register": {"white": "E5", "black": "E3"}, "pattern": [{"t": 0, "n": "+0", "d": 160, "v": 0.8}, {"t": 170, "n": "+2", "d": 140, "v": 0.8}] },
      "rook":   { "voiceId": "synthKnight", "register": {"white": "G4", "black": "G3"}, "pattern": [{"t": 0, "chord": ["+0", "+7", "+12"], "d": 120, "v": 0.9}] },
      "queen":  { "voiceId": "synthKnight", "register": {"white": "C6", "black": "C4"}, "pattern": [{"t": 0, "arpeggio": ["+0", "+4", "+7", "+12"], "stepMs": 40, "d": 220, "v": 0.9}] },
      "king":   { "voiceId": "synthKnight", "register": {"white": "C4", "black": "C2"}, "pattern": [{"t": 0, "dyad": ["+0", "+7"], "d": 180, "v": 0.8}] }
    }
  }
}
```

Rules

* `n` values with + or minus are semitone offsets relative to register
* Use either `n` or `chord` or `arpeggio` or `dyad` per step
* `t` is time from the start of the tick in milliseconds
* `v` is linear gain in the range zero to one
* Optional `pan` per step overrides color pan

### 3.6 Color separation rules

```json
{
  "colors": {
    "white": {"pan": -0.3, "pitchShift": 0, "filterTint": {"frequency": 3800}},
    "black": {"pan": 0.3, "pitchShift": -12, "filterTint": {"frequency": 2600}}
  }
}
```

### 3.7 Traversal programs

Traversal describes the order in which cells or rings are rendered and defines tick duration and concurrency. The engine will schedule piece patterns for the cells in the current tick. Built in strategies are `rowSequential`, `columnSequential`, `spiralFromCenter`, `ringsFromKing`, `knightTour`, `randomSeeded`, and `customList`.

```json
{
  "traversal": {
    "strategy": "rowSequential",
    "params": {
      "startRank": 8,
      "fileOrder": "aToH",
      "rowsOrder": "8to1"
    },
    "tickDurationMs": 250,
    "concurrency": {
      "maxVoices": 4,
      "onsetOffsetMs": [20, 50]
    }
  }
}
```

Example for center outward rings

```json
{
  "traversal": {
    "strategy": "spiralFromCenter",
    "params": {"center": ["d4", "e4", "d5", "e5"], "spiral": "cw"},
    "tickDurationMs": 300,
    "concurrency": {"maxVoices": 3, "onsetOffsetMs": [25, 45]}
  }
}
```

You can also pass a custom explicit visiting order

```json
{
  "traversal": {
    "strategy": "customList",
    "params": {"order": ["e4", "d4", "f4", "c4", "g4", "b4", "h4", "a4", "e5", "d5"]},
    "tickDurationMs": 250
  }
}
```

### 3.8 Event cues

Short high priority signals for captures, checks, and mate. Cues can be layered with earcons and have side specific settings.

```json
{
  "events": {
    "capture": {
      "voiceId": "samplerIcons",
      "white": {"note": "C5", "levelDb": 6, "pan": -0.3, "leadMs": 30},
      "black": {"note": "C3", "levelDb": 6, "pan": 0.3, "leadMs": 30},
      "durationMs": 90
    },
    "check": {
      "voiceId": "synthGlide",
      "white": {"glide": {"from": "B5", "to": "D6", "durationMs": 200}, "pan": -0.3},
      "black": {"glide": {"from": "D4", "to": "B3", "durationMs": 200}, "pan": 0.3}
    },
    "checkmate": {
      "sequence": [
        {"voiceId": "samplerIcons", "note": "C6", "t": 0, "d": 120, "levelDb": 6},
        {"voiceId": "droneBed", "note": "C3", "t": 220, "d": 800, "levelDb": -6}
      ]
    }
  }
}
```

### 3.9 Continuous scaling layer

Set a low level drone whose brightness encodes material and center control.

```json
{
  "scaling": {
    "drone": {
      "voiceId": "droneBed",
      "baseNote": "C2",
      "brightnessByMaterial": {"slopeCentroidHzPerPoint": 80, "minHz": 400, "maxHz": 2000},
      "levelDb": -18
    }
  }
}
```

### 3.10 Diagnostics

```json
{
  "diagnostics": {
    "logLevel": "info",
    "emitScheduleLog": true,
    "exportMetrics": true
  }
}
```

## 4 Traversal specification

The engine exposes a common interface

```ts
export interface TraversalProgram {
  name: string
  init(params: Record<string, unknown>): void
  nextTick(): {
    startTime: number
    cells: string[]
    done: boolean
  }
  reset(): void
}
```

Built in programs

* rowSequential
  * Ranks in order with files either a to h or h to a
  * Eight ticks per board
* columnSequential
  * Files in order with ranks either one to eight or eight to one
* spiralFromCenter
  * Start from the four center squares and expand in a clockwise or counterclockwise spiral
* ringsFromKing
  * Breadth first from the king square in chessboard metric
* knightTour
  * Deterministic knight tour from a start square
* randomSeeded
  * Seeded pseudo random visit
* customList
  * Exact order provided by the config

Each `nextTick` returns the cells for a tick. The scheduler staggers onsets inside the tick using a uniform random within the configured onset offset range to improve stream segregation. The transport tick duration defines clip length.

## 5 Tone.js usage model

This section shows how the engine maps JSON to Tone.js. Use the global transport for all timing. Tone.Transport schedules events and provides exact event times to callbacks. Pass the provided time to the instrument trigger for sample accurate playback. citeturn0search0

Call `Tone.start` once on a user gesture before playback. citeturn0search1turn0search8

Choose building blocks

* PolySynth for note clusters and parallel earcons. citeturn0search5turn0search12
* Sampler or Player for icons and special cues. citeturn0search13turn0search11
* Panner or Panner3D for lateral or three dimensional placement. citeturn0search3turn0search15
* Sequence or Part for compact timing of multi step earcons if you prefer pattern objects instead of direct scheduling of each step. citeturn0search10
* Any source can be synced to the transport start and stop. citeturn0search20

### 5.1 Build the voice graph

```ts
import * as Tone from "tone"

type VoiceSpec = {
  type: "Synth" | "PolySynth" | "Sampler" | "Player"
  voice?: "Synth" | "AMSynth" | "FMSynth"
  options?: any
  chain?: { node: string; options?: any }[]
  toDestination?: boolean
  volumeDb?: number
}

function buildVoice(spec: VoiceSpec): Tone.ToneAudioNode {
  let node: any
  if (spec.type === "PolySynth") {
    const VoiceCtor = (Tone as any)[spec.voice || "Synth"]
    node = new Tone.PolySynth(VoiceCtor, spec.options || {})
  } else if (spec.type === "Sampler") {
    node = new Tone.Sampler(spec.options || {})
  } else if (spec.type === "Player") {
    node = new Tone.Player(spec.options || {})
  } else {
    const VoiceCtor = (Tone as any)[spec.voice || "Synth"]
    node = new VoiceCtor(spec.options || {})
  }

  let current: any = node
  for (const stage of spec.chain || []) {
    const Ctor = (Tone as any)[stage.node]
    const next = new Ctor(stage.options || {})
    current.connect(next)
    current = next
  }
  if (spec.toDestination !== false) {
    current.connect(Tone.getDestination())
  }
  if (typeof spec.volumeDb === "number" && "volume" in node) {
    node.volume.value = spec.volumeDb
  }
  return node
}
```

### 5.2 Scheduler

The scheduler converts a board and a traversal tick into a list of piece events. It then places them on the transport with micro offsets to respect the max concurrent rule.

```ts
type Step = {
  t: number
  n?: string
  chord?: string[]
  arpeggio?: string[]
  dyad?: string[]
  d: number
  v?: number
}

type Earcon = { voiceId: string; register: Record<"white" | "black", string>; pattern: Step[] }

function scheduleEarconAt(
  time: number,
  earcon: Earcon,
  color: "white" | "black",
  pan: number,
  voices: Record<string, any>,
) {
  const v = voices[earcon.voiceId]
  const base = earcon.register[color]
  for (const step of earcon.pattern) {
    const at = time + step.t / 1000
    const vol = step.v ?? 0.8
    if ((v as any).set && Number.isFinite(pan)) {
      // set panner inside the chain if present
    }
    if (step.n) {
      v.triggerAttackRelease(Tone.Frequency(base).transpose(parseInt(step.n)), step.d / 1000, at, vol)
    } else if (step.chord) {
      const notes = step.chord.map(s => Tone.Frequency(base).transpose(parseInt(s)))
      v.triggerAttackRelease(notes, step.d / 1000, at, vol)
    } else if (step.arpeggio) {
      const notes = step.arpeggio.map(s => Tone.Frequency(base).transpose(parseInt(s)))
      notes.forEach((note, i) => v.triggerAttackRelease(note, 0.04, at + i * 0.04, vol))
    } else if (step.dyad) {
      const notes = step.dyad.map(s => Tone.Frequency(base).transpose(parseInt(s)))
      v.triggerAttackRelease(notes, step.d / 1000, at, vol)
    }
  }
}
```

### 5.3 Transport control

```ts
async function startAudioOnce() {
  await Tone.start()  // call from a user gesture handler first
}

function applyTransport(cfg: any) {
  const t = Tone.getTransport ? Tone.getTransport() : Tone.Transport
  t.bpm.value = cfg.transport?.bpm ?? 120
  if (cfg.transport?.swing) t.swing = cfg.transport.swing
  if (cfg.transport?.timeSignature) t.timeSignature = cfg.transport.timeSignature
}
```

### 5.4 Using Sequence or Part for dense motifs

For complex motifs you may prefer Tone.Sequence. It spaces an array of events at a given subdivision and supports nested arrays for micro structure. citeturn0search10

```ts
const seq = new Tone.Sequence(
  (time, note) => pawnSynth.triggerAttackRelease(note, "16n", time),
  ["C5", ["D5", "E5"], "G5", "A5"],
  "8n"
)
seq.start(0)
```

### 5.5 Icons and samples

Use Sampler or Player for short event cues. Sampler maps multiple urls to notes for quick side specific selection. Player is the simplest when you only need one file. citeturn0search13turn0search11

## 6 Execution flow

1. Validate JSON against the schema
2. Build all voices and chains
3. Apply transport settings
4. Precompute traversal ticks
5. For each tick
   * Enumerate pieces in the listed cells
   * Select top items by priority until max concurrent is reached
   * Stagger onsets uniformly inside the configured onset range
   * Schedule earcons and any event cues
6. Start the transport and stop after the configured clip length
7. Write metrics

## 7 Example complete configuration

This example implements the hybrid earcon family with a row sequential traversal and event cues with side glide for check. Clip length is about two seconds.

```json
{
  "version": "1.0",
  "name": "demoEarconRow",
  "transport": {"bpm": 120, "quantize": "16n"},
  "limits": {"maxConcurrentVoices": 4, "onsetOffsetMs": [20, 50], "hardHeadroomDb": 6, "clipLengthMs": 2200},
  "voices": {
    "synthPawn": {"type": "PolySynth", "voice": "Synth", "options": {"envelope": {"attack": 0.01, "decay": 0.08, "sustain": 0.2, "release": 0.1}}, "chain": [{"node": "Panner", "options": {"pan": 0}}], "toDestination": true, "volumeDb": -6},
    "synthKnight": {"type": "PolySynth", "voice": "Synth", "options": {}, "chain": [{"node": "Panner", "options": {"pan": 0}}], "toDestination": true},
    "samplerIcons": {"type": "Sampler", "options": {"urls": {"C5": "sounds/click_hi.wav", "C3": "sounds/click_lo.wav"}}, "chain": [{"node": "Panner", "options": {"pan": 0}}], "toDestination": true},
    "synthGlide": {"type": "Synth", "options": {"portamento": 0.02}, "chain": [{"node": "Panner", "options": {"pan": 0}}], "toDestination": true},
    "droneBed": {"type": "Synth", "options": {"oscillator": {"type": "sawtooth"}, "envelope": {"attack": 0.2, "decay": 0.3, "sustain": 0.1, "release": 0.5}}, "chain": [{"node": "Filter", "options": {"type": "lowpass", "frequency": 600}}], "toDestination": true, "volumeDb": -18}
  },
  "mappings": {
    "pieceEarcons": {
      "pawn": {"voiceId": "synthPawn", "register": {"white": "C5", "black": "C3"}, "pattern": [{"t": 0, "n": "+0", "d": 120, "v": 0.8}, {"t": 140, "n": "+2", "d": 100, "v": 0.8}]},
      "knight": {"voiceId": "synthKnight", "register": {"white": "A4", "black": "A3"}, "pattern": [{"t": 0, "n": "+0", "d": 80, "v": 0.85}, {"t": 110, "n": "+3", "d": 90, "v": 0.85}, {"t": 220, "n": "-1", "d": 90, "v": 0.85}]},
      "bishop": {"voiceId": "synthKnight", "register": {"white": "E5", "black": "E3"}, "pattern": [{"t": 0, "n": "+0", "d": 160, "v": 0.8}, {"t": 170, "n": "+2", "d": 140, "v": 0.8}]},
      "rook":   {"voiceId": "synthKnight", "register": {"white": "G4", "black": "G3"}, "pattern": [{"t": 0, "chord": ["+0", "+7", "+12"], "d": 120, "v": 0.9}]},
      "queen":  {"voiceId": "synthKnight", "register": {"white": "C6", "black": "C4"}, "pattern": [{"t": 0, "arpeggio": ["+0", "+4", "+7", "+12"], "stepMs": 40, "d": 220, "v": 0.9}]},
      "king":   {"voiceId": "synthKnight", "register": {"white": "C4", "black": "C2"}, "pattern": [{"t": 0, "dyad": ["+0", "+7"], "d": 180, "v": 0.8}]}
    }
  },
  "colors": {"white": {"pan": -0.3, "filterTint": {"frequency": 3800}}, "black": {"pan": 0.3, "pitchShift": -12, "filterTint": {"frequency": 2600}}},
  "traversal": {"strategy": "rowSequential", "params": {"startRank": 8, "fileOrder": "aToH", "rowsOrder": "8to1"}, "tickDurationMs": 250, "concurrency": {"maxVoices": 4, "onsetOffsetMs": [20, 50]}},
  "events": {"capture": {"voiceId": "samplerIcons", "white": {"note": "C5", "levelDb": 6, "pan": -0.3, "leadMs": 30}, "black": {"note": "C3", "levelDb": 6, "pan": 0.3, "leadMs": 30}, "durationMs": 90}, "check": {"voiceId": "synthGlide", "white": {"glide": {"from": "B5", "to": "D6", "durationMs": 200}, "pan": -0.3}, "black": {"glide": {"from": "D4", "to": "B3", "durationMs": 200}, "pan": 0.3}}},
  "scaling": {"drone": {"voiceId": "droneBed", "baseNote": "C2", "brightnessByMaterial": {"slopeCentroidHzPerPoint": 80, "minHz": 400, "maxHz": 2000}, "levelDb": -18}},
  "diagnostics": {"logLevel": "info", "emitScheduleLog": true, "exportMetrics": true}
}
```

## 8 TypeScript skeleton for a Sound Agent

```ts
import * as Tone from "tone"

export class SoundAgent {
  private voices: Record<string, any> = {}
  private cfg: any
  private traversal: any

  constructor(cfg: any) {
    this.cfg = cfg
  }

  async init(): Promise<void> {
    await Tone.start() // call this from a gesture handler before render
    this.applyTransport()
    this.buildVoices()
    this.traversal = this.buildTraversal(this.cfg.traversal)
  }

  applyTransport(): void {
    const t = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    const c = this.cfg.transport || {}
    t.bpm.value = c.bpm ?? 120
    if (c.swing) t.swing = c.swing
    if (c.timeSignature) t.timeSignature = c.timeSignature
  }

  buildVoices(): void {
    for (const [id, spec] of Object.entries(this.cfg.voices || {})) {
      this.voices[id] = buildVoice(spec as any)
    }
  }

  buildTraversal(trav: any): any {
    // return an object with nextTick following the TraversalProgram interface
    // implement rowSequential and spiralFromCenter here
  }

  renderPosition(board: any, features: any): void {
    const transport = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    let t0 = transport.seconds
    const clipLen = this.cfg.limits?.clipLengthMs ?? 2200
    const tickDur = (this.cfg.traversal?.tickDurationMs ?? 250) / 1000
    const endTime = t0 + clipLen / 1000

    // optional drone mapping
    this.applyDrone(features, t0, endTime)

    let tickIndex = 0
    while (t0 + tickIndex * tickDur < endTime) {
      const tick = this.traversal.nextTick()
      const offsetRange = this.cfg.traversal.concurrency?.onsetOffsetMs || [20, 50]
      const cells = tick.cells
      const events = this.selectEvents(board, cells)
      this.scheduleTickEvents(t0 + tickIndex * tickDur, events, offsetRange)
      if (tick.done) break
      tickIndex++
    }

    transport.start()
    transport.scheduleOnce(() => transport.stop(), endTime)
  }

  selectEvents(board: any, cells: string[]): any[] {
    // inspect pieces in cells
    // assign priority
    // return an array of { piece, color, earcon, pan }
    return []
  }

  scheduleTickEvents(time: number, events: any[], offsetRange: number[]): void {
    const maxVoices = this.cfg.traversal?.concurrency?.maxVoices ?? 4
    const selected = events.slice(0, maxVoices)
    const [minMs, maxMs] = offsetRange
    selected.forEach((ev, i) => {
      const jitter = minMs + Math.random() * (maxMs - minMs)
      const at = time + jitter / 1000
      scheduleEarconAt(at, ev.earcon, ev.color, ev.pan, this.voices)
      // schedule capture or check icons if present with leadMs
    })
  }

  applyDrone(features: any, start: number, end: number): void {
    // map material balance to filter cutoff on the droneBed
  }
}
```

## 9 Validation checklist

* JSON validates against schema
* Transport starts only after a user gesture
* Clip length is bounded
* Voice allocation count never exceeds max
* Onset offsets are applied inside each tick
* Icons for capture and check are audible and do not mask earcons
* Panner values place sides consistently
* All nodes disconnect on dispose

## 10 Notes for production use

* For cross browser stability prefer Tone Panner and two channel panning over Panner3D unless you need elevation
* When using Sampler preload and wait for all buffers before test runs
* Set a limiter on the master bus and keep at least six decibels headroom for icons and glides
* Keep the Sequence objects stopped and schedule with the transport for precise tick aligned playback

## 11 References to Tone.js features used

* Tone.Transport for scheduling and exact callback times. A single global transport is available and passes the event time to callbacks. citeturn0search0
* Tone.start user gesture requirement. citeturn0search1turn0search8turn0search17
* PolySynth for managing multiple monophonic voices. citeturn0search5turn0search12
* Sampler for mapping notes to audio urls and Player for simple file playback. citeturn0search13turn0search11
* Panner and Panner3D for spatial placement of sources. citeturn0search3turn0search15
* Sequence for compact event timing within a tick. citeturn0search10
* Sources can be synced to transport start and stop. citeturn0search20

## 12 Ready to run smoke test

Paste in a page with Tone.js, click Start, then run once. This renders one earcon for a white pawn at e4 and one icon for a white capture.

```html
<button id="start">Start</button>
<script type="module">
import * as Tone from "tone"

document.getElementById("start").addEventListener("click", async () => {
  await Tone.start()
  const t = Tone.getTransport ? Tone.getTransport() : Tone.Transport
  t.bpm.value = 120

  const pawn = new Tone.PolySynth(Tone.Synth).toDestination()
  const icons = new Tone.Sampler({ urls: { "C5": "sounds/click_hi.wav", "C3": "sounds/click_lo.wav" } }).toDestination()

  // tick at zero
  const t0 = t.seconds + 0.1

  // lead the capture icon by 30 ms
  icons.triggerAttackRelease("C5", 0.09, t0 + 0.0)

  // pawn earcon after 30 ms
  pawn.triggerAttackRelease(["E5"], 0.12, t0 + 0.03)

  t.start("+0.05")
  t.scheduleOnce(() => t.stop(), t0 + 1.0)
})
</script>
```

This specification lets you design any traversal and any set of earcons and icons as JSON, then execute them with a compact Tone.js engine. The examples are safe defaults for the first listening tests.
