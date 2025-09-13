import * as Tone from "tone"
import { Chess } from "chess.js"

// Minimal types to support the JSON-driven config described in soundAGENTS.md
export type Step = {
  t: number
  n?: string
  chord?: string[]
  arpeggio?: string[]
  dyad?: string[]
  d: number
  v?: number
  stepMs?: number
}

export type Earcon = {
  voiceId: string
  register: Record<"white" | "black", string>
  pattern: Step[]
}

export type VoiceSpec = {
  type: "Synth" | "PolySynth" | "Sampler" | "Player"
  voice?: "Synth" | "AMSynth" | "FMSynth"
  options?: any
  chain?: { node: string; options?: any }[]
  toDestination?: boolean
  volumeDb?: number
}

export type SoundAgentConfig = {
  version: string
  name: string
  transport?: {
    bpm?: number
    swing?: number
    timeSignature?: [number, number]
    latencyHint?: string
    quantize?: string
    startOffset?: string
  }
  limits?: {
    maxConcurrentVoices?: number
    onsetOffsetMs?: [number, number]
    hardHeadroomDb?: number
    clipLengthMs?: number
    voicePriority?: string[]
  }
  voices?: Record<string, VoiceSpec>
  mappings?: { pieceEarcons?: Record<string, Earcon> }
  colors?: {
    white?: { pan?: number; pitchShift?: number; filterTint?: any }
    black?: { pan?: number; pitchShift?: number; filterTint?: any }
  }
  traversal: {
    strategy: "rowSequential" | "ringsFromKing" | "customList" | string
    params?: Record<string, any>
    tickDurationMs?: number
    concurrency?: { maxVoices?: number; onsetOffsetMs?: [number, number] }
  }
  events?: any
  scaling?: any
  diagnostics?: { logLevel?: "off" | "error" | "warn" | "info"; emitScheduleLog?: boolean }
}

type BuiltVoice = {
  node: any
  tail: Tone.ToneAudioNode
  panner?: Tone.Panner
}

function buildVoice(spec: VoiceSpec): BuiltVoice {
  let node: any
  if (spec.type === "PolySynth") {
    const VoiceCtor = (Tone as any)[spec.voice || "Synth"]
    node = new Tone.PolySynth(VoiceCtor, spec.options || {})
  } else if (spec.type === "Sampler") {
    node = new Tone.Sampler(spec.options || {})
  } else if (spec.type === "Player") {
    node = new Tone.Player(spec.options || {})
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const VoiceCtor = (Tone as any)[spec.voice || "Synth"]
    node = new VoiceCtor(spec.options || {})
  }

  let current: any = node
  let panner: Tone.Panner | undefined
  for (const stage of spec.chain || []) {
    const Ctor: any = (Tone as any)[stage.node]
    const next = new Ctor(stage.options || {})
    current.connect(next)
    current = next
    if (next instanceof Tone.Panner) panner = next
  }
  if (spec.toDestination !== false) {
    current.connect(Tone.getDestination())
  }
  if (typeof spec.volumeDb === "number" && "volume" in node) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ; (node as any).volume.value = spec.volumeDb
  }

  return { node, tail: current, panner }
}

