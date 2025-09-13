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
  options?: unknown
  chain?: { node: string; options?: Record<string, unknown> }[]
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
    white?: { pan?: number; pitchShift?: number; filterTint?: { frequency?: number } }
    black?: { pan?: number; pitchShift?: number; filterTint?: { frequency?: number } }
  }
  traversal: {
    strategy: "rowSequential" | "columnSequential" | "spiralFromCenter" | "ringsFromKing" | "randomSeeded" | "customList" | string
    params?: Record<string, unknown>
    tickDurationMs?: number
    concurrency?: {
      maxVoices?: number
      onsetOffsetMs?: [number, number]
      intensityScaling?: {
        minFactor?: number
        maxFactor?: number
        curve?: "linear" | "power" | "smoothstep"
        exponent?: number
      }
    }
  }
  events?: EventsConfig
  scaling?: {
    drone?: {
      voiceId: string
      baseNote: string
      brightnessByMaterial?: { slopeCentroidHzPerPoint: number; minHz: number; maxHz: number }
      levelDb?: number
    }
  }
  diagnostics?: { logLevel?: "off" | "error" | "warn" | "info"; emitScheduleLog?: boolean }
}

type GlideCfg = { from?: string; to?: string; durationMs?: number }
type SideEventCfg = { pan?: number }
type CheckSideCfg = SideEventCfg & { glide?: GlideCfg }
type CaptureSideCfg = SideEventCfg & { note?: string; durationMs?: number }
export type EventsConfig = {
  check?: { voiceId: string; white?: CheckSideCfg; black?: CheckSideCfg }
  capture?: { voiceId: string; white?: CaptureSideCfg; black?: CaptureSideCfg }
  checkmate?: { sequence?: Array<{ voiceId: string; note: string; t: number; d: number; levelDb?: number }> }
}

type AttackReleaseNode = {
  triggerAttackRelease?: (
    notes: string | number | Array<string | number>,
    duration: number,
    time?: number,
    velocity?: number,
  ) => void
  triggerAttack?: (note: string | number | Array<string | number>, time?: number, velocity?: number) => void
  triggerRelease?: (note?: string | number | Array<string | number>, time?: number) => void
  releaseAll?: () => void
  dispose?: () => void
  volume?: { value: number }
}

type BuiltVoice = {
  node: AttackReleaseNode
  tail: Tone.ToneAudioNode
  panner?: Tone.Panner
  filter?: Tone.Filter
}

function buildVoice(spec: VoiceSpec): BuiltVoice {
  let node: AttackReleaseNode
  if (spec.type === "PolySynth") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const VoiceCtor: any = (Tone as any)[spec.voice || "Synth"]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node = new (Tone as any).PolySynth(VoiceCtor, (spec.options as object) || {}) as any
  } else if (spec.type === "Sampler") {
    node = new Tone.Sampler((spec.options as object) || {}) as unknown as AttackReleaseNode
  } else if (spec.type === "Player") {
    node = new Tone.Player((spec.options as object) || {}) as unknown as AttackReleaseNode
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const VoiceCtor: any = (Tone as any)[spec.voice || "Synth"]
    node = new VoiceCtor((spec.options as object) || {}) as unknown as AttackReleaseNode
  }

  let current: Tone.ToneAudioNode = node as unknown as Tone.ToneAudioNode
  let panner: Tone.Panner | undefined
  let filter: Tone.Filter | undefined
  for (const stage of spec.chain || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor: any = (Tone as any)[stage.node]
    const next: Tone.ToneAudioNode = new Ctor((stage.options as object) || {})
    current.connect(next)
    current = next
    if (next instanceof Tone.Panner) panner = next
    if (next instanceof Tone.Filter) filter = next
  }
  if (spec.toDestination !== false) {
    current.connect(Tone.getDestination())
  }
  if (typeof spec.volumeDb === "number" && (node as AttackReleaseNode).volume) {
    ; (node as AttackReleaseNode).volume!.value = spec.volumeDb
  }

  return { node, tail: current, panner, filter }
}

