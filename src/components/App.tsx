import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import PGNViewerWrapper from "./PGNViewerWrapper";
import PGNLoader from "./PGNLoader";
import { Chess } from "chess.js";

// Simplified Sound Engine that works with FEN positions
class SimpleSoundEngine {
    private audioContext: AudioContext | null = null;
    private isPlaying = false;
    private tickInterval: NodeJS.Timeout | null = null;
    private currentFen = '';
    private tickIntervalMs = 1000;

    async initialize() {
        this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    setPosition(fen: string) {
        this.currentFen = fen;
    }

    setTickInterval(intervalMs: number) {
        this.tickIntervalMs = intervalMs;
        if (this.isPlaying) {
            this.stop();
            this.play();
        }
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

        console.log('Sound engine stopped');
    }

    private processTick() {
        if (!this.currentFen || !this.audioContext) return;

        // TODO: Convert FEN position to sound
        console.log('Processing tick for FEN:', this.currentFen);

        // Placeholder: Play a simple beep based on material count
        const chess = new Chess(this.currentFen);
        const board = chess.board();
        let pieceCount = 0;

        board.flat().forEach(square => {
            if (square) pieceCount++;
        });

        // Play beep with frequency based on piece count
        const frequency = 220 + (pieceCount * 10);
        this.playBeep(frequency, 0.1, 0.1);
    }

    private playBeep(frequency: number, duration: number, volume: number) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
}

function App() {
    const [soundEngine] = useState(() => new SimpleSoundEngine());
    const [isPlaying, setIsPlaying] = useState(false);
    const [tickInterval, setTickInterval] = useState(1000);
    const [gameSource, setGameSource] = useState<'start' | 'random' | 'endgame'>('start');
    const [pgnData, setPgnData] = useState('');
    const [currentFen, setCurrentFen] = useState('');

    // Initialize sound engine
    useEffect(() => {
        soundEngine.initialize();
    }, [soundEngine]);

    // Update sound engine when position changes
    useEffect(() => {
        if (currentFen) {
            soundEngine.setPosition(currentFen);
        }
    }, [soundEngine, currentFen]);

    const handlePlay = async () => {
        if (!isPlaying) {
            await soundEngine.initialize();
            soundEngine.play();
            setIsPlaying(true);
        } else {
            soundEngine.stop();
            setIsPlaying(false);
        }
    };

    const handleTickIntervalChange = (value: number[]) => {
        const newInterval = value[0];
        setTickInterval(newInterval);
        soundEngine.setTickInterval(newInterval);
    };

    const generatePGN = useCallback((source: 'start' | 'random' | 'endgame') => {
        let pgn = '';

        switch (source) {
            case 'start':
                pgn = `[Event "Starting Position"]
[Site "Chessizer"]
[Date "2025.01.01"]
[White "White"]
[Black "Black"]
[Result "*"]

*`;
                break;

            case 'random': {
                // Generate a simple random game
                const chess = new Chess();
                const moves: string[] = [];

                // Play random moves for 10-30 plies
                const numMoves = Math.floor(Math.random() * 20) + 10;

                for (let i = 0; i < numMoves; i++) {
                    const possibleMoves = chess.moves();
                    if (possibleMoves.length === 0) break;

                    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
                    chess.move(randomMove);
                    moves.push(randomMove);
                }

                pgn = `[Event "Random Game"]
[Site "Chessizer"]
[Date "2025.01.01"]
[White "White"]
[Black "Black"]
[Result "*"]

${formatMovesAsPGN(moves)} *`;
                break;
            }

            case 'endgame':
                // Simple King and Queen vs King endgame
                pgn = `[Event "Endgame Position"]
[Site "Chessizer"]
[Date "2025.01.01"]
[White "White"]
[Black "Black"]
[FEN "4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1"]
[Result "*"]

*`;
                break;
        }

        return pgn;
    }, []);

    const formatMovesAsPGN = (moves: string[]): string => {
        let result = '';
        for (let i = 0; i < moves.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            result += `${moveNumber}. ${moves[i]}`;
            if (moves[i + 1]) {
                result += ` ${moves[i + 1]}`;
            }
            result += ' ';
        }
        return result.trim();
    };

    const handleGameSourceChange = (source: 'start' | 'random' | 'endgame') => {
        setGameSource(source);
        const newPGN = generatePGN(source);
        setPgnData(newPGN);
    };

    const handlePositionChange = (fen: string, moveNumber: number) => {
        console.log('Position changed:', fen, 'move:', moveNumber);
        setCurrentFen(fen);
    };

    // Initialize with Fischer vs Spassky example game instead of start position
    useEffect(() => {
        const examplePGN = `[Event "F/S Return Match"]
[Site "Belgrade, Serbia JUG"]
[Date "1992.11.04"]
[Round "29"]
[White "Fischer, Robert J."]
[Black "Spassky, Boris V."]
[Result "1/2-1/2"]

1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8 10.d4 Nbd7 11.c4 c6 12.cxb5 axb5 13.Nc3 Bb7 14.Bg5 b4 15.Nb1 h6 16.Bh4 c5 17.dxe5 Nxe4 18.Bxe7 Qxe7 19.exd6 Qf6 20.Nbd2 Nxd6 21.Nc4 Nxc4 22.Bxc4 Nb6 23.Ne5 Rae8 24.Bxf7+ Rxf7 25.Nxf7 Rxe1+ 26.Qxe1 Kxf7 27.Qe3 Qg5 28.Qxg5 hxg5 29.b3 Ke6 30.a3 Kd6 31.axb4 cxb4 32.Ra5 Nd5 33.f3 Bc8 34.Kf2 Bf5 35.Ra7 g6 36.Ra6+ Kc5 37.Ke1 Nf4 38.g3 Nxh3 39.Kd2 Kb5 40.Rd6 Kc5 41.Ra6 Nf2 42.g4 Bd3 43.Re6 1/2-1/2`;
        setPgnData(examplePGN);
    }, []);

    return (
        <div className="min-h-screen bg-background">
            {/* Top Navigation */}
            <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* PGN Loader */}
                        <PGNLoader onGameLoaded={(fens) => {
                            // Convert FEN array back to PGN - simplified for now
                            console.log('Game loaded with', fens.length, 'positions');
                            // For now, just use the first position
                            if (fens.length > 0) {
                                setCurrentFen(fens[0]);
                            }
                        }} />

                        {/* Game Source Selector */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Game Source:</label>
                            <select
                                value={gameSource}
                                onChange={(e) => handleGameSourceChange(e.target.value as 'start' | 'random' | 'endgame')}
                                className="px-3 py-1.5 text-sm border rounded-md bg-background"
                                title="Select game source"
                            >
                                <option value="start">Start Position</option>
                                <option value="random">Random Game</option>
                                <option value="endgame">Endgame</option>
                            </select>
                        </div>

                        {/* Sound Preset Selector */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Sound Preset:</label>
                            <select
                                className="px-3 py-1.5 text-sm border rounded-md bg-background"
                                title="Select sound preset"
                            >
                                <option value="harmonic">Harmonic Layers</option>
                                <option value="rhythm">Rhythm Focus</option>
                                <option value="electro">Electro Scene</option>
                                <option value="ambient">Ambient Clouds</option>
                            </select>
                        </div>

                        {/* Tick Interval */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Tick Interval:</label>
                            <div className="w-24">
                                <Slider
                                    value={[tickInterval]}
                                    onValueChange={handleTickIntervalChange}
                                    min={250}
                                    max={5000}
                                    step={250}
                                />
                            </div>
                            <span className="text-xs text-muted-foreground w-12">
                                {tickInterval}ms
                            </span>
                        </div>

                        {/* Play/Pause Button */}
                        <Button onClick={handlePlay} variant={isPlaying ? "outline" : "default"}>
                            {isPlaying ? "Stop" : "Play"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chess Board */}
                    <div className="lg:col-span-2">
                        <div className="rounded-lg border bg-card p-6">
                            <h2 className="text-xl font-semibold mb-4">Chess Board</h2>
                            <PGNViewerWrapper
                                pgn={pgnData}
                                onPositionChange={handlePositionChange}
                                pieceStyle="merida"
                                theme="brown"
                                boardSize="400"
                            />
                        </div>
                    </div>

                    {/* Controls and Info Panel */}
                    <div className="space-y-6">
                        {/* Game Info */}
                        <div className="rounded-lg border bg-card p-4">
                            <h3 className="font-semibold mb-2">Game Information</h3>
                            <div className="space-y-1 text-sm">
                                <div>Source: <span className="font-medium">{gameSource}</span></div>
                                <div>Current FEN: <span className="font-mono text-xs break-all">{currentFen || 'Loading...'}</span></div>
                            </div>
                        </div>

                        {/* Sound Status */}
                        <div className="rounded-lg border bg-card p-4">
                            <h3 className="font-semibold mb-2">Sound Status</h3>
                            <div className="space-y-1 text-sm">
                                <div>Engine: <span className={isPlaying ? "text-green-600" : "text-red-600"}>
                                    {isPlaying ? "Playing" : "Stopped"}
                                </span></div>
                                <div>Tick Rate: <span className="font-medium">{(1000 / tickInterval).toFixed(1)} Hz</span></div>
                                <div>Preset: <span className="font-medium">Harmonic Layers</span></div>
                            </div>
                        </div>

                        {/* PGN Preview */}
                        <div className="rounded-lg border bg-card p-4">
                            <h3 className="font-semibold mb-2">PGN Data</h3>
                            <div className="bg-muted p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
                                {pgnData || 'No game loaded'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;