function scheduleEarconAt(
  time: number,
  earcon: Earcon,
  color: "white" | "black",
  pan: number | undefined,
  voices: Record<string, BuiltVoice>,
) {
  const v = voices[earcon.voiceId]
  if (!v) return
  const base = earcon.register[color]
  if (Number.isFinite(pan) && v.panner) {
    v.panner.pan.rampTo(pan as number, 0.01)
  }
  for (const step of earcon.pattern) {
    const at = time + step.t / 1000
    const vol = step.v ?? 0.8
    const tr = (notes: number | number[] | string | string[], dur: number, when: number, vel: number) => {
      if (typeof v.node.triggerAttackRelease === "function") {
        v.node.triggerAttackRelease(notes as any, dur, when, vel)
      }
    }
    const toHz = (semi: number) => Tone.Frequency(base).transpose(semi).toFrequency()
    if (step.n) {
      const hz = toHz(parseInt(step.n))
      tr(hz, step.d / 1000, at, vol)
    } else if (step.chord) {
      const notes = step.chord.map((s) => toHz(parseInt(s)))
      tr(notes, step.d / 1000, at, vol)
    } else if (step.arpeggio) {
      const notes = step.arpeggio.map((s) => toHz(parseInt(s)))
      const stepLen = (step.stepMs ?? 40) / 1000
      notes.forEach((n, i) => tr(n, 0.04, at + i * stepLen, vol))
    } else if (step.dyad) {
      const notes = step.dyad.map((s) => toHz(parseInt(s)))
      tr(notes, step.d / 1000, at, vol)
    }
  }
}

// Simple rowSequential traversal
type RowParams = { fileOrder?: "aToH" | "hToA"; rowsOrder?: "8to1" | "1to8"; rowsPerTick?: number }
function makeRowSequential(params?: RowParams) {
  const fileOrder = params?.fileOrder ?? "aToH"
  const rowsOrder = params?.rowsOrder ?? "8to1"
  const rowsPerTick = Math.max(1, Math.min(8, params?.rowsPerTick ?? 1))
  const files = fileOrder === "aToH" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"]
  const ranks = rowsOrder === "8to1" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  let i = 0
  return {
    nextTick() {
      if (i >= ranks.length) return { startTime: 0, cells: [], done: true }
      const batch = ranks.slice(i, i + rowsPerTick)
      i += rowsPerTick
      const cells: string[] = []
      for (const r of batch) {
        for (const f of files) cells.push(`${f}${r}`)
      }
      return { startTime: 0, cells, done: i >= ranks.length }
    },
    reset() { i = 0 },
  }
}

// Rings-from-king traversal: expand in Manhattan rings from the king of the side to move
type RingsParams = { side?: "turn" | "white" | "black"; cellsPerTick?: number }
function makeRingsFromKing(chess: Chess, params?: RingsParams) {
  const side = params?.side ?? "turn"
  const turn: "white" | "black" = chess.turn() === "w" ? "white" : "black"
  const useSide: "white" | "black" = side === "turn" ? turn : (side as "white" | "black")
  // find king square for chosen side
  const pieces = chess.board()
  let kingSquare: { f: number; r: number } | null = null
  pieces.forEach((row, rIdx) => {
    row.forEach((sq, fIdx) => {
      if (sq && sq.type === "k" && (sq.color === (useSide === "white" ? "w" : "b"))) {
        kingSquare = { f: fIdx, r: 7 - rIdx } // 0-indexed from a1 -> f:0..7, r:0..7
      }
    })
  })
  // if not found, fall back to center
  const center = { f: 3, r: 3 }
  const origin = kingSquare ?? center
  // precompute all cells with their manhattan distance from origin
  const cells: { f: number; r: number; d: number }[] = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const d = Math.abs(f - origin.f) + Math.abs(r - origin.r)
      cells.push({ f, r, d })
    }
  }
  cells.sort((a, b) => a.d - b.d || a.r - b.r || a.f - b.f)
  const cellIds = cells.map((c) => `${String.fromCharCode(97 + c.f)}${c.r + 1}`)
  const step = Math.max(1, Math.min(64, params?.cellsPerTick ?? 16))
  let i = 0
  return {
    nextTick() {
      if (i >= cellIds.length) return { startTime: 0, cells: [], done: true }
      const batch = cellIds.slice(i, i + step)
      i += step
      return { startTime: 0, cells: batch, done: i >= cellIds.length }
    },
    reset() { i = 0 },
  }
}

function pieceNameFromType(t: string): string {
  const map: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }
  return map[t] || "pawn"
}

