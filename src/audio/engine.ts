import * as Tone from 'tone';
import type { Piece } from '../chess/compact';

export type HarmonicPreset = {
  id: string;
  engine: {
    oscillator: string;
    envelope: {
      attackMs: number;
      decayMs: number;
      sustain: number;
      releaseMs: number;
    };
    polyphony: number;
  };
  mapping: {
    piecePitchHz: Record<string, number>;
    octaveShift: Record<string, number>;
  };
};

export class AudioAgent {
  private synth: Tone.PolySynth;
  private preset: HarmonicPreset;
  constructor(preset: HarmonicPreset) {
    this.preset = preset;
    const opts = {
      oscillator: { type: preset.engine.oscillator as Tone.ToneOscillatorType },
      envelope: {
        attack: preset.engine.envelope.attackMs / 1000,
        decay: preset.engine.envelope.decayMs / 1000,
        sustain: preset.engine.envelope.sustain,
        release: preset.engine.envelope.releaseMs / 1000,
      } as Partial<Tone.EnvelopeOptions>,
    } as Tone.SynthOptions;
    this.synth = new Tone.PolySynth(Tone.Synth, opts).toDestination();
  }

  start(pieces: Piece[], tickSeconds: number) {
    Tone.Transport.cancel();
    Tone.Transport.scheduleRepeat(() => this.playBoard(pieces), tickSeconds);
    Tone.Transport.start();
  }

  playBoard(pieces: Piece[]) {
    const max = this.preset.engine.polyphony;
    pieces.slice(0, max).forEach((p) => {
      const base = this.preset.mapping.piecePitchHz[p.type];
      const shift = this.preset.mapping.octaveShift[p.side];
      const freq = base * Math.pow(2, shift);
      this.synth.triggerAttackRelease(freq, '8n');
    });
  }
}
