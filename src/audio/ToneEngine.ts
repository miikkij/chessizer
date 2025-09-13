import * as Tone from 'tone';
import { Chess } from 'chess.js';

// Sound preset interface matching the JSON structure
interface SoundPreset {
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
        reverb?: {
            room: number;
            damp: number;
        };
        chorus?: {
            depth: number;
            frequencyHz: number;
        };
        glideMs?: number;
    };
    mapping: {
        piecePitchHz?: Record<string, number>;
        octaveShift?: Record<string, number>;
        volumeByValueDb?: Record<string, number>;
        tempoBaseBpm: number;
        tempoIntensityFactor?: number;
        percussion: {
            capture: string;
            check: string;
        };
        [key: string]: unknown; // For preset-specific mappings
    };
}

interface PieceInfo {
    type: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
    color: 'w' | 'b';
    square: string;
    captured?: boolean;
    moved?: boolean;
    justCaptured?: boolean;
}

export class ToneEngine {
    private synth: Tone.PolySynth | null = null;
    private percussionSampler: Tone.Sampler | null = null;
    private reverb: Tone.Reverb | null = null;
    private chorus: Tone.Chorus | null = null;
    private compressor: Tone.Compressor | null = null;
    private masterGain: Tone.Gain | null = null;
    private isInitialized = false;
    private currentPreset: SoundPreset | null = null;
    private previousFen = '';
    private isPlaying = false;
    private tickInterval: number | null = null;
    private currentFen = '';
    private tickRate = 1000; // milliseconds
    private masterVolume = 0.7; // Default volume (0.0 to 1.0)

    // Default sound presets
    private presets: SoundPreset[] = [
        {
            id: "harmonic_layers",
            name: "Harmonic Layers",
            description: "Pitch maps to piece type. White higher octave, black lower.",
            engine: {
                oscillator: "sine",
                envelope: {
                    attackMs: 5,
                    decayMs: 120,
                    sustain: 0.6,
                    releaseMs: 240
                },
                polyphony: 16
            },
            mapping: {
                piecePitchHz: {
                    pawn: 261.63,    // C4
                    knight: 329.63,  // E4
                    bishop: 392.0,   // G4
                    rook: 440.0,     // A4
                    queen: 493.88,   // B4
                    king: 220.0      // A3
                },
                octaveShift: {
                    white: 1,        // White pieces one octave higher
                    black: -1        // Black pieces one octave lower
                },
                volumeByValueDb: {
                    pawn: -12,
                    knight: -9,
                    bishop: -9,
                    rook: -6,
                    queen: -3,
                    king: -1
                },
                tempoBaseBpm: 90,
                tempoIntensityFactor: 0.5,
                percussion: {
                    capture: "click",
                    check: "clap"
                }
            }
        },
        {
            id: "electro_scene",
            name: "Electro Scene",
            description: "Electronic sounds with different timbres per piece type.",
            engine: {
                oscillator: "square",
                envelope: {
                    attackMs: 2,
                    decayMs: 80,
                    sustain: 0.7,
                    releaseMs: 180
                },
                polyphony: 24,
                glideMs: 60
            },
            mapping: {
                pieceWave: {
                    pawn: "pulse",
                    knight: "triangle",
                    bishop: "sawtooth",
                    rook: "square",
                    queen: "sine",
                    king: "triangle"
                },
                basePitchHz: 220.0,
                tempoBaseBpm: 100,
                percussion: {
                    capture: "snare",
                    check: "hihat"
                }
            }
        },
        {
            id: "ambient_clouds",
            name: "Ambient Clouds",
            description: "Atmospheric sounds with reverb and stereo positioning.",
            engine: {
                oscillator: "sine",
                envelope: {
                    attackMs: 200,
                    decayMs: 600,
                    sustain: 0.9,
                    releaseMs: 1200
                },
                polyphony: 32,
                reverb: {
                    room: 0.8,
                    damp: 0.3
                }
            },
            mapping: {
                whitePan: -0.2,
                blackPan: 0.2,
                dronePitchHz: {
                    white: 261.63,
                    black: 196.0
                },
                tempoBaseBpm: 60,
                percussion: {
                    capture: "low_tap",
                    check: "bell"
                }
            }
        }
    ];

