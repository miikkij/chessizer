import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./ui/button";
// import { Slider } from "./ui/slider";
import PGNViewerWrapper from "./PGNViewerWrapper";
import PGNLoader from "./PGNLoader";
import { Chess } from "chess.js";
import { ToneEngine } from "../audio/ToneEngine";
import { animate } from 'animejs';
import { Toaster, toast } from 'react-hot-toast';

function App() {
    const [soundEngine] = useState(() => new ToneEngine());
    const [isPlaying, setIsPlaying] = useState(false);
    const [tickInterval, setTickInterval] = useState(1000);
    const [masterVolume, setMasterVolume] = useState(0.7); // Default volume
    const [gameSource, setGameSource] = useState<'start' | 'random' | 'endgame'>('start');
    const [pgnData, setPgnData] = useState('');
    const [currentFen, setCurrentFen] = useState('');
    const [currentPreset, setCurrentPreset] = useState("harmonic_layers");
    const appRef = useRef<HTMLDivElement>(null);

    // Initialize sound engine
    useEffect(() => {
        soundEngine.initialize(currentPreset);
        toast.success('🎵 Chessizer loaded successfully!');

        // Add entrance animation
        setTimeout(() => {
            if (appRef.current) {
                animate(appRef.current.querySelectorAll('.animate-in'), {
                    opacity: [0, 1],
                    translateY: [30, 0],
                    duration: 800,
                    delay: (el, i) => i * 100,
                    easing: 'easeOutCubic'
                });
            }
        }, 100);
    }, [soundEngine, currentPreset]);

    // Update sound engine when position changes
    useEffect(() => {
        if (currentFen) {
            console.log('App: Setting ToneEngine position to:', currentFen);
            soundEngine.setPosition(currentFen);
        } else {
            console.log('App: No current FEN available');
        }
    }, [soundEngine, currentFen]);

    const handlePlay = async () => {
        if (!isPlaying) {
            await soundEngine.initialize(currentPreset);
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
        soundEngine.setTickRate(newInterval);
    };

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setMasterVolume(newVolume);
        soundEngine.setMasterVolume(newVolume);
    };

    const handlePresetChange = (presetId: string) => {
        setCurrentPreset(presetId);
        soundEngine.setPreset(presetId);
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
        console.log('App: Position changed:', fen, 'move:', moveNumber);
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
        <div ref={appRef} className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
            <Toaster position="top-right" />

            {/* Professional Header */}
            <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50 animate-in">
                <div className="container mx-auto px-6 py-4">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent text-center mb-2">
                        🎵 Chessizer - Sonic Chess Experience 🎵
                    </h1>
                    <p className="text-center text-gray-600 text-sm">
                        Experience chess through sound - Turn positions into melodies
                    </p>
                </div>
            </header>

            {/* Enhanced Navigation Panel */}
            <div className="bg-white/70 backdrop-blur-sm border-b shadow-sm animate-in">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex flex-wrap items-center justify-center gap-6">
                        {/* PGN Loader */}
                        <PGNLoader onGameLoaded={(fens) => {
                            // Convert FEN array back to PGN - simplified for now
                            console.log('Game loaded with', fens.length, 'positions');
                            // For now, just use the first position
                            if (fens.length > 0) {
                                setCurrentFen(fens[0]);
                            }
                        }} />


                    </div>
                </div>
            </div>

            {/* Enhanced Main Content */}
            <main className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Chess Board Section */}
                    <div className="lg:col-span-2 animate-in">
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-white/50 p-8 hover:shadow-2xl transition-all duration-300">
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent mb-6 flex items-center">
                                ♟️ Chess Board
                            </h2>
                            <div className="flex justify-center">
                                <div className="rounded-xl overflow-hidden shadow-lg border-4 border-white/70">
                                    <PGNViewerWrapper
                                        pgn={pgnData}
                                        onPositionChange={handlePositionChange}
                                        pieceStyle="merida"
                                        theme="brown"
                                        boardSize="400"
                                    />
                                </div>
                            </div>
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

                        {/* Sound Status & Controls */}
                        <div className="rounded-lg border bg-card p-4">
                            <h3 className="font-semibold mb-4">🎵 Sound Status & Controls</h3>
                            
                            {/* Status Info */}
                            <div className="space-y-2 text-sm mb-4">
                                <div>Engine: <span className={isPlaying ? "text-green-600" : "text-red-600"}>
                                    {isPlaying ? "Playing" : "Stopped"}
                                </span></div>
                                <div>Tick Rate: <span className="font-medium">{(1000 / tickInterval).toFixed(1)} Hz</span></div>
                                <div>Preset: <span className="font-medium">
                                    {soundEngine.getAvailablePresets().find(p => p.id === currentPreset)?.name || "Harmonic Layers"}
                                </span></div>
                            </div>

                            {/* Sound Controls */}
                            <div className="space-y-4">
                                {/* Sound Preset Selector */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-gray-700">Preset:</label>
                                    <select
                                        value={currentPreset}
                                        onChange={(e) => {
                                            handlePresetChange(e.target.value);
                                            animate('select', {
                                                scale: [1, 1.05, 1],
                                                duration: 200
                                            });
                                        }}
                                        className="px-3 py-2 text-sm border-2 border-purple-200 rounded-lg bg-white/80 hover:border-purple-400 transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-200 w-full"
                                        title="Select sound preset"
                                    >
                                        <option value="harmonic_layers">Harmonic Layers</option>
                                        <option value="electro_scene">Electro Scene</option>
                                        <option value="ambient_clouds">Ambient Clouds</option>
                                    </select>
                                </div>

                                {/* Tick Interval */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>Tick Interval:</span>
                                        <span className="text-xs font-medium text-gray-600">{tickInterval}ms</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="250"
                                        max="5000"
                                        step="250"
                                        value={tickInterval}
                                        onChange={(e) => handleTickIntervalChange([parseInt(e.target.value)])}
                                        className="w-full h-2 bg-gradient-to-r from-blue-300 to-purple-300 rounded-lg appearance-none cursor-pointer slider hover:from-blue-400 hover:to-purple-400 transition-all"
                                        title="Tick Interval"
                                    />
                                </div>

                                {/* Volume Control */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>Volume:</span>
                                        <span className="text-xs font-medium text-gray-600">{Math.round(masterVolume * 100)}%</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={masterVolume}
                                        onChange={(e) => handleVolumeChange([parseFloat(e.target.value)])}
                                        className="w-full h-2 bg-gradient-to-r from-green-300 to-blue-300 rounded-lg appearance-none cursor-pointer slider hover:from-green-400 hover:to-blue-400 transition-all"
                                        title="Volume"
                                    />
                                </div>

                                {/* Play/Pause Button */}
                                <Button
                                    onClick={(e) => {
                                        handlePlay();
                                        // Add click animation
                                        animate(e.currentTarget, {
                                            scale: [1, 0.95, 1.05, 1],
                                            duration: 300
                                        });
                                    }}
                                    variant={isPlaying ? "outline" : "default"}
                                    className={`w-full px-4 py-3 font-semibold text-base rounded-lg shadow-lg transition-all transform hover:scale-105 ${isPlaying
                                            ? "bg-red-500 hover:bg-red-600 text-white border-red-300"
                                            : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-transparent"
                                        }`}
                                >
                                    {isPlaying ? "⏹️ Stop" : "▶️ Play"}
                                </Button>
                            </div>
                        </div>

                        {/* Enhanced PGN Preview */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-white/50 p-6 hover:shadow-2xl transition-all duration-300">
                            <h3 className="font-bold text-lg bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent mb-4 flex items-center">
                                📝 PGN Data
                            </h3>
                            <div className="bg-gray-50/80 p-4 rounded-lg text-xs font-mono max-h-32 overflow-y-auto border border-gray-200 shadow-inner">
                                {pgnData || 'No game loaded - Select a game source above'}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;