function scheduleEarconAt(
  time: number,
  earcon: Earcon,
  color: "white" | "black",
  pan: number | undefined,
  pitchOffset: number | undefined,
  filterTintHz: number | undefined,
  voices: Record<string, BuiltVoice>,
) {
  const v = voices[earcon.voiceId]
  if (!v) return
  const base = earcon.register[color]
  if (Number.isFinite(pan) && v.panner) {
    v.panner.pan.rampTo(pan as number, 0.01)
  }
  if (Number.isFinite(filterTintHz as number) && v.filter) {
    v.filter.frequency.rampTo(filterTintHz as number, 0.05)
  }
  for (const step of earcon.pattern) {
    const at = time + step.t / 1000
    const vol = step.v ?? 0.8
    const tr = (
      notes: number | number[] | string | string[],
      dur: number,
      when: number,
      vel: number,
    ) => {
      if (typeof v.node.triggerAttackRelease === "function") {
        v.node.triggerAttackRelease(notes as string | number | Array<string | number>, dur, when, vel)
      }
    }
    const toHz = (semi: number) => Tone.Frequency(base).transpose(semi + (pitchOffset ?? 0)).toFrequency()
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

// Column-sequential traversal
type ColParams = { fileOrder?: "aToH" | "hToA"; rowsOrder?: "8to1" | "1to8"; colsPerTick?: number }
function makeColumnSequential(params?: ColParams) {
  const fileOrder = params?.fileOrder ?? "aToH"
  const rowsOrder = params?.rowsOrder ?? "8to1"
  const colsPerTick = Math.max(1, Math.min(8, params?.colsPerTick ?? 1))
  const files = fileOrder === "aToH" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"]
  const ranks = rowsOrder === "8to1" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  let i = 0
  return {
    nextTick() {
      if (i >= files.length) return { startTime: 0, cells: [], done: true }
      const batchFiles = files.slice(i, i + colsPerTick)
      i += colsPerTick
      const cells: string[] = []
      for (const f of batchFiles) {
        for (const r of ranks) cells.push(`${f}${r}`)
      }
      return { startTime: 0, cells, done: i >= files.length }
    },
    reset() { i = 0 },
  }
}

// Spiral-from-center traversal using Chebyshev rings and angle ordering
type SpiralParams = { center?: string[]; spiral?: "cw" | "ccw"; cellsPerTick?: number }
function sqToCoord(sq: string): { f: number; r: number } | null {
  if (!/^[a-h][1-8]$/.test(sq)) return null
  const f = sq.charCodeAt(0) - 97
  const r = parseInt(sq[1]) - 1
  return { f, r }
}
function makeSpiralFromCenter(params?: SpiralParams) {
  const seeds = (params?.center && Array.isArray(params.center) && params.center.length > 0) ? params.center : ["d4", "e4", "d5", "e5"]
  const coords = seeds.map(sqToCoord).filter((x): x is { f: number; r: number } => !!x)
  const cx = coords.length ? coords.reduce((a, c) => a + c.f, 0) / coords.length : 3.5
  const cy = coords.length ? coords.reduce((a, c) => a + c.r, 0) / coords.length : 3.5
  const dir = params?.spiral === "ccw" ? "ccw" : "cw"
  const step = Math.max(1, Math.min(64, params?.cellsPerTick ?? 16))

  type Cell = { f: number; r: number; layer: number; angle: number }
  const cells: Cell[] = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dx = f - cx
      const dy = r - cy
      const layer = Math.max(Math.abs(dx), Math.abs(dy))
      const angle = Math.atan2(dy, dx) // CCW from +x
      cells.push({ f, r, layer, angle })
    }
  }
  cells.sort((a, b) => a.layer - b.layer || (dir === "ccw" ? a.angle - b.angle : b.angle - a.angle) || a.r - b.r || a.f - b.f)
  const ids = cells.map((c) => `${String.fromCharCode(97 + c.f)}${c.r + 1}`)
  let i = 0
  return {
    nextTick() {
      if (i >= ids.length) return { startTime: 0, cells: [], done: true }
      const batch = ids.slice(i, i + step)
      i += step
      return { startTime: 0, cells: batch, done: i >= ids.length }
    },
    reset() { i = 0 },
  }
}

// Random seeded traversal
type RandomParams = { seed?: number | string; cellsPerTick?: number }
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function makeRandomSeeded(params?: RandomParams) {
  const step = Math.max(1, Math.min(64, params?.cellsPerTick ?? 16))
  const seed = typeof params?.seed === "number" ? params.seed : hashString(String(params?.seed ?? "seed"))
  const rnd = mulberry32(seed >>> 0)
  const ids: string[] = []
  for (let r = 1; r <= 8; r++) {
    for (let f = 0; f < 8; f++) ids.push(`${String.fromCharCode(97 + f)}${r}`)
  }
  // shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  let i = 0
  return {
    nextTick() {
      if (i >= ids.length) return { startTime: 0, cells: [], done: true }
      const batch = ids.slice(i, i + step)
      i += step
      return { startTime: 0, cells: batch, done: i >= ids.length }
    },
    reset() { i = 0 },
  }
}

