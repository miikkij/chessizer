import assert from "node:assert/strict"
import test, { type TestContext } from "node:test"
import * as Tone from "tone"
import { Chess } from "chess.js"
import { NoteQueue, type AudioClock } from "../src/audio/NoteQueue.ts"
import { SoundAgent, type SoundAgentConfig } from "../src/audio/SoundAgent.ts"

class TestClock implements AudioClock {
  time = 0
  private nextId = 0
  pending = new Map<number, { at: number; callback: () => void }>()

  now() { return this.time }
  setTimeout(callback: () => void, seconds: number) {
    const id = ++this.nextId
    this.pending.set(id, { at: this.time + seconds, callback })
    return id
  }
  clearTimeout(id: number) { this.pending.delete(id) }
  advance(to: number) {
    for (;;) {
      const next = [...this.pending.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > to) break
      this.time = next[1].at
      this.pending.delete(next[0])
      next[1].callback()
    }
    this.time = to
  }
}

test("note queue preserves exact audio times and rejects an already dequeued stale callback", () => {
  const clock = new TestClock()
  const queue = new NoteQueue(clock)
  const notes: number[] = []
  queue.schedule(0.125, (time) => notes.push(time))
  const stale = [...clock.pending.values()][0].callback
  queue.clear()
  clock.time = 0.2
  stale()
  assert.equal(notes.length, 0)
  queue.schedule(0.375, (time) => notes.push(time))
  clock.advance(0.5)
  assert.deepEqual(notes, [0.375])
})

const config: SoundAgentConfig = {
  version: "1.0",
  name: "queued-arpeggio",
  traversal: { strategy: "rowSequential" },
  mappings: { pieceEarcons: {
    queen: {
      voiceId: "queen",
      register: { white: "C4", black: "C3" },
      pattern: [{ t: 0, arpeggio: ["0", "4", "7"], stepMs: 100, d: 40 }],
    },
  } },
}

function makeAgent(t: TestContext, lookAhead = 0) {
  const clock = new TestClock()
  clock.time = lookAhead
  const original = Tone.getContext()
  Tone.setContext({
    now: () => clock.now(),
    immediate: () => clock.now() - lookAhead,
    setTimeout: (callback: () => void, seconds: number) => clock.setTimeout(callback, seconds),
    clearTimeout: (id: number) => clock.clearTimeout(id),
  } as unknown as ReturnType<typeof Tone.getContext>)
  const attacks: Array<{ note: unknown; time: number }> = []
  const releases: number[] = []
  const synths = new Set<unknown>()
  const node = {
    triggerAttack: (note: unknown, time: number) => attacks.push({ note, time }),
    triggerRelease: (_note: unknown, time: number) => releases.push(time),
    releaseAll: () => undefined,
    dispose: () => undefined,
  }
  const agent = new SoundAgent(structuredClone(config))
  Object.assign(agent, {
    initialized: true,
    voices: {
      queen: {
        type: "PolySynth",
        node,
        effects: [],
        synths,
      },
    },
  })
  t.after(() => {
    agent.dispose()
    Tone.setContext(original)
  })
  return { agent, clock, attacks, releases, synths, node }
}

test("changing position cancels the previous arpeggio's future notes and permits the new version", (t) => {
  const { agent, clock, attacks } = makeAgent(t)
  const chess = new Chess()
  agent.setPosition(chess.fen(), { kind: "load", move: null })
  agent.playEarcon("queen", "white", 0)
  clock.advance(0.05)
  assert.equal(attacks.length, 1)
  const move = chess.move("e4")
  agent.setPosition(chess.fen(), { kind: "forward", move })
  agent.playEarcon("queen", "black", 0)
  clock.advance(0.5)
  assert.deepEqual(attacks.map(({ time }) => Math.round(time * 1000)), [0, 50, 150, 250])
  assert.equal(attacks[1].note, Tone.Frequency("C3").toFrequency())
})

