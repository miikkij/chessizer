import * as Tone from 'tone';import * as Tone from 'tone';import * as Tone from 'tone';import * as Tone from 'tone'; import * as Tone from 'tone';

import { decodeBoardString, type Side, type PieceType, type Piece } from '../chess/compact';

import { decodeBoardString, type Side, type PieceType, type Piece } from '../chess/compact';

export interface SoundPreset {

  id: string;import { decodeBoardString, type Side, type PieceType, type Piece } from '../chess/compact';

  name: string;

  description: string;export interface SoundPreset {

  engine: {

    oscillator: string;  id: string;import { decodeBoardString, type Side, type PieceType, type Piece } from '../chess/compact'; import { decodeBoardString, type CompactBoardState, type Side, type PieceType } from '../chess/compact';

    envelope: {

      attackMs: number;  name: string;

      decayMs: number;

      sustain: number;  description: string;export interface SoundPreset {

      releaseMs: number;

    };  engine: {

    polyphony: number;

  };    oscillator: string;  id: string;

  mapping: {

    piecePitchHz: Record<PieceType, number>;    envelope: {

    octaveShift: Record<Side, number>;

    volumeByValueDb: Record<PieceType, number>;      attackMs: number;  name: string;

    tempoBaseBpm: number;

    tempoIntensityFactor: number;      decayMs: number;

    percussion: {

      capture: string;      sustain: number;  description: string;export interface SoundPreset {export interface SoundPreset {

      check: string;

    };      releaseMs: number;

  };

}    };  engine: {



export class SoundEngine {    polyphony: number;

  private synth: Tone.PolySynth | null = null;

  private percussion: Tone.NoiseSynth | null = null;  };    oscillator: string;  id: string; id: string;

  private currentPreset: SoundPreset | null = null;

  private isPlaying = false;  mapping: {

  private tickInterval: NodeJS.Timeout | null = null;

  private currentBoard: string = '';    piecePitchHz: Record<PieceType, number>;    envelope: {

  private tickIntervalMs = 1000;

    octaveShift: Record<Side, number>;

  constructor() {

    this.initializeAudio();    volumeByValueDb: Record<PieceType, number>;      attackMs: number;  name: string; name: string;

  }

    tempoBaseBpm: number;

  private async initializeAudio() {

    try {    tempoIntensityFactor: number;      decayMs: number;

      if (Tone.context.state !== 'running') {

        await Tone.start();    percussion: {

      }

      capture: string;      sustain: number;  description: string; description: string;

      this.synth = new Tone.PolySynth(Tone.Synth, {

        oscillator: { type: 'sine' },      check: string;

        envelope: {

          attack: 0.005,    };      releaseMs: number;

          decay: 0.12,

          sustain: 0.6,  };

          release: 0.24

        }}    };  engine: {

      }).toDestination();



      this.percussion = new Tone.NoiseSynth({

        noise: { type: 'white' },export interface SoundDefaults {    polyphony: number;    engine: {

        envelope: {

          attack: 0.001,  tickIntervalMs: number;

          decay: 0.1,

          sustain: 0,  compressor: {  };

          release: 0.1

        }    threshold: number;

      }).toDestination();

    ratio: number;  mapping: {      oscillator: string; oscillator: string;

      console.log('Sound engine initialized');

    } catch (error) {  };

      console.error('Failed to initialize sound engine:', error);

    }}    piecePitchHz: Record<PieceType, number>;

  }



  loadPreset(preset: SoundPreset) {

    this.currentPreset = preset;export class SoundEngine {    octaveShift: Record<Side, number>;      envelope: {

    

    if (!this.synth) return;  private synth: Tone.PolySynth | null = null;



    this.synth.set({  private percussion: Tone.NoiseSynth | null = null;    volumeByValueDb: Record<PieceType, number>;        envelope: {

      oscillator: { type: preset.engine.oscillator as any },

      envelope: {  private currentPreset: SoundPreset | null = null;

        attack: preset.engine.envelope.attackMs / 1000,

        decay: preset.engine.envelope.decayMs / 1000,  private isPlaying = false;    tempoBaseBpm: number;

        sustain: preset.engine.envelope.sustain,

        release: preset.engine.envelope.releaseMs / 1000  private tickInterval: NodeJS.Timeout | null = null;

      }

    });  private currentBoard: string = '';    tempoIntensityFactor: number;          attackMs: number; attackMs: number;



    this.synth.maxPolyphony = preset.engine.polyphony;  private tickIntervalMs = 1000;

    console.log(`Loaded preset: ${preset.name}`);

  }    percussion: {



  setTickInterval(intervalMs: number) {  constructor() {

    this.tickIntervalMs = intervalMs;

    if (this.isPlaying) {    this.initializeAudio();      capture: string;          decayMs: number; decayMs: number;

      this.stop();

      this.play();  }

    }

  }      check: string;



  setBoardState(boardString: string) {  private async initializeAudio() {

    this.currentBoard = boardString;

  }    try {    };          sustain: number; sustain: number;



  play() {      // Initialize Tone.js audio context

    if (this.isPlaying) return;

          if (Tone.context.state !== 'running') {  };

    this.isPlaying = true;

    this.tickInterval = setInterval(() => {        await Tone.start();

      this.processTick();

    }, this.tickIntervalMs);      }}          releaseMs: number; releaseMs: number;



    console.log('Sound engine started');

  }

      // Create basic synth

  stop() {

    if (!this.isPlaying) return;      this.synth = new Tone.PolySynth(Tone.Synth, {

    

    this.isPlaying = false;        oscillator: { type: 'sine' },export interface SoundDefaults {        };

    if (this.tickInterval) {

      clearInterval(this.tickInterval);        envelope: {

      this.tickInterval = null;

    }          attack: 0.005,  tickIntervalMs: number;      };



    this.synth?.releaseAll();          decay: 0.12,

    console.log('Sound engine stopped');

  }          sustain: 0.6,  compressor: {



  private processTick() {          release: 0.24

    if (!this.currentPreset || !this.synth || !this.currentBoard) return;

        }    threshold: number;      polyphony: number; polyphony: number;

    try {

      const pieces = decodeBoardString(this.currentBoard);      }).toDestination();

      this.playPosition(pieces);

    } catch (error) {    ratio: number;

      console.error('Error processing tick:', error);

    }      // Create percussion synth

  }

      this.percussion = new Tone.NoiseSynth({  };    };

  private playPosition(pieces: Piece[]) {

    if (!this.currentPreset || !this.synth) return;        noise: { type: 'white' },



    const activePieces = pieces.slice(0, this.currentPreset.engine.polyphony);        envelope: {}  };

    

    this.synth.releaseAll();          attack: 0.001,



    setTimeout(() => {          decay: 0.1,

      activePieces.forEach((piece, index) => {

        this.playPiece(piece, index * 50);          sustain: 0,

      });

    }, 10);          release: 0.1export class SoundEngine {  mapping: {

  }

        }

  private playPiece(piece: Piece, delay: number) {

    if (!this.currentPreset || !this.synth) return;      }).toDestination();  private synth: Tone.PolySynth | null = null;    mapping: {



    try {

      const basePitch = this.currentPreset.mapping.piecePitchHz[piece.type];

      const octaveShift = this.currentPreset.mapping.octaveShift[piece.side];      console.log('Sound engine initialized');  private percussion: Tone.NoiseSynth | null = null;

      const volumeDb = this.currentPreset.mapping.volumeByValueDb[piece.type];

          } catch (error) {

      if (basePitch) {

        const frequency = basePitch * Math.pow(2, octaveShift);      console.error('Failed to initialize sound engine:', error);  private currentPreset: SoundPreset | null = null;      piecePitchHz: Record<PieceType, number>; piecePitchHz: Record<PieceType, number>;

        const volume = Tone.dbToGain(volumeDb);

            }

        setTimeout(() => {

          this.synth?.triggerAttackRelease(frequency, '0.5', undefined, volume);  }  private isPlaying = false;

        }, delay);

      }

    } catch (error) {

      console.error('Error playing piece:', error);  loadPreset(preset: SoundPreset) {  private tickInterval: NodeJS.Timeout | null = null;      octaveShift: Record<Side, number>; octaveShift: Record<Side, number>;

    }

  }    this.currentPreset = preset;



  triggerCapture() {      private currentBoard: string = '';

    if (this.percussion) {

      this.percussion.triggerAttackRelease('16n');    if (!this.synth) return;

    }

  }  private tickIntervalMs = 1000;      volumeByValueDb: Record<PieceType, number>; volumeByValueDb: Record<PieceType, number>;



  triggerCheck() {    // Update synth with preset settings

    if (this.percussion) {

      this.percussion.triggerAttackRelease('32n');    this.synth.set({

    }

  }      oscillator: { type: preset.engine.oscillator as any },



  dispose() {      envelope: {  constructor() {      tempoBaseBpm: number; tempoBaseBpm: number;

    this.stop();

    this.synth?.dispose();        attack: preset.engine.envelope.attackMs / 1000,

    this.percussion?.dispose();

  }        decay: preset.engine.envelope.decayMs / 1000,    this.initializeAudio();

}
        sustain: preset.engine.envelope.sustain,

        release: preset.engine.envelope.releaseMs / 1000  }      tempoIntensityFactor: number; tempoIntensityFactor: number;

      }

    });



    // Set polyphony  private async initializeAudio() {      percussion: {

    this.synth.maxPolyphony = preset.engine.polyphony;

    try {        percussion: {

    console.log(`Loaded preset: ${preset.name}`);

  }      // Initialize Tone.js audio context



  setTickInterval(intervalMs: number) {      if (Tone.context.state !== 'running') {          capture: string; capture: string;

    this.tickIntervalMs = intervalMs;

    if (this.isPlaying) {        await Tone.start();

      this.stop();

      this.play();      }          check: string; check: string;

    }

  }



  setBoardState(boardString: string) {      // Create basic synth        };

    this.currentBoard = boardString;

  }      this.synth = new Tone.PolySynth(Tone.Synth, {      };



  play() {        oscillator: { type: 'sine' },

    if (this.isPlaying) return;

            envelope: {    };

    this.isPlaying = true;

    this.tickInterval = setInterval(() => {          attack: 0.005,  };

      this.processTick();

    }, this.tickIntervalMs);          decay: 0.12,



    console.log('Sound engine started');          sustain: 0.6,}}

  }

          release: 0.24

  stop() {

    if (!this.isPlaying) return;        }

    

    this.isPlaying = false;      }).toDestination();

    if (this.tickInterval) {

      clearInterval(this.tickInterval);export class SoundEngine {export interface SoundDefaults {

      this.tickInterval = null;

    }      // Create percussion synth



    // Stop all playing notes      this.percussion = new Tone.NoiseSynth({  private synth: Tone.PolySynth | null = null; tickIntervalMs: number;

    this.synth?.releaseAll();

        noise: { type: 'white' },

    console.log('Sound engine stopped');

  }        envelope: {  private percussion: Tone.NoiseSynth | null = null; compressor: {



  private processTick() {          attack: 0.001,

    if (!this.currentPreset || !this.synth || !this.currentBoard) return;

          decay: 0.1,    private currentPreset: SoundPreset | null = null; threshold: number;

    try {

      const pieces = decodeBoardString(this.currentBoard);          sustain: 0,

      

      // Calculate intensity and material balance          release: 0.1  private isPlaying = false; ratio: number;

      const intensity = this.calculateIntensity(pieces);

      const materialBalance = this.calculateMaterialBalance(pieces);        }

      

      // Generate notes for current position      }).toDestination();  private tickInterval: NodeJS.Timeout | null = null;  };

      this.playPosition(pieces, intensity, materialBalance);

      

    } catch (error) {

      console.error('Error processing tick:', error);      console.log('Sound engine initialized');  private currentBoard: string = '';}

    }

  }    } catch (error) {



  private calculateIntensity(pieces: Piece[]): number {      console.error('Failed to initialize sound engine:', error);  private tickIntervalMs = 1000;

    // Simplified intensity calculation

    const totalPieces = pieces.length;    }

    return Math.min(totalPieces / 32, 1); // Normalize to 0-1

  }  }export class SoundEngine {



  private calculateMaterialBalance(pieces: Piece[]): number {

    const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

    let whiteValue = 0;  loadPreset(preset: SoundPreset) {  constructor() {  private synth: Tone.PolySynth | null = null;

    let blackValue = 0;

    this.currentPreset = preset;

    pieces.forEach(piece => {

      const value = values[piece.type] || 0;        this.initializeAudio();  private percussion: Tone.NoiseSynth | null = null;

      if (piece.side === 'white') {

        whiteValue += value;    if (!this.synth) return;

      } else {

        blackValue += value;  }  private currentPreset: SoundPreset | null = null;

      }

    });    // Update synth with preset settings



    return (whiteValue - blackValue) / 39; // Normalize to -1 to 1    this.synth.set({  private isPlaying = false;

  }

      oscillator: { type: preset.engine.oscillator as any },

  private playPosition(pieces: Piece[], intensity: number, materialBalance: number) {

    if (!this.currentPreset || !this.synth) return;      envelope: {  private async initializeAudio() {  private tickInterval: NodeJS.Timeout | null = null;



    // Limit to polyphony        attack: preset.engine.envelope.attackMs / 1000,

    const activePieces = pieces.slice(0, this.currentPreset.engine.polyphony);

            decay: preset.engine.envelope.decayMs / 1000,  try {  private currentBoard: string = '';

    // Calculate tempo based on intensity

    const tempo = this.currentPreset.mapping.tempoBaseBpm *         sustain: preset.engine.envelope.sustain,

      (1 + this.currentPreset.mapping.tempoIntensityFactor * intensity);

        release: preset.engine.envelope.releaseMs / 1000    // Initialize Tone.js audio context  private tickIntervalMs = 1000;

    // Stop previous notes

    this.synth.releaseAll();      }



    // Play notes for each piece    });    if (Tone.context.state !== 'running') {

    setTimeout(() => {

      activePieces.forEach((piece, index) => {

        this.playPiece(piece, index * 50); // Slight delay for chord effect

      });    // Set polyphony      await Tone.start(); constructor() {

    }, 10);

  }    this.synth.maxPolyphony = preset.engine.polyphony;



  private playPiece(piece: Piece, delay: number) {      } this.initializeAudio();

    if (!this.currentPreset || !this.synth) return;

    console.log(`Loaded preset: ${preset.name}`);

    try {

      const basePitch = this.currentPreset.mapping.piecePitchHz[piece.type];  }    }

      const octaveShift = this.currentPreset.mapping.octaveShift[piece.side];

      const volumeDb = this.currentPreset.mapping.volumeByValueDb[piece.type];

      

      if (basePitch) {  setTickInterval(intervalMs: number) {    // Create basic synth

        const frequency = basePitch * Math.pow(2, octaveShift);

        const volume = Tone.dbToGain(volumeDb);    this.tickIntervalMs = intervalMs;

        

        setTimeout(() => {    if (this.isPlaying) {    this.synth = new Tone.PolySynth(Tone.Synth, {

          this.synth?.triggerAttackRelease(frequency, '0.5', undefined, volume);

        }, delay);      this.stop();      private async initializeAudio() {

      }

    } catch (error) {      this.play();

      console.error('Error playing piece:', error);

    }    }        oscillator: { type: 'sine' }, try {

  }

  }

  triggerCapture() {

    if (this.percussion && this.currentPreset) {          envelope: {      // Initialize Tone.js audio context

      this.percussion.triggerAttackRelease('16n');

    }  setBoardState(boardString: string) {

  }

    this.currentBoard = boardString;            attack: 0.005,      if (Tone.context.state !== 'running') {

  triggerCheck() {

    if (this.percussion && this.currentPreset) {  }

      this.percussion.triggerAttackRelease('32n');

    }              decay: 0.12, await Tone.start();

  }

  play() {

  dispose() {

    this.stop();    if (this.isPlaying) return;              sustain: 0.6,      }

    this.synth?.dispose();

    this.percussion?.dispose();    

  }

}    this.isPlaying = true;            release: 0.24

    this.tickInterval = setInterval(() => {

      this.processTick();          }      // Create basic synth

    }, this.tickIntervalMs);

        }).toDestination(); this.synth = new Tone.PolySynth(Tone.Synth, {

    console.log('Sound engine started');

  }          oscillator: { type: 'sine' },



  stop() {          // Create percussion synth        envelope: {

    if (!this.isPlaying) return;

              this.percussion = new Tone.NoiseSynth({

    this.isPlaying = false;            attack: 0.005,

    if (this.tickInterval) {

      clearInterval(this.tickInterval);            noise: { type: 'white' }, decay: 0.12,

      this.tickInterval = null;

    }            envelope: {

              sustain: 0.6,

    // Stop all playing notes

    this.synth?.releaseAll();              attack: 0.001, release: 0.24



    console.log('Sound engine stopped');          decay: 0.1,

  }            }



  private processTick() {          sustain: 0,

    if (!this.currentPreset || !this.synth || !this.currentBoard) return;          }).toDestination();



    try {          release: 0.1

      const pieces = decodeBoardString(this.currentBoard);

              }      // Create percussion synth

      // Calculate intensity and material balance

      const intensity = this.calculateIntensity(pieces);      }).toDestination(); this.percussion = new Tone.NoiseSynth({

      const materialBalance = this.calculateMaterialBalance(pieces);

                noise: { type: 'white' },

      // Generate notes for current position

      this.playPosition(pieces, intensity, materialBalance);          console.log('Sound engine initialized'); envelope: {

      

    } catch (error) {          } catch(error) {

      console.error('Error processing tick:', error);            attack: 0.001,

    }

  }              console.error('Failed to initialize sound engine:', error); decay: 0.1,



  private calculateIntensity(pieces: Piece[]): number {    }          sustain: 0,

    // Simplified intensity calculation

    const totalPieces = pieces.length;        }          release: 0.1

    return Math.min(totalPieces / 32, 1); // Normalize to 0-1

  }        }



  private calculateMaterialBalance(pieces: Piece[]): number {loadPreset(preset: SoundPreset) { }).toDestination();

    const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

    let whiteValue = 0;this.currentPreset = preset;

    let blackValue = 0;

console.log('Sound engine initialized');

    pieces.forEach(piece => {

      const value = values[piece.type] || 0;if (!this.synth) return;    } catch (error) {

      if (piece.side === 'white') {

        whiteValue += value;  console.error('Failed to initialize sound engine:', error);

      } else {

        blackValue += value;  // Update synth with preset settings    }

      }

    });  this.synth.set({}



    return (whiteValue - blackValue) / 39; // Normalize to -1 to 1      oscillator: { type: preset.engine.oscillator as any },

  }

    envelope: {

  private playPosition(pieces: Piece[], intensity: number, materialBalance: number) {      loadPreset(preset: SoundPreset) {

    if (!this.currentPreset || !this.synth) return;

        attack: preset.engine.envelope.attackMs / 1000, this.currentPreset = preset;

    // Limit to polyphony

    const activePieces = pieces.slice(0, this.currentPreset.engine.polyphony);        decay: preset.engine.envelope.decayMs / 1000,

    

    // Calculate tempo based on intensity          sustain: preset.engine.envelope.sustain,    if (!this.synth) return;

    const tempo = this.currentPreset.mapping.tempoBaseBpm * 

      (1 + this.currentPreset.mapping.tempoIntensityFactor * intensity);        release: preset.engine.envelope.releaseMs / 1000



    // Stop previous notes      }    // Update synth with preset settings

    this.synth.releaseAll();

  }); this.synth.set({

    // Play notes for each piece

    setTimeout(() => {    oscillator: { type: preset.engine.oscillator as any },

      activePieces.forEach((piece, index) => {

        this.playPiece(piece, index * 50); // Slight delay for chord effect    // Set polyphony      envelope: {

      });

    }, 10);    this.synth.maxPolyphony = preset.engine.polyphony; attack: preset.engine.envelope.attackMs / 1000,

  }

    decay: preset.engine.envelope.decayMs / 1000,

  private playPiece(piece: Piece, delay: number) {

    if (!this.currentPreset || !this.synth) return;    console.log(`Loaded preset: ${preset.name}`); sustain: preset.engine.envelope.sustain,



    try {  }        release: preset.engine.envelope.releaseMs / 1000

      const basePitch = this.currentPreset.mapping.piecePitchHz[piece.type];

      const octaveShift = this.currentPreset.mapping.octaveShift[piece.side];      }

      const volumeDb = this.currentPreset.mapping.volumeByValueDb[piece.type];

      setTickInterval(intervalMs: number) { });

      if (basePitch) {

        const frequency = basePitch * Math.pow(2, octaveShift);this.tickIntervalMs = intervalMs;

        const volume = Tone.dbToGain(volumeDb);

        if (this.isPlaying) {    // Set polyphony

        setTimeout(() => {

          this.synth?.triggerAttackRelease(frequency, '0.5', undefined, volume);  this.stop(); this.synth.maxPolyphony = preset.engine.polyphony;

        }, delay);

      }  this.play();

    } catch (error) {

      console.error('Error playing piece:', error);} console.log(`Loaded preset: ${preset.name}`);

    }

  }  }  }



