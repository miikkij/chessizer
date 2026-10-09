import * as Tone from "tone"
import { Chess } from "chess.js"
import { buildTraversal, type Traversal } from "./traversal"
import type { PositionTransition } from "../chess/game"
import { calculatePositionMetrics, type PositionMetrics } from "../chess/metrics"
import { captureSideForTransition, materialBrightness } from "./audioSemantics"
import { NoteQueue } from "./NoteQueue"

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
  releaseAll?: (time?: number) => void
  stop?: (time?: number) => void
  dispose?: () => void
  volume?: { value: number }
}

type NoteValue = string | number | Array<string | number>
type SingleNote = string | number
type CancellableVoice = AttackReleaseNode & {
  envelope: Pick<Tone.Envelope, "release" | "getValueAtTime" | "cancel">
  modulationEnvelope?: Pick<Tone.Envelope, "release" | "getValueAtTime" | "cancel">
}

type BuiltVoice = {
  node: AttackReleaseNode
  type: VoiceSpec["type"]
  tail: Tone.ToneAudioNode
  effects: Tone.ToneAudioNode[]
  synths: Set<CancellableVoice>
  outstandingNotes?: SingleNote[]
  panner?: Tone.Panner
  filter?: Tone.Filter
}

function buildVoice(spec: VoiceSpec): BuiltVoice {
  let node: AttackReleaseNode
  const synths = new Set<CancellableVoice>()
  if (spec.type === "PolySynth") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const VoiceCtor: any = (Tone as any)[spec.voice || "Synth"]
    class TrackedVoice extends VoiceCtor {
      constructor(...args: unknown[]) {
        super(...args)
        synths.add(this as unknown as CancellableVoice)
      }
      dispose() {
        synths.delete(this as unknown as CancellableVoice)
        return super.dispose()
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node = new (Tone as any).PolySynth(TrackedVoice, (spec.options as object) || {}) as any
  } else if (spec.type === "Sampler") {
    node = new Tone.Sampler((spec.options as object) || {}) as unknown as AttackReleaseNode
  } else if (spec.type === "Player") {
    node = new Tone.Player((spec.options as object) || {}) as unknown as AttackReleaseNode
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const VoiceCtor: any = (Tone as any)[spec.voice || "Synth"]
    node = new VoiceCtor((spec.options as object) || {}) as unknown as AttackReleaseNode
    synths.add(node as CancellableVoice)
  }

  let current: Tone.ToneAudioNode = node as unknown as Tone.ToneAudioNode
  const effects: Tone.ToneAudioNode[] = []
  let panner: Tone.Panner | undefined
  let filter: Tone.Filter | undefined
  for (const stage of spec.chain || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor: any = (Tone as any)[stage.node]
    const next: Tone.ToneAudioNode = new Ctor((stage.options as object) || {})
    effects.push(next)
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

  return { node, type: spec.type, tail: current, effects, synths, panner, filter }
}

function scheduleEarconAt(
  time: number,
  earcon: Earcon,
  color: "white" | "black",
  pan: number | undefined,
  pitchOffset: number | undefined,
  filterTintHz: number | undefined,
  voices: Record<string, BuiltVoice>,
  schedule: (voice: BuiltVoice, notes: NoteValue, duration: number, time: number, velocity: number) => void,
  /** BUG-018 FIX: optional file-based spatial pan override */
  filePan?: number,
) {
  const v = voices[earcon.voiceId]
  if (!v) return
  const base = earcon.register[color]
  // Use file-based spatial pan if provided, otherwise fall back to color pan
  const effectivePan = filePan ?? pan
  if (Number.isFinite(effectivePan) && v.panner) {
    v.panner.pan.rampTo(effectivePan as number, 0.01)
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
      schedule(v, notes, dur, when, vel)
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

function pieceNameFromType(t: string): string {
  const map: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }
  return map[t] || "pawn"
}

/** Compute file-based spatial pan: a-file = -0.9 (left), h-file = +0.9 (right) */
function fileToPan(square: string): number {
  const fileIdx = square.charCodeAt(0) - 97 // 0-7
  // Map 0..7 to -0.9..+0.9
  return -0.9 + (fileIdx / 7) * 1.8
}

export class SoundAgent {
  private voices: Record<string, BuiltVoice> = {}
  private cfg: SoundAgentConfig
  private traversal: Traversal | null = null
  private masterGain: Tone.Gain | null = null
  private limiter: Tone.Limiter | null = null
  private compressor: Tone.Compressor | null = null
  private initialized = false
  private disposed = false
  private initPromise: Promise<void> | null = null
  private masterVolume = 0.7
  private playbackRequest = 0
  private playbackListener: ((playing: boolean) => void) | null = null
  private releaseTimer: ReturnType<typeof setTimeout> | null = null
  private auditionTimer: ReturnType<typeof setTimeout> | null = null
  private noteQueue = new NoteQueue({
    now: () => Tone.now(),
    setTimeout: (callback, seconds) => Tone.getContext().setTimeout(callback, seconds),
    clearTimeout: (id) => { Tone.getContext().clearTimeout(id) },
  })
  private repeatId: number | null = null
  private stopId: number | null = null
  private running = false
  private droneActive = false
  private currentFen = ""
  private transition: PositionTransition | undefined
  private positionVersion = 0
  private handledPositionVersion = -1
  private static readonly TraversalParamsEmpty: Record<string, unknown> = {}

  // BUG-002 FIX: Cache Chess instance and pre-computed data to avoid per-tick allocation
  private cachedChess: Chess | null = null
  private cachedIntensity = 0
  private cachedMetrics: PositionMetrics | null = null
  private cachedBoardPieces: { square: string; type: string; color: "white" | "black" }[] = []

  constructor(cfg: SoundAgentConfig) {
    this.cfg = cfg
  }

  async init(): Promise<void> {
    if (this.disposed) return
    if (this.initPromise) return this.initPromise
    this.initPromise = (async () => {
      await Tone.start() // Resume the context on every user-initiated play or audition.
      if (this.disposed || this.initialized) return

      try {
        // Build master bus: Gain -> Compressor -> Limiter -> Output
        this.masterGain = new Tone.Gain(0)
        const headroomDb = this.cfg.limits?.hardHeadroomDb ?? 6
        this.compressor = new Tone.Compressor({ threshold: -18, ratio: 3, knee: 6 })
        this.limiter = new Tone.Limiter({ threshold: -Math.abs(headroomDb) })
        this.masterGain.connect(this.compressor)
        this.compressor.connect(this.limiter)
        this.limiter.connect(Tone.getDestination())

        this.applyTransport()
        this.buildVoices()
        this.traversal = this.buildTraversalForPosition(this.cachedChess ?? undefined)
        this.initialized = true
      } catch (error) {
        this.disposeNodes()
        throw error
      }
    })()
    try {
      await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  setTickDuration(ms: number): void {
    this.cfg.traversal.tickDurationMs = ms
    // If running, reschedule repeat with new interval
    if (this.running) {
      this.reschedule()
    }
  }

  setMasterVolume(v: number): void {
    if (!Number.isFinite(v)) return
    this.masterVolume = Math.max(0, Math.min(1, v))
    if (this.masterGain && (this.running || this.auditionTimer !== null)) {
      this.masterGain.gain.rampTo(this.masterVolume, 0.1)
    }
  }

  setPlaybackListener(listener: ((playing: boolean) => void) | null): void {
    this.playbackListener = listener
    listener?.(this.running)
  }

  private setRunning(playing: boolean): void {
    if (this.running === playing) return
    this.running = playing
    this.playbackListener?.(playing)
  }

  // Apply musical timing settings to the same transport used by the tick scheduler.
  private applyTransport(): void {
    const t = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    const c = this.cfg.transport || {}
    if (typeof c.bpm === "number") t.bpm.value = c.bpm
    if (typeof c.swing === "number") t.swing = c.swing
    if (Array.isArray(c.timeSignature)) {
      const sig = c.timeSignature as [number, number]
      (t as unknown as { timeSignature: number | [number, number] }).timeSignature = sig
    }
  }

  setTransport(opts: Partial<NonNullable<SoundAgentConfig["transport"]>>): void {
    const previousBpm = this.cfg.transport?.bpm
    this.cfg.transport = { ...(this.cfg.transport || {}), ...opts }
    if (!this.initialized) return
    this.applyTransport()
    // Tone converts a numeric seconds interval to transport ticks when scheduled.
    // Recreate it at the new tempo so the user's repeat interval remains in seconds.
    if (this.running && typeof opts.bpm === "number" && opts.bpm !== previousBpm) {
      this.reschedule()
    }
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
    this.playbackRequest++
    if (this.repeatId !== null || this.stopId !== null) {
      const transport = Tone.getTransport()
      if (this.repeatId !== null) transport.clear(this.repeatId)
      if (this.stopId !== null) transport.clear(this.stopId)
    }
    this.repeatId = null
    this.stopId = null
    this.clearReleaseTimers()
    this.setRunning(false)

    // AUDIO FADE FIX: Fade out over 100ms before releasing voices
    if (this.masterGain) {
      this.masterGain.gain.rampTo(0, 0.1)
    }

    this.cancelPositionNotes()

    // Release any envelopes where possible (after a short delay for fade-out)
    if (this.initialized) this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null
      Object.values(this.voices).forEach((v) => {
        if (v.node.releaseAll) v.node.releaseAll()
        else if (v.type === "Synth") v.node.triggerRelease?.()
        else if (v.type === "Player") v.node.stop?.()
      })
    }, 120)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    this.clearReleaseTimers()
    this.disposeNodes()
    this.cachedChess = null
    this.cachedMetrics = null
    this.playbackListener = null
  }

  private clearReleaseTimers(): void {
    if (this.releaseTimer !== null) clearTimeout(this.releaseTimer)
    if (this.auditionTimer !== null) clearTimeout(this.auditionTimer)
    this.releaseTimer = null
    this.auditionTimer = null
  }

  private disposeNodes(): void {
    Object.values(this.voices).forEach((voice) => {
      voice.node.dispose?.()
      voice.effects.forEach((effect) => effect.dispose())
    })
    this.voices = {}
    this.compressor?.dispose()
    this.compressor = null
    this.masterGain?.dispose()
    this.masterGain = null
    this.limiter?.dispose()
    this.limiter = null
    this.initialized = false
  }

  /** Cancel both queued motifs and notes already handed to Web Audio's lookahead. */
  private cancelPositionNotes(): void {
    this.noteQueue.clear()
    if (this.initialized) {
      const time = Tone.immediate()
      for (const voice of Object.values(this.voices)) {
        if (voice.type === "PolySynth" && voice.outstandingNotes?.length) {
          // The public API also marks PolySynth's note entries as released. Releasing
          // only its mono voices leaves stale entries that could steal a later note's release.
          voice.node.triggerRelease?.([...voice.outstandingNotes], time)
          voice.outstandingNotes.length = 0
        }
        for (const synth of voice.synths || []) {
          const envelopes = [synth.envelope, synth.modulationEnvelope].filter(
            (envelope): envelope is CancellableVoice["envelope"] => Boolean(envelope),
          )
          const releases = envelopes.map((envelope) => envelope.release)
          for (const envelope of envelopes) {
            // A future attack may still be silent now. release() alone would leave it scheduled.
            if (envelope.getValueAtTime(time) === 0) envelope.cancel(time)
            envelope.release = 0.02
          }
          synth.triggerRelease?.(time)
          envelopes.forEach((envelope, index) => { envelope.release = releases[index] })
        }
        if (!voice.synths?.size) {
          if (voice.node.releaseAll) voice.node.releaseAll(time)
          else if (voice.type === "Player") voice.node.stop?.(time)
        }
      }
    }
    this.droneActive = false
  }

  private scheduleNote = (voice: BuiltVoice, notes: NoteValue, duration: number, time: number, velocity: number): void => {
    // Separate attacks and releases so PolySynth never owns an untracked future timeout.
    this.noteQueue.schedule(time, (at) => { this.attackVoice(voice, notes, at, velocity) })
    this.noteQueue.schedule(time + duration, (at) => {
      if (voice.type === "Synth") voice.node.triggerRelease?.(at)
      else voice.node.triggerRelease?.(notes, at)
      if (voice.type === "PolySynth" && voice.outstandingNotes) {
        for (const note of Array.isArray(notes) ? notes : [notes]) {
          const midi = Tone.Midi(note).toMidi()
          const index = voice.outstandingNotes.findIndex((active) => Tone.Midi(active).toMidi() === midi)
          if (index !== -1) voice.outstandingNotes.splice(index, 1)
        }
      }
    })
  }

  private attackVoice(voice: BuiltVoice, notes: NoteValue, time: number, velocity: number): void {
    if (!voice.node.triggerAttack) return
    voice.node.triggerAttack(notes, time, velocity)
    if (voice.type === "PolySynth") {
      voice.outstandingNotes ??= []
      voice.outstandingNotes.push(...(Array.isArray(notes) ? notes : [notes]))
    }
  }

  setPosition(fen: string, transition?: PositionTransition): void {
    if (this.disposed) return
    this.transition = transition
    if (fen && fen !== this.currentFen) {
      const chess = new Chess(fen)
      this.cancelPositionNotes()
      this.currentFen = fen
      this.positionVersion += 1

      // BUG-002 FIX: Create Chess instance once on position change and cache everything
      this.cachedChess = chess
      this.cachedMetrics = calculatePositionMetrics(chess)
      this.cachedIntensity = this.cachedMetrics.intensity
      this.cachedBoardPieces = this.buildBoardSnapshot(this.cachedChess)

      // Rebuild traversal
      this.traversal = this.buildTraversalForPosition(this.cachedChess)

      // If running, process a tick immediately so the new position is heard without waiting
      if (this.running) {
        const now = Tone.now()
        this.processTick(now + 0.02)
      }
    }
  }

  async start(): Promise<void> {
    if (this.disposed) return
    const request = ++this.playbackRequest
    await this.init()
    if (this.disposed || request !== this.playbackRequest) return
    if (this.running) return
    this.clearReleaseTimers()
    this.setRunning(true)
    this.traversal?.reset()

    // AUDIO FADE FIX: Fade in over 50ms to eliminate click/pop on start
    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(Tone.now())
      this.masterGain.gain.setValueAtTime(0, Tone.now())
      this.masterGain.gain.rampTo(this.masterVolume, 0.05)
    }

    try {
      this.scheduleRepeat()
      this.scheduleClipStopIfNeeded()
    } catch (error) {
      this.stop()
      throw error
    }
  }

  private scheduleRepeat(): void {
    const transport = Tone.getTransport ? Tone.getTransport() : Tone.Transport
    const interval = (this.cfg.traversal?.tickDurationMs ?? 250) / 1000

    // Clear prior repeat if any
    if (this.repeatId !== null) {
      transport.clear(this.repeatId)
      this.repeatId = null
    }

    // BUG-002 FIX: Use cached Chess instance instead of creating new one per tick
    this.repeatId = transport.scheduleRepeat((time) => {
      if (!this.currentFen || !this.cachedChess) return
      this.processTick(time)
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

  /** Build board snapshot from chess instance - used for caching */
  private buildBoardSnapshot(chess: Chess): { square: string; type: string; color: "white" | "black" }[] {
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
    return boardPieces
  }

  // BUG-002 FIX: processTick now uses cached data instead of creating Chess instances
  private processTick(time: number): void {
    const chess = this.cachedChess
    if (!chess) return

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
        this.scheduleNote(voice, from, 0.08, time + 0.02, 0.7)
        this.scheduleNote(voice, to, 0.12, time + 0.11, 0.7)
      }
      // Checkmate cue sequence
      if (chess.isCheckmate() && this.cfg.events?.checkmate?.sequence && this.cfg.events.checkmate.sequence.length) {
        const seq = this.cfg.events.checkmate.sequence
        for (const ev of seq) {
          const v = this.voices[ev.voiceId]
          if (!v) continue
          const at = time + (ev.t || 0) / 1000
          const dur = (ev.d || 120) / 1000
          const vel = typeof ev.levelDb === "number" ? Math.max(0, Math.min(1, Math.pow(10, ev.levelDb / 20))) : 0.8
          this.scheduleNote(v, ev.note, dur, at, vel)
        }
      }
      // Only an actual forward capture is an event; loading or scrubbing is not a move.
      const attacker = captureSideForTransition(this.transition)
      if (attacker && this.cfg.events?.capture && this.voices[this.cfg.events.capture.voiceId]) {
        const v = this.voices[this.cfg.events.capture.voiceId]
        const spec = this.cfg.events.capture[attacker] || {}
        const note = spec.note || (attacker === "white" ? "C2" : "G1")
        const dur = (spec.durationMs ?? 160) / 1000
        const pan = spec.pan
        if (v.panner && typeof pan === "number") v.panner.pan.rampTo(pan, 0.01)
        this.scheduleNote(v, note, dur, time + 0.02, 0.9)
      }
    }

    // Use cached board snapshot (BUG-002 FIX)
    const boardPieces = this.cachedBoardPieces

    // Next traversal tick (rollover when done)
    let tick = this.traversal?.nextTick()
    if (!tick || tick.cells.length === 0) {
      // rebuild traversal in case strategy depends on current position
      this.traversal = this.buildTraversalForPosition(chess)
      tick = this.traversal?.nextTick()
    }
    if (!tick) return

    // Select events with spatial panning
    type Ev = { earcon: Earcon; color: "white" | "black"; pan?: number; pieceType: string; pitchOffset?: number; filterTintHz?: number; filePan: number }
    const events: Ev[] = []
    for (const cell of tick.cells) {
      const p = boardPieces.find((bp) => bp.square === cell)
      if (!p) continue
      const ear = this.cfg.mappings?.pieceEarcons?.[p.type]
      if (!ear) continue
      const colorCfg = this.cfg.colors?.[p.color]
      // SPATIAL PANNING: compute file-based pan for immersive stereo field
      const spatialPan = fileToPan(p.square)
      events.push({ earcon: ear, color: p.color, pan: colorCfg?.pan, pieceType: p.type, pitchOffset: colorCfg?.pitchShift, filterTintHz: colorCfg?.filterTint?.frequency, filePan: spatialPan })
    }

    // Apply voice priority if provided (piece-type based)
    const priority = (this.cfg.limits?.voicePriority || ["king", "queen", "rook", "bishop", "knight", "pawn"]) as string[]
    const rank: Record<string, number> = {}
    priority.forEach((name, idx) => { rank[name] = idx })
    events.sort((a, b) => (rank[a.pieceType] ?? 999) - (rank[b.pieceType] ?? 999))

    // Use pre-computed intensity (BUG-002 FIX)
    const factor = this.mapIntensityFactor(this.cachedIntensity)
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
      // SPATIAL PANNING: pass file-based pan
      scheduleEarconAt(baseAt, useEar, ev.color, ev.pan, transpose, ev.filterTintHz, this.voices, this.scheduleNote, ev.filePan)
      logThisTick.push({ piece: ev.pieceType, color: ev.color, at: baseAt })
    })

    if (this.cfg.diagnostics?.emitScheduleLog && import.meta.env.DEV) {
      console.log("[SoundAgent] tick", {
        cells: tick.cells,
        intensity: this.cachedIntensity.toFixed(2),
        selected: logThisTick.map((e) => ({ piece: e.piece, color: e.color, atMs: Math.round((e.at - time) * 1000) })),
      })
    }

    // Update or start drone if configured
    this.updateDrone(time)
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

  private buildTraversalForPosition(chess?: Chess): Traversal {
    const strat = this.cfg.traversal?.strategy || "rowSequential"
    const params = (this.cfg.traversal?.params || {}) as Record<string, unknown>
    return buildTraversal(strat, params, chess)
  }


  setTraversal(strategy: SoundAgentConfig["traversal"]["strategy"], params?: Record<string, unknown>): void {
    this.cfg.traversal = { ...(this.cfg.traversal || {}), strategy, params: params || SoundAgent.TraversalParamsEmpty }
    const chess = this.cachedChess ?? (this.currentFen ? new Chess(this.currentFen) : undefined)
    this.traversal = this.buildTraversalForPosition(chess)
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
    scheduleEarconAt(time, ear, color, c?.pan, pitchShift, filtHz, this.voices, this.scheduleNote)
  }

  playVoice(voiceId: string, note: string, durationMs = 200, velocity = 0.8, color: "white" | "black" = "white"): void {
    const v = this.voices[voiceId]
    if (!v) return
    const time = Tone.now() + 0.02
    const pan = this.cfg.colors?.[color]?.pan
    if (v.panner && Number.isFinite(pan)) v.panner.pan.rampTo(pan as number, 0.01)
    this.scheduleNote(v, note, durationMs / 1000, time, velocity)
  }

  /** User-gesture entry point for the tester, including before the first Play. */
  async auditionEarcon(pieceType: string, color: "white" | "black" = "white"): Promise<void> {
    const earcon = this.cfg.mappings?.pieceEarcons?.[pieceType]
    if (!earcon) return
    const request = this.playbackRequest
    await this.init()
    if (this.disposed || request !== this.playbackRequest) return
    const duration = Math.max(0, ...earcon.pattern.map((step) => {
      const arpeggioLength = step.arpeggio ? (step.arpeggio.length - 1) * (step.stepMs ?? 40) + 40 : 0
      return step.t + Math.max(step.d, arpeggioLength)
    }))
    this.openAuditionWindow(duration + 300)
    this.playEarcon(pieceType, color)
  }

  async auditionVoice(voiceId: string, note: string, durationMs = 200, velocity = 0.8, color: "white" | "black" = "white"): Promise<void> {
    const request = this.playbackRequest
    await this.init()
    if (this.disposed || request !== this.playbackRequest || !this.voices[voiceId]) return
    this.openAuditionWindow(durationMs + 300)
    this.playVoice(voiceId, note, durationMs, velocity, color)
  }

  private openAuditionWindow(durationMs: number): void {
    this.clearReleaseTimers()
    this.masterGain?.gain.rampTo(this.masterVolume, 0.01)
    if (this.running) return
    this.auditionTimer = setTimeout(() => {
      this.auditionTimer = null
      if (!this.running) this.stop()
    }, durationMs)
  }

  getTraversal(): SoundAgentConfig["traversal"] {
    // return a shallow clone to prevent external mutation affecting internals
    const t = this.cfg.traversal || { strategy: "rowSequential" as const, params: {} }
    return { ...t, params: { ...(t.params || {}) } }
  }

  // --- Drone scaling layer ---
  private updateDrone(time: number): void {
    const d = this.cfg.scaling?.drone
    if (!d) return
    const voice = this.voices[d.voiceId]
    if (!voice) return

    // start drone if not active
    if (!this.droneActive) {
      const vel = typeof d.levelDb === "number" ? Math.max(0, Math.min(1, Math.pow(10, d.levelDb / 20))) : 0.2
      if (typeof voice.node.triggerAttack === "function") {
        this.droneActive = true
        this.noteQueue.schedule(time + 0.02, (at) => { this.attackVoice(voice, d.baseNote, at, vel) })
      }
    }

    // compute material balance and map to filter frequency
    const delta = this.cachedMetrics?.materialBalance ?? 0
    const map = d.brightnessByMaterial
    if (map && voice.filter) {
      const target = materialBrightness(delta, map)
      voice.filter.frequency.rampTo(target, 0.2)
    }
  }
}