test("stop cancels every remaining arpeggio attack and release", (t) => {
  const { agent, clock, attacks, releases } = makeAgent(t)
  agent.playEarcon("queen", "white", 0)
  clock.advance(0.05)
  agent.stop()
  const releaseCount = releases.length
  clock.advance(1)
  assert.equal(attacks.length, 1)
  assert.equal(releases.length, releaseCount)
  assert.equal(clock.pending.size, 0)
})

test("position invalidation cancels a silent future envelope already in the audio lookahead window", (t) => {
  const { agent, synths, attacks } = makeAgent(t, 0.1)
  const canceled: number[] = []
  const fades: Array<{ at: unknown; seconds: number }> = []
  const envelope = {
    release: 0.8,
    getValueAtTime: () => 0,
    cancel: (at: number) => canceled.push(at),
  }
  synths.add({ envelope, triggerRelease: (at: unknown) => fades.push({ at, seconds: envelope.release }) })
  agent.playEarcon("queen", "white", 0)
  assert.equal(attacks[0].time, 0.1, "attack has been handed off ahead of audible time")
  agent.setPosition(new Chess().fen())
  assert.deepEqual(canceled, [0])
  assert.deepEqual(fades, [{ at: 0, seconds: 0.02 }])
  assert.equal(envelope.release, 0.8, "the configured release remains unchanged for subsequent notes")
})

test("active envelope tails use a short release while preserving their instantaneous level", (t) => {
  const { agent, synths } = makeAgent(t)
  let canceled = false
  let fadeSeconds = 0
  const envelope = {
    release: 1,
    getValueAtTime: () => 0.5,
    cancel: () => { canceled = true },
  }
  synths.add({ envelope, triggerRelease: () => { fadeSeconds = envelope.release } })
  agent.stop()
  assert.equal(canceled, false, "Tone's release ramp must preserve the current active level")
  assert.equal(fadeSeconds, 0.02)
  assert.equal(envelope.release, 1)
})

test("a canceled PolySynth entry cannot steal the next same-pitch note's release", (t) => {
  const { agent, clock, node } = makeAgent(t, 0.1)
  const calls: Array<{ voice: number; time: number }> = []
  const entries: Array<{ midi: number; voice: { triggerRelease(time: number): void }; released: boolean }> = []

  // Seed allocation state only in this fixture. Release bookkeeping runs the installed
  // Tone.PolySynth implementation, including its matching of the oldest unreleased note.
  const poly = Object.create(Tone.PolySynth.prototype) as Tone.PolySynth
  Object.defineProperty(poly, "context", { value: {
    get currentTime() { return clock.now() - 0.1 }, lookAhead: 0.1, sampleRate: 48000,
  } })
  Object.defineProperty(poly, "_activeVoices", { value: entries })
  Object.assign(node, {
    triggerAttack: (notes: string | number | Array<string | number>) => {
      for (const note of Array.isArray(notes) ? notes : [notes]) {
        const voice = entries.length
        entries.push({
          midi: Tone.Midi(note).toMidi(), released: false,
          voice: { triggerRelease: (time) => { calls.push({ voice, time }) } },
        })
      }
    },
    triggerRelease: (notes: string | number | Array<string | number>, time: number) => poly.triggerRelease(notes, time),
  })

  const chess = new Chess()
  agent.setPosition(chess.fen())
  agent.playVoice("queen", "C4", 40)
  clock.advance(0.13)
  assert.equal(entries.length, 1)
  chess.move("e4")
  agent.setPosition(chess.fen())
  assert.equal(entries[0].released, true, "cancellation must update PolySynth's own released flag")

  agent.playVoice("queen", "C4", 40)
  clock.advance(0.25)
  assert.equal(entries.length, 2)
  assert.deepEqual(entries.map(({ released }) => released), [true, true])
  assert.deepEqual(calls.map(({ voice }) => voice), [0, 1])
})
