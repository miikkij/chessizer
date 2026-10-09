export interface AudioClock {
  now(): number
  setTimeout(callback: () => void, seconds: number): number
  clearTimeout(id: number): void
}

/** Own the future notes until they reach Tone's audio scheduling window. */
export class NoteQueue {
  private generation = 0
  private timers = new Set<number>()
  private readonly clock: AudioClock

  constructor(clock: AudioClock) { this.clock = clock }

  schedule(time: number, play: (time: number) => void): void {
    const generation = this.generation
    const dispatch = () => {
      if (generation !== this.generation) return
      const remaining = time - this.clock.now()
      if (remaining <= 0) {
        play(time)
        return
      }
      const id = this.clock.setTimeout(() => {
        this.timers.delete(id)
        dispatch()
      }, remaining)
      this.timers.add(id)
    }
    dispatch()
  }

  clear(): void {
    this.generation++
    for (const id of this.timers) this.clock.clearTimeout(id)
    this.timers.clear()
  }
}