  triggerCapture() {

    if (this.percussion && this.currentPreset) {

      this.percussion.triggerAttackRelease('16n');setBoardState(boardString: string) {

    }  setTickInterval(intervalMs: number) {

  }

    this.currentBoard = boardString; this.tickIntervalMs = intervalMs;

  triggerCheck() {

    if (this.percussion && this.currentPreset) {  } if (this.isPlaying) {

      this.percussion.triggerAttackRelease('32n');

    }    this.stop();

  }

    play() {

  dispose() {      this.play();

    this.stop();

    this.synth?.dispose();      if (this.isPlaying) return;

    this.percussion?.dispose();    }

  }

}  }

  this.isPlaying = true;

  this.tickInterval = setInterval(() => {
    setBoardState(boardString: string) {

      this.processTick(); this.currentBoard = boardString;

    }, this.tickIntervalMs);
}



console.log('Sound engine started'); play() {

} if (this.isPlaying) return;



stop() {
  this.isPlaying = true;

  if (!this.isPlaying) return; this.tickInterval = setInterval(() => {

    this.processTick();

    this.isPlaying = false;
  }, this.tickIntervalMs);

  if (this.tickInterval) {

    clearInterval(this.tickInterval); console.log('Sound engine started');

    this.tickInterval = null;
  }

}

stop() {

  // Stop all playing notes    if (!this.isPlaying) return;

  this.synth?.releaseAll();

  this.isPlaying = false;

  console.log('Sound engine stopped'); if (this.tickInterval) {

  } clearInterval(this.tickInterval);

  this.tickInterval = null;

  private processTick() { }

  if (!this.currentPreset || !this.synth || !this.currentBoard) return;

  // Stop all playing notes

  try {
    this.synth?.releaseAll();

    const pieces = decodeBoardString(this.currentBoard);

    console.log('Sound engine stopped');

    // Calculate intensity and material balance  }

    const intensity = this.calculateIntensity(pieces);

        private processTick() {

      // Generate notes for current position    if (!this.currentPreset || !this.synth || !this.currentBoard) return;

      this.playPosition(pieces, intensity);

      try {

      } catch (error) {
        const pieces = decodeBoardString(this.currentBoard);

        console.error('Error processing tick:', error);

      }      // Calculate intensity and material balance

    } const intensity = this.calculateIntensity(pieces);

    const materialBalance = this.calculateMaterialBalance(pieces);

  private calculateIntensity(pieces: Piece[]): number {

      // Simplified intensity calculation      // Generate notes for current position

      const totalPieces = pieces.length; this.playPosition(pieces, intensity, materialBalance);

      return Math.min(totalPieces / 32, 1); // Normalize to 0-1      

    }
  } catch (error) {

    console.error('Error processing tick:', error);

  private playPosition(pieces: Piece[], intensity: number) { }

    if (!this.currentPreset || !this.synth) return;
  }



  // Limit to polyphony  private calculateIntensity(pieces: any[]): number {

  const activePieces = pieces.slice(0, this.currentPreset.engine.polyphony);    // Simplified intensity calculation

  const totalPieces = pieces.length;

  // Stop previous notes    return Math.min(totalPieces / 32, 1); // Normalize to 0-1

  this.synth.releaseAll();
}



// Play notes for each piece  private calculateMaterialBalance(pieces: any[]): number {

setTimeout(() => {
  const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };

  activePieces.forEach((piece, index) => {
    let whiteValue = 0;

    this.playPiece(piece, index * 50); // Slight delay for chord effect    let blackValue = 0;

  });

}, 10); pieces.forEach(piece => {

}      const value = values[piece.type] || 0;

if (piece.side === 'white') {

  private playPiece(piece: Piece, delay: number) {
    whiteValue += value;

    if (!this.currentPreset || !this.synth) return;
  } else {

    blackValue += value;

    try { }

      const basePitch = this.currentPreset.mapping.piecePitchHz[piece.type];
  });

  const octaveShift = this.currentPreset.mapping.octaveShift[piece.side];

  const volumeDb = this.currentPreset.mapping.volumeByValueDb[piece.type]; return (whiteValue - blackValue) / 39; // Normalize to -1 to 1

}