    async initialize(presetId = "harmonic_layers"): Promise<void> {
        console.log('ToneEngine initialize called with preset:', presetId);

        if (this.isInitialized) {
            console.log('Already initialized, cleaning up...');
            await this.cleanup();
        }

        // Start Tone context
        console.log('Tone context state before start:', Tone.getContext().state);
        if (Tone.getContext().state !== 'running') {
            console.log('Starting Tone context...');
            await Tone.start();
        }
        console.log('Tone context state after start:', Tone.getContext().state);

        // Load preset
        this.currentPreset = this.presets.find(p => p.id === presetId) || this.presets[0];
        console.log('Loaded preset:', this.currentPreset.name);

        // Create effects chain
        console.log('Creating effects chain...');
        await this.createEffectsChain();

        // Create main synthesizer
        console.log('Creating synthesizer...');
        this.createSynthesizer();
        console.log('Synthesizer created:', !!this.synth);

        // Create percussion sampler
        console.log('Creating percussion...');
        this.createPercussion();

        this.isInitialized = true;
        console.log(`ToneEngine initialized successfully with preset: ${this.currentPreset.name}`);
    } private async createEffectsChain(): Promise<void> {
        if (!this.currentPreset) return;

        // Create compressor (always present)
        this.compressor = new Tone.Compressor({
            threshold: -24,
            ratio: 3.0
        });

        // Create reverb if specified
        if (this.currentPreset.engine.reverb) {
            this.reverb = new Tone.Reverb({
                decay: this.currentPreset.engine.reverb.room * 5, // Convert room to decay time
                wet: 0.3
            });
            await this.reverb.generate();
        }

        // Create chorus if specified
        if (this.currentPreset.engine.chorus) {
            this.chorus = new Tone.Chorus({
                depth: this.currentPreset.engine.chorus.depth,
                frequency: this.currentPreset.engine.chorus.frequencyHz
            }).start();
        }

        // Connect effects chain
        let destination: Tone.ToneAudioNode = this.compressor;

        if (this.reverb) {
            this.reverb.connect(this.compressor);
            destination = this.reverb;
        }

        if (this.chorus) {
            this.chorus.connect(destination);
            destination = this.chorus;
        }

        // Create master gain control and connect to destination
        this.masterGain = new Tone.Gain(this.masterVolume);
        this.compressor.connect(this.masterGain);
        this.masterGain.toDestination();
    }