export class SoundAgent {
  private voices: Record<string, BuiltVoice> = {}
  private cfg: SoundAgentConfig
  private traversal: { nextTick: () => { startTime: number; cells: string[]; done?: boolean }; reset: () => void } | null = null
  private masterGain: Tone.Gain | null = null
  private initialized = false
  private repeatId: number | null = null
  private running = false
  private currentFen = ""
  private previousFen = ""
  private positionVersion = 0
  private handledPositionVersion = -1

  constructor(cfg: SoundAgentConfig) {
    this.cfg = cfg
  }

  async init(): Promise<void> {
    if (this.initialized) return
    await Tone.start() // user gesture required; call from Play handler
    this.masterGain = new Tone.Gain(0.9).toDestination()
    this.buildVoices()
    // initialize traversal with a default (will rebuild on first setPosition or tick)
    this.traversal = makeRowSequential(this.cfg.traversal?.params as RowParams)
    this.initialized = true
  }

  setTickDuration(ms: number): void {
    this.cfg.traversal.tickDurationMs = ms
    // If running, reschedule repeat with new interval
    if (this.running) {
      this.reschedule()
    }
  }

  setMasterVolume(v: number): void {
    if (!this.masterGain) return
    this.masterGain.gain.rampTo(Math.max(0, Math.min(1, v)), 0.1)
  }

  // Transport settings are currently unused. We schedule directly on the audio clock for simplicity.
  // private applyTransport(): void { /* reserved for future Transport-driven scheduling */ }

  private buildVoices(): void {
    for (const [id, spec] of Object.entries(this.cfg.voices || {})) {
      const built = buildVoice(spec as VoiceSpec)
      // Route through master gain if present
      if (this.masterGain) {
        built.tail.disconnect()
        built.tail.connect(this.masterGain)
      }
      this.voices[id] = built
    }
  }

  stop(): void {
    const transport = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    if (this.repeatId !== null) {
      transport.clear(this.repeatId)
      this.repeatId = null
    }
    this.running = false
    // release any envelopes where possible
    Object.values(this.voices).forEach((v) => {
      if (typeof v.node.releaseAll === "function") v.node.releaseAll()
    })
  }

  dispose(): void {
    this.stop()
    Object.values(this.voices).forEach((v) => v.node.dispose?.())
    this.voices = {}
    this.masterGain?.dispose()
    this.masterGain = null
    this.initialized = false
  }

  // renderPosition is intentionally removed in continuous mode

  setPosition(fen: string): void {
    if (fen && fen !== this.currentFen) {
      this.previousFen = this.currentFen
      this.currentFen = fen
      this.positionVersion += 1
      // Rebuild traversal if strategy depends on position
      this.traversal = this.buildTraversal(new Chess(this.currentFen))
    }
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.init()
    if (this.running) return
    this.running = true
    this.traversal?.reset()
    this.scheduleRepeat()
  }