// Custom list traversal
type CustomListParams = { order: string[]; cellsPerTick?: number }
function makeCustomList(params?: CustomListParams) {
  const order = (params?.order || []).filter((sq) => /^[a-h][1-8]$/.test(sq))
  const stepSource = params?.cellsPerTick ?? (order.length || 64)
  const step = Math.max(1, Math.min(64, stepSource))
  let i = 0
  return {
    nextTick() {
      if (i >= order.length) return { startTime: 0, cells: [], done: true }
      const batch = order.slice(i, i + step)
      i += step
      return { startTime: 0, cells: batch, done: i >= order.length }
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
  private limiter: Tone.Limiter | null = null
  private initialized = false
  private repeatId: number | null = null
  private stopId: number | null = null
  private running = false
  private droneActive = false
  private droneNote: string | number | null = null
  private currentFen = ""
  private previousFen = ""
  private positionVersion = 0
  private handledPositionVersion = -1
  private static readonly TraversalParamsEmpty: Record<string, unknown> = {}

  constructor(cfg: SoundAgentConfig) {
    this.cfg = cfg
  }

  async init(): Promise<void> {
    if (this.initialized) return
    await Tone.start() // user gesture required; call from Play handler
    // Build master bus with limiter according to hard headroom
    this.masterGain = new Tone.Gain(0.9)
    const headroomDb = this.cfg.limits?.hardHeadroomDb ?? 6
    this.limiter = new Tone.Limiter({ threshold: -Math.abs(headroomDb) })
    this.masterGain.connect(this.limiter)
    this.limiter.connect(Tone.getDestination())
    this.applyTransport()
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
  private applyTransport(): void {
    const t = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    const c = this.cfg.transport || {}
    if (typeof c.bpm === "number") t.bpm.value = c.bpm
    if (typeof c.swing === "number") t.swing = c.swing
    if (Array.isArray(c.timeSignature)) {
      const sig = c.timeSignature as [number, number]
      // Tone.Transport.timeSignature is number | [number, number] on recent versions
      // Cast to the right union without using any
      (t as unknown as { timeSignature: number | [number, number] }).timeSignature = sig
    }
    // latencyHint, quantize and startOffset are advisory; quantize affects how you schedule internally
  }

  setTransport(opts: Partial<NonNullable<SoundAgentConfig["transport"]>>): void {
    this.cfg.transport = { ...(this.cfg.transport || {}), ...opts }
    this.applyTransport()
  }

  private buildVoices(): void {
    const colors = this.cfg.colors || {}
    for (const [id, spec] of Object.entries(this.cfg.voices || {})) {
      const built = buildVoice(spec as VoiceSpec)
      // Route through master gain if present
      if (this.masterGain) {
        built.tail.disconnect()
        built.tail.connect(this.masterGain)
      }
      this.voices[id] = built

      // Build per-color PitchShift variants if requested
      const makeAlias = (color: "white" | "black", shift?: number) => {
        if (!shift || shift === 0) return
        const aliasId = `${id}__${color}`
        // Clone spec and inject PitchShift at end of chain
        const chain = Array.isArray((spec as VoiceSpec).chain) ? [...(spec as VoiceSpec).chain!] : []
        chain.push({ node: "PitchShift", options: { pitch: shift } })
        const aliasSpec: VoiceSpec = { ...(spec as VoiceSpec), chain }
        const aliasBuilt = buildVoice(aliasSpec)
        if (this.masterGain) {
          aliasBuilt.tail.disconnect()
          aliasBuilt.tail.connect(this.masterGain)
        }
        this.voices[aliasId] = aliasBuilt
      }
      makeAlias("white", colors.white?.pitchShift)
      makeAlias("black", colors.black?.pitchShift)
    }
  }

  stop(): void {
    const transport = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    if (this.repeatId !== null) {
      transport.clear(this.repeatId)
      this.repeatId = null
    }
    if (this.stopId !== null) {
      transport.clear(this.stopId)
      this.stopId = null
    }
    this.running = false
    // stop drone if active
    if (this.droneActive && this.cfg.scaling?.drone) {
      const v = this.voices[this.cfg.scaling.drone.voiceId]
      if (v && typeof v.node.triggerRelease === "function") {
        try { v.node.triggerRelease(this.droneNote ?? undefined, Tone.now() + 0.02) } catch { /* noop */ }
      }
      this.droneActive = false
    }
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
    this.limiter?.dispose()
    this.limiter = null
    this.initialized = false
  }

  // renderPosition is intentionally removed in continuous mode

  setPosition(fen: string): void {
    if (fen && fen !== this.currentFen) {
      this.previousFen = this.currentFen
      this.currentFen = fen
      this.positionVersion += 1
      // Rebuild traversal if strategy depends on position
      const chess = new Chess(this.currentFen)
      this.traversal = this.buildTraversal(chess)
      // If running, process a tick immediately so the new position is heard without waiting
      if (this.running) {
        const now = Tone.now()
        this.processTick(chess, now + 0.02)
      }
    }
  }

  async start(): Promise<void> {
    if (!this.initialized) await this.init()
    if (this.running) return
    this.running = true
    this.traversal?.reset()
    this.scheduleRepeat()
    this.scheduleClipStopIfNeeded()
  }

  private scheduleRepeat(): void {
    const transport = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    const interval = (this.cfg.traversal?.tickDurationMs ?? 250) / 1000

    // Clear prior repeat if any
    if (this.repeatId !== null) {
      transport.clear(this.repeatId)
      this.repeatId = null
    }

    this.repeatId = transport.scheduleRepeat((time) => {
      if (!this.currentFen) return
      const chess = new Chess(this.currentFen)
      this.processTick(chess, time)
    }, interval)

    // Start transport if it isn't running yet
    if (!transport.state || transport.state !== "started") {
      transport.start()
    }
  }

  private scheduleClipStopIfNeeded(): void {
    const transport = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    const ms = this.cfg.limits?.clipLengthMs
    if (!ms || ms <= 0) return
    if (this.stopId !== null) {
      transport.clear(this.stopId)
      this.stopId = null
    }
    const when = "+" + (ms / 1000).toString()
    this.stopId = transport.scheduleOnce(() => this.stop(), when)
  }

  private reschedule(): void {
    if (!this.running) return
    this.scheduleRepeat()
  }

  private processTick(chess: Chess, time: number): void {
    const [minMs, maxMs] = this.cfg.traversal.concurrency?.onsetOffsetMs || this.cfg.limits?.onsetOffsetMs || [20, 50]
    const baseMaxVoices = this.cfg.traversal.concurrency?.maxVoices ?? this.cfg.limits?.maxConcurrentVoices ?? 4

    // One-shot events on position change (check and capture)
    if (this.positionVersion > this.handledPositionVersion) {
      this.handledPositionVersion = this.positionVersion
      // Check cue
      if (chess.isCheck() && this.cfg.events?.check && this.voices[this.cfg.events.check.voiceId]) {
        const voice = this.voices[this.cfg.events.check.voiceId]
        const side = chess.turn() === "w" ? "white" : "black"
        const glide = this.cfg.events.check[side]?.glide
        const pan = this.cfg.events.check[side]?.pan
        if (voice.panner && typeof pan === "number") voice.panner.pan.rampTo(pan, 0.01)
        const from = glide?.from || (side === "white" ? "B5" : "D4")
        const to = glide?.to || (side === "white" ? "D6" : "B3")
        if (typeof voice.node.triggerAttackRelease === "function") {
          voice.node.triggerAttackRelease(from, 0.08, time + 0.02, 0.7)
          voice.node.triggerAttackRelease(to, 0.12, time + 0.11, 0.7)
        }
      }
      // Checkmate cue sequence
      if (chess.isCheckmate() && this.cfg.events?.checkmate?.sequence && this.cfg.events.checkmate.sequence.length) {
        const seq = this.cfg.events.checkmate.sequence
        for (const ev of seq) {
          const v = this.voices[ev.voiceId]
          if (!v || typeof v.node.triggerAttackRelease !== "function") continue
          const at = time + (ev.t || 0) / 1000
          const dur = (ev.d || 120) / 1000
          const vel = typeof ev.levelDb === "number" ? Math.max(0, Math.min(1, Math.pow(10, ev.levelDb / 20))) : 0.8
          v.node.triggerAttackRelease(ev.note, dur, at, vel)
        }
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
            if (v.panner && typeof pan === "number") v.panner.pan.rampTo(pan, 0.01)
            if (typeof v.node.triggerAttackRelease === "function") {
              v.node.triggerAttackRelease(note, dur, time + 0.02, 0.9)
            }
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
    type Ev = { earcon: Earcon; color: "white" | "black"; pan?: number; pieceType: string; pitchOffset?: number; filterTintHz?: number }
    const events: Ev[] = []
    for (const cell of tick.cells) {
      const p = boardPieces.find((bp) => bp.square === cell)
      if (!p) continue
      const ear = this.cfg.mappings?.pieceEarcons?.[p.type]
      if (!ear) continue
      const colorCfg = this.cfg.colors?.[p.color]
      events.push({ earcon: ear, color: p.color, pan: colorCfg?.pan, pieceType: p.type, pitchOffset: colorCfg?.pitchShift, filterTintHz: colorCfg?.filterTint?.frequency })
    }

    // Apply voice priority if provided (piece-type based)
    const priority = (this.cfg.limits?.voicePriority || ["king", "queen", "rook", "bishop", "knight", "pawn"]) as string[]
    const rank: Record<string, number> = {}
    priority.forEach((name, idx) => { rank[name] = idx })
    events.sort((a, b) => (rank[a.pieceType] ?? 999) - (rank[b.pieceType] ?? 999))

    // Compute intensity and scale dynamic voice count
    const intensity = this.computeIntensity(chess)
    const factor = this.mapIntensityFactor(intensity)
    const dynMax = Math.max(1, Math.min(64, Math.ceil(baseMaxVoices * factor)))
    const chosen = events.slice(0, dynMax)

    // Schedule events inside this tick using the provided time
    const logThisTick: Array<{ piece: string; color: string; at: number }> = []
    chosen.forEach((ev) => {
      const jitter = minMs + Math.random() * (maxMs - minMs)
      const baseAt = time + jitter / 1000
      // Prefer per-color PitchShift alias voice if present; otherwise use pitchOffset
      const aliasId = ev.pitchOffset ? `${ev.earcon.voiceId}__${ev.color}` : undefined
      const useEar = aliasId && this.voices[aliasId] ? { ...ev.earcon, voiceId: aliasId } : ev.earcon
      const transpose = aliasId && this.voices[aliasId] ? undefined : ev.pitchOffset
      scheduleEarconAt(baseAt, useEar, ev.color, ev.pan, transpose, ev.filterTintHz, this.voices)
      logThisTick.push({ piece: ev.pieceType, color: ev.color, at: baseAt })
    })

    if (this.cfg.diagnostics?.emitScheduleLog) {
      // Lightweight diag log for the tick
      console.log("[SoundAgent] tick", {
        cells: tick.cells,
        selected: logThisTick.map((e) => ({ piece: e.piece, color: e.color, atMs: Math.round((e.at - time) * 1000) })),
      })
    }

    // Update or start drone if configured
    this.updateDrone(chess)
  }

  // Map intensity (0..1) to factor using config; defaults to previous linear 0.5..1.0
  private mapIntensityFactor(x: number): number {
    const cfg = this.cfg.traversal?.concurrency?.intensityScaling
    const minF = Math.max(0, Math.min(2, cfg?.minFactor ?? 0.5))
    const maxF = Math.max(minF, Math.min(4, cfg?.maxFactor ?? 1.0))
    const curve = cfg?.curve ?? "linear"
    let y = Math.max(0, Math.min(1, x))
    if (curve === "power") {
      const e = cfg?.exponent ?? 1.5
      y = Math.pow(y, e)
    } else if (curve === "smoothstep") {
      // 3x^2 - 2x^3
      y = y * y * (3 - 2 * y)
    }
    return minF + (maxF - minF) * y
  }

  // --- Intensity metric (0..1) combining captures, center control, in-check ---
  private computeIntensity(chess: Chess): number {
    type VerboseMove = { to?: string; flags?: string; captured?: string }
    // totalCaptures: legal capture moves for side to move
    const moves = chess.moves({ verbose: true }) as VerboseMove[]
    const captureCount = moves.filter((m) => (m.flags && (m.flags.includes('c') || m.flags.includes('e'))) || m.captured).length

    // center control approximation: unique control of e4,d4,e5,d5 by either side
    const fen = chess.fen()
    let ctrl = 0
    try {
      const cw = new Chess(fen.replace(/ (w|b) /, ' w '))
      const cb = new Chess(fen.replace(/ (w|b) /, ' b '))
      const centers = new Set(['e4', 'd4', 'e5', 'd5'])
      const set = new Set<string>()
        ; (cw.moves({ verbose: true }) as VerboseMove[]).forEach(m => { if (m.to && centers.has(m.to)) set.add(m.to) })
        ; (cb.moves({ verbose: true }) as VerboseMove[]).forEach(m => { if (m.to && centers.has(m.to)) set.add(m.to) })
      ctrl = set.size
    } catch { /* ignore */ }

    const inCheck = chess.isCheck() ? 1 : 0
    const score = 0.4 * Math.min(1, captureCount / 20) + 0.4 * (ctrl / 4) + 0.2 * inCheck
    return Math.max(0, Math.min(1, score))
  }

  private buildTraversal(chess?: Chess) {
    const strat = this.cfg.traversal?.strategy || "rowSequential"
    const params = this.cfg.traversal?.params || {}
    switch (strat) {
      case "rowSequential":
        return makeRowSequential(params as RowParams)
      case "columnSequential":
        return makeColumnSequential(params as ColParams)
      case "spiralFromCenter":
        return makeSpiralFromCenter(params as SpiralParams)
      case "randomSeeded":
        return makeRandomSeeded(params as RandomParams)
      case "customList":
        return makeCustomList(params as CustomListParams)
      case "ringsFromKing":
        return chess ? makeRingsFromKing(chess, params as RingsParams) : makeRowSequential(params as RowParams)
      default:
        return makeRowSequential(params as RowParams)
    }
  }


  setTraversal(strategy: SoundAgentConfig["traversal"]["strategy"], params?: Record<string, unknown>): void {
    this.cfg.traversal = { ...(this.cfg.traversal || {}), strategy, params: params || SoundAgent.TraversalParamsEmpty }
    const chess = this.currentFen ? new Chess(this.currentFen) : undefined
    this.traversal = this.buildTraversal(chess)
  }
  // --- Introspection & audition helpers ---
  listPieceTypes(): string[] {
    return Object.keys(this.cfg.mappings?.pieceEarcons || {})
  }

  listVoiceIds(): string[] {
    return Object.keys(this.cfg.voices || {})
  }

  playEarcon(pieceType: string, color: "white" | "black" = "white", delayMs = 20): void {
    const ear = this.cfg.mappings?.pieceEarcons?.[pieceType]
    if (!ear) return
    const time = Tone.now() + delayMs / 1000
    const c = this.cfg.colors?.[color]
    const pitchShift = c?.pitchShift
    const filtHz = c?.filterTint?.frequency
    scheduleEarconAt(time, ear, color, c?.pan, pitchShift, filtHz, this.voices)
  }

  playVoice(voiceId: string, note: string, durationMs = 200, velocity = 0.8, color: "white" | "black" = "white"): void {
    const v = this.voices[voiceId]
    if (!v) return
    const time = Tone.now() + 0.02
    const pan = this.cfg.colors?.[color]?.pan
    if (v.panner && Number.isFinite(pan)) v.panner.pan.rampTo(pan as number, 0.01)
    if (typeof v.node.triggerAttackRelease === "function") {
      v.node.triggerAttackRelease(note, durationMs / 1000, time, velocity)
    }
  }

  getTraversal(): SoundAgentConfig["traversal"] {
    // return a shallow clone to prevent external mutation affecting internals
    const t = this.cfg.traversal || { strategy: "rowSequential" as const, params: {} }
    return { ...t, params: { ...(t.params || {}) } }
  }

  // --- Drone scaling layer ---
  private updateDrone(chess: Chess): void {
    const d = this.cfg.scaling?.drone
    if (!d) return
    const voice = this.voices[d.voiceId]
    if (!voice) return

    // start drone once
    if (!this.droneActive) {
      const vel = typeof d.levelDb === "number" ? Math.max(0, Math.min(1, Math.pow(10, d.levelDb / 20))) : 0.2
      if (typeof voice.node.triggerAttack === "function") {
        try {
          voice.node.triggerAttack(d.baseNote, Tone.now() + 0.02, vel)
          this.droneActive = true
          this.droneNote = d.baseNote
        } catch { /* noop */ }
      }
    }

    // compute material balance and map to filter frequency
    const val: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
    const board = chess.board()
    let white = 0, black = 0
    board.forEach((row) => row.forEach((sq) => { if (!sq) return; if (sq.color === "w") white += val[sq.type] || 0; else black += val[sq.type] || 0 }))
    const delta = white - black
    const map = d.brightnessByMaterial
    if (map && voice.filter) {
      const target = Math.max(map.minHz, Math.min(map.maxHz, map.minHz + map.slopeCentroidHzPerPoint * delta))
      voice.filter.frequency.rampTo(target, 0.2)
    }
  }
}
