import assert from "node:assert/strict"
import test, { type TestContext } from "node:test"
import * as Tone from "tone"
import { SoundAgent, type SoundAgentConfig } from "../src/audio/SoundAgent.ts"

const config: SoundAgentConfig = {
  version: "1.0",
  name: "lifecycle-test",
  traversal: { strategy: "rowSequential", tickDurationMs: 1000 },
}

/** Mock the audio boundary; exercise the public agent lifecycle without a browser. */
function harness(t: TestContext) {
  const original = Tone.getContext()
  const ramps: number[] = []
  const scheduled = new Map<number, () => void>()
  const repeatTicks = new Map<number, number>()
  let nextId = 0
  let resumes = 0
  let releases = 0
  let sourceDisposals = 0
  let effectDisposals = 0
  let busDisposals = 0
  const transport = {
    state: "started",
    bpm: { value: 120 },
    scheduleRepeat: (_callback: () => void, seconds: number) => {
      const id = ++nextId
      // Tone's transport stores seconds-based schedule arguments in musical ticks.
      repeatTicks.set(id, seconds * transport.bpm.value / 60)
      return id
    },
    scheduleOnce: (callback: () => void) => {
      const id = ++nextId
      scheduled.set(id, callback)
      return id
    },
    clear: (id: number) => {
      scheduled.delete(id)
      repeatTicks.delete(id)
    },
  }
  Tone.setContext({
    resume: async () => { resumes++ },
    now: () => 0,
    immediate: () => 0,
    transport,
  } as unknown as ReturnType<typeof Tone.getContext>)

  const agent = new SoundAgent({ ...config, limits: { clipLengthMs: 1000 } })
  Object.assign(agent, {
    initialized: true,
    masterGain: {
      gain: {
        cancelScheduledValues: () => undefined,
        setValueAtTime: () => undefined,
        rampTo: (volume: number) => ramps.push(volume),
      },
      dispose: () => { busDisposals++ },
    },
    voices: {
      test: {
        type: "PolySynth",
        node: {
          releaseAll: () => { releases++ },
          dispose: () => { sourceDisposals++ },
        },
        effects: [
          { dispose: () => { effectDisposals++ } },
          { dispose: () => { effectDisposals++ } },
        ],
      },
    },
  })
  t.after(() => {
    agent.dispose()
    Tone.setContext(original)
  })
  return {
    agent, ramps, scheduled,
    repeatSeconds: () => [...repeatTicks.values()].map(ticks => ticks * 60 / transport.bpm.value),
    counts: () => ({ resumes, releases, sourceDisposals, effectDisposals, busDisposals }),
  }
}

test("play and resume preserve a selected mute level, then honor volume changes", async (t) => {
  const { agent, ramps, counts } = harness(t)
  agent.setMasterVolume(0)
  await agent.start()
  assert.equal(ramps.at(-1), 0)
  agent.stop()
  await agent.start()
  assert.equal(ramps.at(-1), 0)
  agent.setMasterVolume(0.25)
  assert.equal(ramps.at(-1), 0.25)
  agent.stop()
  await agent.start()
  assert.equal(ramps.at(-1), 0.25)
  assert.equal(counts().resumes, 3)
})

test("scheduled clip stop updates playback state and a fast resume cancels stale release", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { agent, scheduled, counts } = harness(t)
  const states: boolean[] = []
  agent.setPlaybackListener((playing) => states.push(playing))
  await agent.start()
  const stopClip = [...scheduled.values()][0]
  stopClip()
  assert.deepEqual(states, [false, true, false])
  const releasedAtStop = counts().releases
  await agent.start()
  t.mock.timers.tick(150)
  assert.equal(counts().releases, releasedAtStop, "the previous stop must not release the resumed voices")
})

test("dispose cancels schedules and releases sources, every effect, and the master bus once", async (t) => {
  const { agent, scheduled, counts } = harness(t)
  await agent.start()
  agent.dispose()
  agent.dispose()
  assert.equal(scheduled.size, 0)
  assert.equal(counts().sourceDisposals, 1)
  assert.equal(counts().effectDisposals, 2)
  assert.equal(counts().busDisposals, 1)
  await agent.init()
  await agent.start()
  assert.equal(counts().resumes, 1, "a disposed agent cannot resume or rebuild audio nodes")
})

test("stop and dispose work before the first audio gesture", async () => {
  const agent = new SoundAgent(config)
  agent.stop()
  agent.dispose()
  agent.dispose()
  await agent.init()
  await agent.start()
})

test("a stop requested during asynchronous resume prevents delayed playback", async (t) => {
  const { agent, scheduled } = harness(t)
  let finishResume: (() => void) | undefined
  Object.assign(Tone.getContext(), {
    resume: () => new Promise<void>((resolve) => { finishResume = resolve }),
  })
  const states: boolean[] = []
  agent.setPlaybackListener((playing) => states.push(playing))
  const pending = agent.start()
  agent.stop()
  finishResume?.()
  await pending
  assert.deepEqual(states, [false])
  assert.equal(scheduled.size, 0)
})

test("changing tempo preserves the user-selected seconds between position repeats", async (t) => {
  const { agent, repeatSeconds } = harness(t)
  await agent.start()
  assert.deepEqual(repeatSeconds(), [1])
  agent.setTransport({ bpm: 60 })
  assert.deepEqual(repeatSeconds(), [1])
  agent.setTickDuration(250)
  agent.setTransport({ bpm: 180 })
  assert.deepEqual(repeatSeconds(), [0.25])
})

test("transport settings before the first gesture do not access an audio transport", (t) => {
  const original = Tone.getContext()
  Tone.setContext({
    get transport() { throw new Error("Audio must remain inactive before the user gesture") },
  } as unknown as ReturnType<typeof Tone.getContext>)
  t.after(() => Tone.setContext(original))
  const agent = new SoundAgent(config)
  agent.setTransport({ bpm: 90, swing: 0.2 })
  agent.dispose()
})

test("unmount during asynchronous audio activation prevents graph creation", async (t) => {
  const original = Tone.getContext()
  let finishResume: (() => void) | undefined
  Tone.setContext({
    resume: () => new Promise<void>((resolve) => { finishResume = resolve }),
  } as unknown as ReturnType<typeof Tone.getContext>)
  t.after(() => Tone.setContext(original))
  const agent = new SoundAgent(config)
  const pending = agent.init()
  agent.dispose()
  finishResume?.()
  await pending
  await agent.start()
})