  private scheduleRepeat(): void {
    const transport = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    const interval = (this.cfg.traversal?.tickDurationMs ?? 250) / 1000
    const [minMs, maxMs] = this.cfg.traversal.concurrency?.onsetOffsetMs || this.cfg.limits?.onsetOffsetMs || [20, 50]
    const maxVoices = this.cfg.traversal.concurrency?.maxVoices ?? this.cfg.limits?.maxConcurrentVoices ?? 4

    // Clear prior repeat if any
    if (this.repeatId !== null) {
      transport.clear(this.repeatId)
      this.repeatId = null
    }

    this.repeatId = transport.scheduleRepeat((time) => {
      if (!this.currentFen) return
      const chess = new Chess(this.currentFen)

      // One-shot events on position change (check and capture)
      if (this.positionVersion > this.handledPositionVersion) {
        this.handledPositionVersion = this.positionVersion
        // Check cue
        if (chess.isCheck() && this.cfg.events?.check && this.voices[this.cfg.events.check.voiceId]) {
          const voice = this.voices[this.cfg.events.check.voiceId]
          const side = chess.turn() === "w" ? "white" : "black"
          const glide = this.cfg.events.check[side]?.glide
          const pan = this.cfg.events.check[side]?.pan
          if (voice.panner && Number.isFinite(pan)) voice.panner.pan.rampTo(pan, 0.01)
          const from = glide?.from || (side === "white" ? "B5" : "D4")
          const to = glide?.to || (side === "white" ? "D6" : "B3")
          voice.node.triggerAttackRelease(from, 0.08, time + 0.02, 0.7)
          voice.node.triggerAttackRelease(to, 0.12, time + 0.11, 0.7)
        }
        // Capture cue (detect material drop from previousFen to currentFen)
        if (this.previousFen) {
          try {
            const prev = new Chess(this.previousFen)
            const prevCount = prev.board().flat().filter(Boolean).length
            const currCount = chess.board().flat().filter(Boolean).length
            if (currCount < prevCount && this.cfg.events?.capture && this.voices[this.cfg.events.capture.voiceId]) {
              const attacker: "white" | "black" = chess.turn() === "w" ? "black" : "white"
              const v = this.voices[this.cfg.events.capture.voiceId]
              const spec = this.cfg.events.capture[attacker] || {}
              const note = spec.note || (attacker === "white" ? "C2" : "G1")
              const dur = (spec.durationMs ?? 160) / 1000
              const pan = spec.pan
              if (v.panner && Number.isFinite(pan)) v.panner.pan.rampTo(pan, 0.01)
              v.node.triggerAttackRelease(note, dur, time + 0.02, 0.9)
            }
          } catch { /* ignore diff errors */ }
        }
      }

      // Build board snapshot
      const boardPieces: { square: string; type: string; color: "white" | "black" }[] = []
      const board = chess.board()
      board.forEach((row, rankIndex) => {
        row.forEach((sq, fileIndex) => {
          if (!sq) return
          const file = String.fromCharCode(97 + fileIndex)
          const rank = 8 - rankIndex
          boardPieces.push({ square: `${file}${rank}`, type: pieceNameFromType(sq.type), color: sq.color === "w" ? "white" : "black" })
        })
      })

      // Next traversal tick (rollover when done)
      let tick = this.traversal?.nextTick()
      if (!tick || tick.cells.length === 0) {
        // rebuild traversal in case strategy depends on current position
        this.traversal = this.buildTraversal(chess)
        tick = this.traversal?.nextTick()
      }
      if (!tick) return

      // Select events
      const events: { earcon: Earcon; color: "white" | "black"; pan?: number }[] = []
      for (const cell of tick.cells) {
        const p = boardPieces.find((bp) => bp.square === cell)
        if (!p) continue
        const ear = this.cfg.mappings?.pieceEarcons?.[p.type]
        if (!ear) continue
        events.push({ earcon: ear, color: p.color, pan: this.cfg.colors?.[p.color]?.pan })
        if (events.length >= maxVoices) break
      }

      // Schedule events inside this tick using the provided time
      events.forEach((ev) => {
        const jitter = minMs + Math.random() * (maxMs - minMs)
        const baseAt = time + jitter / 1000
        scheduleEarconAt(baseAt, ev.earcon, ev.color, ev.pan, this.voices)
      })
    }, interval)

    // Start transport if it isn't running yet
    if (!transport.state || transport.state !== "started") {
      transport.start()
    }
  }

  private reschedule(): void {
    if (!this.running) return
    this.scheduleRepeat()
  }

  private buildTraversal(chess?: Chess) {
    const strat = this.cfg.traversal?.strategy || "rowSequential"
    const params = this.cfg.traversal?.params || {}
    if (strat === "ringsFromKing" && chess) {
      return makeRingsFromKing(chess, params as RingsParams)
    }
    return makeRowSequential(params as RowParams)
  }
}