    private createSynthesizer(): void {
        if (!this.currentPreset) return;

        const envelope = this.currentPreset.engine.envelope;

        // Create polyphonic synthesizer with correct API  
        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: {
                type: "sine" // Use string literal instead of type casting
            },
            envelope: {
                attack: envelope.attackMs / 1000,
                decay: envelope.decayMs / 1000,
                sustain: envelope.sustain,
                release: envelope.releaseMs / 1000
            }
        });

        // Set polyphony after creation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.synth as any).maxPolyphony = this.currentPreset.engine.polyphony;

        // Connect to effects chain
        if (this.chorus) {
            this.synth.connect(this.chorus);
        } else if (this.reverb) {
            this.synth.connect(this.reverb);
        } else if (this.compressor) {
            this.synth.connect(this.compressor);
        }
    }

    private createPercussion(): void {
        // Create simple percussion using oscillators for now
        // In a full implementation, this would load actual samples
        this.percussionSampler = new Tone.Sampler({
            urls: {
                // These would be actual sample URLs in production
                "C4": "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBztuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwBJHfH8N2QQAoUXrTp66hVFApGn+D2s2cfBjtuwfPcdiwB"
            },
            baseUrl: "",
            onload: () => console.log("Percussion samples loaded")
        });

        this.percussionSampler.connect(this.compressor!);
    }

    setPreset(presetId: string): void {
        const preset = this.presets.find(p => p.id === presetId);
        if (preset && preset.id !== this.currentPreset?.id) {
            console.log(`Switching to preset: ${preset.name}`);
            // Re-initialize with new preset
            this.initialize(presetId);
        }
    }

    getAvailablePresets(): { id: string; name: string; description: string }[] {
        return this.presets.map(p => ({ id: p.id, name: p.name, description: p.description }));
    }

    setPosition(fen: string): void {
        console.log('ToneEngine: setPosition called with FEN:', fen);
        this.currentFen = fen;
    }

    setTickRate(rateMs: number): void {
        this.tickRate = rateMs;
        if (this.isPlaying) {
            this.stop();
            this.play();
        }
    }

    setMasterVolume(volume: number): void {
        // Clamp volume between 0.0 and 1.0
        this.masterVolume = Math.max(0.0, Math.min(1.0, volume));

        // Update the gain node if it exists
        if (this.masterGain) {
            this.masterGain.gain.rampTo(this.masterVolume, 0.1); // Smooth transition
        }

        console.log('ToneEngine: Master volume set to', this.masterVolume);
    }

    getMasterVolume(): number {
        return this.masterVolume;
    }

    async play(): Promise<void> {
        if (this.isPlaying || !this.isInitialized) return;

        // Ensure Tone is started with user gesture
        if (Tone.getContext().state !== 'running') {
            console.log('Starting Tone context...');
            await Tone.start();
            console.log('Tone context state:', Tone.getContext().state);
        }

        // Test sound to verify audio works
        console.log('Playing test sound...');
        await this.playTestSound();

        this.isPlaying = true;
        this.tickInterval = window.setInterval(() => {
            this.processTick();
        }, this.tickRate);

        console.log('ToneEngine started playing');
    }

    // Add a simple test sound method
    private async playTestSound(): Promise<void> {
        if (!this.synth) {
            console.warn('Synth not available for test sound');
            return;
        }

        try {
            console.log('Triggering test note at 440Hz...');
            this.synth.triggerAttackRelease("C4", "8n");
            console.log('Test sound triggered');
        } catch (error) {
            console.error('Error playing test sound:', error);
        }
    } stop(): void {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }

        // Stop all playing notes
        this.synth?.releaseAll();
        console.log('ToneEngine stopped');
    }

    private processTick(): void {
        if (!this.currentFen || !this.currentPreset || !this.synth) {
            console.log('ProcessTick skipped:', {
                hasFen: !!this.currentFen,
                hasPreset: !!this.currentPreset,
                hasSynth: !!this.synth
            });
            return;
        }

        console.log('Processing tick for FEN:', this.currentFen);

        try {
            // Analyze chess position
            const chess = new Chess(this.currentFen);
            const pieces = this.analyzePieces(chess);
            console.log(`Found ${pieces.length} pieces on board`);

            // Detect captures since last position
            const capturedPieces = this.detectCaptures(this.previousFen, this.currentFen);

            // Play capture sounds
            if (capturedPieces.length > 0) {
                console.log(`Playing capture sound for ${capturedPieces.length} pieces`);
                this.playCaptureSound(capturedPieces);
            }

            // Play piece sounds based on current preset
            console.log('Playing piece sounds...');
            this.playPieceSounds(pieces);

            // Check for check/checkmate
            if (chess.isCheck()) {
                console.log('King in check - playing check sound');
                this.playCheckSound();
            }

            this.previousFen = this.currentFen;

        } catch (error) {
            console.warn('Error processing tick:', error);
        }
    }

    private analyzePieces(chess: Chess): PieceInfo[] {
        const board = chess.board();
        const pieces: PieceInfo[] = [];

        board.forEach((row, rankIndex) => {
            row.forEach((square, fileIndex) => {
                if (square) {
                    const file = String.fromCharCode(97 + fileIndex); // a-h
                    const rank = (8 - rankIndex).toString(); // 1-8
                    pieces.push({
                        type: square.type as PieceInfo['type'],
                        color: square.color as PieceInfo['color'],
                        square: file + rank
                    });
                }
            });
        });

        return pieces;
    }

    private detectCaptures(previousFen: string, currentFen: string): PieceInfo[] {
        if (!previousFen) return [];

        try {
            const prevChess = new Chess(previousFen);
            const currChess = new Chess(currentFen);

            const prevPieces = this.analyzePieces(prevChess);
            const currPieces = this.analyzePieces(currChess);

            // Find pieces that disappeared (were captured)
            const captured: PieceInfo[] = [];
            prevPieces.forEach(prevPiece => {
                const stillExists = currPieces.some(currPiece =>
                    currPiece.type === prevPiece.type &&
                    currPiece.color === prevPiece.color &&
                    currPiece.square === prevPiece.square
                );
                if (!stillExists) {
                    captured.push({ ...prevPiece, justCaptured: true });
                }
            });

            return captured;
        } catch {
            return [];
        }
    }

    private playPieceSounds(pieces: PieceInfo[]): void {
        if (!this.synth || !this.currentPreset) return;

        // Stop previous notes
        this.synth.releaseAll();

        // Group pieces by color for different timbres
        const whitePieces = pieces.filter(p => p.color === 'w');
        const blackPieces = pieces.filter(p => p.color === 'b');

        // Play sounds based on preset mapping
        if (this.currentPreset.mapping.piecePitchHz) {
            this.playHarmonicLayers(whitePieces, blackPieces);
        } else {
            this.playGenericSounds(pieces);
        }
    }

    private playHarmonicLayers(whitePieces: PieceInfo[], blackPieces: PieceInfo[]): void {
        if (!this.synth || !this.currentPreset) return;

        console.log(`Playing harmonic layers: ${whitePieces.length} white pieces, ${blackPieces.length} black pieces`);

        const mapping = this.currentPreset.mapping;
        const now = Tone.now();
        const maxPolyphony = this.currentPreset.engine.polyphony;

        // Prioritize pieces by value for polyphony limiting
        const pieceValues = { k: 10, q: 9, r: 5, b: 3, n: 3, p: 1 };
        const sortPiecesByPriority = (pieces: PieceInfo[]) =>
            pieces.sort((a, b) => (pieceValues[b.type] || 0) - (pieceValues[a.type] || 0));

        // Sort pieces by priority and limit total pieces to maxPolyphony
        const prioritizedWhite = sortPiecesByPriority([...whitePieces]);
        const prioritizedBlack = sortPiecesByPriority([...blackPieces]);

        // Calculate how many pieces from each side to play
        const totalPieces = whitePieces.length + blackPieces.length;
        const whiteRatio = whitePieces.length / totalPieces;
        const maxWhitePieces = Math.min(prioritizedWhite.length, Math.ceil(maxPolyphony * whiteRatio));
        const maxBlackPieces = Math.min(prioritizedBlack.length, maxPolyphony - maxWhitePieces);

        const selectedWhite = prioritizedWhite.slice(0, maxWhitePieces);
        const selectedBlack = prioritizedBlack.slice(0, maxBlackPieces);

        console.log(`Polyphony limited to ${maxPolyphony}: playing ${selectedWhite.length} white + ${selectedBlack.length} black pieces`);

        // Play white pieces (higher octave)
        selectedWhite.forEach((piece, index) => {
            const basePitch = mapping.piecePitchHz?.[this.getPieceTypeName(piece.type)] || 440;
            const octaveShift = mapping.octaveShift?.white || 0;
            const frequency = basePitch * Math.pow(2, octaveShift);

            // Add slight delay for polyphonic feel
            const delay = index * 0.02;

            console.log(`White ${piece.type} at ${piece.square}: ${frequency}Hz`);

            this.synth!.triggerAttackRelease(
                frequency,
                this.currentPreset!.engine.envelope.releaseMs / 1000,
                now + delay,
                this.getVolumeForPiece(piece)
            );
        });

        // Play black pieces (lower octave)
        selectedBlack.forEach((piece, index) => {
            const basePitch = mapping.piecePitchHz?.[this.getPieceTypeName(piece.type)] || 440;
            const octaveShift = mapping.octaveShift?.black || 0;
            const frequency = basePitch * Math.pow(2, octaveShift);

            // Add slight delay for polyphonic feel
            const delay = index * 0.02;

            this.synth!.triggerAttackRelease(
                frequency,
                this.currentPreset!.engine.envelope.releaseMs / 1000,
                now + delay,
                this.getVolumeForPiece(piece)
            );
        });
    }

    private playGenericSounds(pieces: PieceInfo[]): void {
        if (!this.synth || !this.currentPreset) return;

        const now = Tone.now();
        const baseFreq = (this.currentPreset.mapping.basePitchHz as number) || 220;
        const maxPolyphony = this.currentPreset.engine.polyphony;

        // Prioritize pieces by value for polyphony limiting
        const pieceValues = { k: 10, q: 9, r: 5, b: 3, n: 3, p: 1 };
        const prioritizedPieces = pieces
            .sort((a, b) => (pieceValues[b.type] || 0) - (pieceValues[a.type] || 0))
            .slice(0, maxPolyphony);

        console.log(`Generic sounds: limited to ${prioritizedPieces.length} of ${pieces.length} pieces`);

        prioritizedPieces.forEach((piece, index) => {
            const frequency = this.getFrequencyForPiece(piece, baseFreq);
            const delay = index * 0.01;

            this.synth!.triggerAttackRelease(
                frequency,
                this.currentPreset!.engine.envelope.releaseMs / 1000,
                now + delay,
                this.getVolumeForPiece(piece)
            );
        });
    }

    private playCaptureSound(capturedPieces: PieceInfo[]): void {
        if (!this.percussionSampler) return;

        // Play capture percussion
        const now = Tone.now();
        capturedPieces.forEach((piece, index) => {
            // Different capture sounds for different pieces
            const delay = index * 0.05;

            // Create a short percussive sound using the synth
            if (this.synth) {
                const freq = piece.color === 'w' ? 800 : 200; // Higher for white, lower for black
                this.synth.triggerAttackRelease(freq, 0.1, now + delay, 0.5);
            }
        });

        console.log(`Capture sound for ${capturedPieces.length} piece(s)`);
    }

    private playCheckSound(): void {
        if (!this.synth) return;

        // Play a distinctive sound for check
        const now = Tone.now();
        this.synth.triggerAttackRelease([440, 554.37], 0.2, now, 0.3); // A and C# (tension)
        console.log('Check sound played');
    }

    private getPieceTypeName(type: string): string {
        const typeMap: Record<string, string> = {
            'p': 'pawn',
            'n': 'knight',
            'b': 'bishop',
            'r': 'rook',
            'q': 'queen',
            'k': 'king'
        };
        return typeMap[type] || 'pawn';
    }

    private getFrequencyForPiece(piece: PieceInfo, baseFreq: number): number {
        // Map piece types to frequency multipliers
        const typeMultipliers: Record<string, number> = {
            'p': 1.0,    // Pawn - base frequency
            'n': 1.25,   // Knight - perfect fourth
            'b': 1.5,    // Bishop - perfect fifth  
            'r': 2.0,    // Rook - octave
            'q': 2.5,    // Queen - high
            'k': 0.75    // King - lower
        };

        const colorMultiplier = piece.color === 'w' ? 2.0 : 1.0; // White higher octave
        return baseFreq * typeMultipliers[piece.type] * colorMultiplier;
    }

    private getVolumeForPiece(piece: PieceInfo): number {
        // Volume based on piece value
        const volumeMap: Record<string, number> = {
            'p': 0.3,    // Pawn - quieter
            'n': 0.5,    // Knight
            'b': 0.5,    // Bishop  
            'r': 0.7,    // Rook
            'q': 0.9,    // Queen - loudest
            'k': 0.6     // King
        };
        return volumeMap[piece.type] || 0.5;
    }

    async cleanup(): Promise<void> {
        this.stop();

        if (this.synth) {
            this.synth.dispose();
            this.synth = null;
        }

        if (this.percussionSampler) {
            this.percussionSampler.dispose();
            this.percussionSampler = null;
        }

        if (this.reverb) {
            this.reverb.dispose();
            this.reverb = null;
        }

        if (this.chorus) {
            this.chorus.dispose();
            this.chorus = null;
        }

        if (this.compressor) {
            this.compressor.dispose();
            this.compressor = null;
        }

        if (this.masterGain) {
            this.masterGain.dispose();
            this.masterGain = null;
        }

        this.isInitialized = false;
        console.log('ToneEngine cleaned up');
    }
}