if (basePitch) {

  const frequency = basePitch * Math.pow(2, octaveShift);  private playPosition(pieces: any[], intensity: number, materialBalance: number) {

    const volume = Tone.dbToGain(volumeDb); if (!this.currentPreset || !this.synth) return;



    setTimeout(() => {    // Limit to polyphony

      this.synth?.triggerAttackRelease(frequency, '0.5', undefined, volume); const activePieces = pieces.slice(0, this.currentPreset.engine.polyphony);

    }, delay);

  }    // Calculate tempo based on intensity

} catch (error) {
  const tempo = this.currentPreset.mapping.tempoBaseBpm *

    console.error('Error playing piece:', error); (1 + this.currentPreset.mapping.tempoIntensityFactor * intensity);

}

  }    // Stop previous notes

this.synth.releaseAll();

triggerCapture() {

  if (this.percussion && this.currentPreset) {    // Play notes for each piece

    this.percussion.triggerAttackRelease('16n'); setTimeout(() => {

    }      activePieces.forEach((piece, index) => {

    }        this.playPiece(piece, index * 50); // Slight delay for chord effect

  });

  triggerCheck() { }, 10);

  if (this.percussion && this.currentPreset) { }

  this.percussion.triggerAttackRelease('32n');

}  private playPiece(piece: any, delay: number) {

} if (!this.currentPreset || !this.synth) return;



dispose() {
  try {

    this.stop(); const basePitch = this.currentPreset.mapping.piecePitchHz[piece.type];

    this.synth?.dispose(); const octaveShift = this.currentPreset.mapping.octaveShift[piece.side];

    this.percussion?.dispose(); const volumeDb = this.currentPreset.mapping.volumeByValueDb[piece.type];

  }      

} if (basePitch) {
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
  if (this.percussion && this.currentPreset) {
    this.percussion.triggerAttackRelease('16n');
  }
}

triggerCheck() {
  if (this.percussion && this.currentPreset) {
    this.percussion.triggerAttackRelease('32n');
  }
}

dispose() {
  this.stop();
  this.synth?.dispose();
  this.percussion?.dispose();
}
}
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
