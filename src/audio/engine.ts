import * as Tone from 'tone';
import { decodeBoardString, type Side, type PieceType, type Piece } from '../chess/compact';

export interface SoundPreset {
  id: string;
  name: string;
  description: string;
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
    piecePitchHz: Record<PieceType, number>;
    octaveShift: Record<Side, number>;
    volumeByValueDb: Record<PieceType, number>;
    tempoBaseBpm: number;
    tempoIntensityFactor: number;
    percussion: {
      capture: string;
      check: string;
    };
  };
}

export class SoundEngine {
  private synth: Tone.PolySynth | null = null;
  private percussion: Tone.NoiseSynth | null = null;
  private currentPreset: SoundPreset | null = null;
  private isPlaying = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentBoard: string = '';
  private tickIntervalMs = 1000;

  constructor() {
    this.initializeAudio();
  }

  private async initializeAudio() {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.005,
          decay: 0.12,
          sustain: 0.6,
          release: 0.24
        }
      }).toDestination();

      this.percussion = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0,
          release: 0.1
        }
      }).toDestination();

      console.log('Sound engine initialized');
    } catch (error) {
      console.error('Failed to initialize sound engine:', error);
    }
  }

  loadPreset(preset: SoundPreset) {
    this.currentPreset = preset;

    if (!this.synth) return;

    this.synth.set({
      oscillator: { type: preset.engine.oscillator as any },
      envelope: {
        attack: preset.engine.envelope.attackMs / 1000,
        decay: preset.engine.envelope.decayMs / 1000,
        sustain: preset.engine.envelope.sustain,
        release: preset.engine.envelope.releaseMs / 1000
      }
    });

    this.synth.maxPolyphony = preset.engine.polyphony;
    console.log(`Loaded preset: ${preset.name}`);
  }

  setTickInterval(intervalMs: number) {
    this.tickIntervalMs = intervalMs;
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  setBoardState(boardString: string) {
    this.currentBoard = boardString;
  }

  play() {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.tickInterval = setInterval(() => {
      this.processTick();
    }, this.tickIntervalMs);

    console.log('Sound engine started');
  }

  stop() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.synth?.releaseAll();
    console.log('Sound engine stopped');
  }

  private processTick() {
    if (!this.currentPreset || !this.synth || !this.currentBoard) return;

    try {
      const pieces = decodeBoardString(this.currentBoard);
      this.playPosition(pieces);
    } catch (error) {
      console.error('Error processing tick:', error);
    }
  }

  private playPosition(pieces: Piece[]) {
    if (!this.currentPreset || !this.synth) return;

    const activePieces = pieces.slice(0, this.currentPreset.engine.polyphony);

    this.synth.releaseAll();

    setTimeout(() => {
      activePieces.forEach((piece, index) => {
        this.playPiece(piece, index * 50);
      });
    }, 10);
  }

  private playPiece(piece: Piece, delay: number) {
    if (!this.currentPreset || !this.synth) return;

    try {
      const basePitch = this.currentPreset.mapping.piecePitchHz[piece.type];
      const octaveShift = this.currentPreset.mapping.octaveShift[piece.side];
      const volumeDb = this.currentPreset.mapping.volumeByValueDb[piece.type];

      if (basePitch) {
        const frequency = basePitch * Math.pow(2, octaveShift);
        const volume = Tone.dbToGain(volumeDb);

        setTimeout(() => {
          this.synth?.triggerAttackRelease(frequency, '0.5', undefined, volume);
        }, delay);
      }
    } catch (error) {
      console.error('Error playing piece:', error);
    }
  }

  triggerCapture() {
    if (this.percussion) {
      this.percussion.triggerAttackRelease('16n');
    }
  }

  triggerCheck() {
    if (this.percussion) {
      this.percussion.triggerAttackRelease('32n');
    }
  }

  dispose() {
    this.stop();
    this.synth?.dispose();
    this.percussion?.dispose();
  }
}
