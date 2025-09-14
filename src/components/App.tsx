import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Ajv from "ajv";
import { Button } from "./ui/button";
// import { Slider } from "./ui/slider";
import PGNViewerWrapper from "./PGNViewerWrapper";
import PGNLoader from "./PGNLoader";
// import { ToneEngine } from "../audio/ToneEngine";
import { SoundAgent, type SoundAgentConfig } from "../audio/SoundAgent";
import { animate } from 'animejs';
import EarconTester from "./EarconTester";
import TraversalControls from "./TraversalControls";
import ConfigEditor from "./ConfigEditor";
import { WavPlayerControls } from "./WavPlayerControls";
import { Toaster, toast } from 'react-hot-toast';

function App() {
    // const [soundEngine] = useState(() => new ToneEngine());
    const [agent, setAgent] = useState<SoundAgent | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    // Settings persisted in localStorage
    const readNumber = (key: string, fallback: number, min?: number, max?: number) => {
        try {
            const raw = localStorage.getItem(key);
            if (raw == null) return fallback;
            const n = Number(raw);
            if (Number.isNaN(n)) return fallback;
            if (typeof min === 'number' && n < min) return min;
            if (typeof max === 'number' && n > max) return max;
            return n;
        } catch {
            return fallback;
        }
    };
    const [bpm, setBpm] = useState(() => readNumber('settings.bpm', 120, 40, 300));
    const [swing, setSwing] = useState(() => readNumber('settings.swing', 0, 0, 1)); // 0..1
    const [tickMs, setTickMs] = useState(() => readNumber('settings.tickMs', 1000, 250, 5000));
    const [masterVolume, setMasterVolume] = useState(() => readNumber('settings.volume', 0.7, 0, 1)); // 0..1
    const [gamePreset, setGamePreset] = useState('immortal_game');
    const [pgnData, setPgnData] = useState('');
    const [currentFen, setCurrentFen] = useState('');
    const [moveIndex, setMoveIndex] = useState(0);
    const [externalMoveIndex, setExternalMoveIndex] = useState<number | undefined>(undefined); // Only set when navigating externally
    const [moveCount, setMoveCount] = useState(1);
    const appRef = useRef<HTMLDivElement>(null);
    // Gate persisting to localStorage so we can clear without immediately re-saving defaults
    const persistRef = useRef(true);

    // Initialize sound agent and load config
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const cfg = await (await fetch('/configs/sound-agent-demo.json')).json();
                // Minimal runtime validation to catch common errors early
                const ajv = new Ajv({ allErrors: true, allowUnionTypes: true })
                const schema = {
                    type: "object",
                    required: ["version", "name", "traversal"],
                    properties: {
                        version: { type: "string" },
                        name: { type: "string" },
                        transport: { type: "object", additionalProperties: true },
                        limits: { type: "object", additionalProperties: true },
                        voices: { type: "object" },
                        mappings: { type: "object" },
                        colors: { type: "object" },
                        traversal: {
                            type: "object",
                            required: ["strategy"],
                            properties: {
                                strategy: { type: "string" },
                                tickDurationMs: { type: "number" }
                            },
                            additionalProperties: true
                        },
                        events: { type: "object" },
                        scaling: { type: "object" },
                        diagnostics: { type: "object" }
                    },
                    additionalProperties: true
                } as const
                const validate = ajv.compile(schema)
                if (!validate(cfg)) {
                    console.error("SoundAgent config validation errors", validate.errors)
                    toast.error('Audio config failed validation — see console for details')
                    return
                }
                if (!mounted) return;
                const a = new SoundAgent(cfg);
                setAgent(a);
                toast.success('🎵 SoundAgent ready');
            } catch (e) {
                console.error('Failed to load SoundAgent config', e);
                toast.error('Failed to load audio config');
            }
        })();

        // Add entrance animation
        setTimeout(() => {
            if (appRef.current) {
                animate(appRef.current.querySelectorAll('.animate-in'), {
                    opacity: [0, 1],
                    translateY: [30, 0],
                    duration: 800,
                    delay: (_unused, i) => i * 100,
                    easing: 'easeOutCubic'
                });
            }
        }, 100);
        return () => { mounted = false };
    }, []);

    // Keep SoundAgent in sync with current position
    useEffect(() => {
        if (agent && currentFen) {
            agent.setPosition(currentFen);
        }
    }, [agent, currentFen]);

    const handlePlay = async () => {
        if (!agent || !currentFen) return;
        if (!isPlaying) {
            await agent.init();
            agent.setTransport({ bpm, swing });
            // Apply persisted volume after init so masterGain exists
            agent.setMasterVolume(masterVolume);
            agent.setTickDuration(tickMs);
            await agent.start();
            setIsPlaying(true);
        } else {
            agent.stop();
            setIsPlaying(false);
        }
    };

    const handleBpmChange = (value: number[]) => {
        const v = value[0];
        setBpm(v);
        agent?.setTransport({ bpm: v });
    }

    const handleSwingChange = (value: number[]) => {
        const v = value[0] / 100; // slider 0..100 -> 0..1
        setSwing(v);
        agent?.setTransport({ swing: v });
    }

    const handleTickChange = (value: number[]) => {
        const v = value[0];
        setTickMs(v);
        agent?.setTickDuration(v);
    }

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setMasterVolume(newVolume);
        agent?.setMasterVolume(newVolume);
    };

    const handleConfigChange = useCallback((config: unknown, configPath: string) => {
        if (configPath === '/configs/sound-agent-demo.json' && config) {
            // Reload the SoundAgent with the new configuration
            try {
                const newAgent = new SoundAgent(config as SoundAgentConfig);
                setAgent(newAgent);
                toast.success('🎵 SoundAgent config updated');

                // If we were playing, restart with the new config
                if (isPlaying) {
                    setIsPlaying(false);
                    setTimeout(async () => {
                        await newAgent.init();
                        newAgent.setTransport({ bpm, swing });
                        newAgent.setMasterVolume(masterVolume);
                        newAgent.setTickDuration(tickMs);
                        if (currentFen) {
                            newAgent.setPosition(currentFen);
                            await newAgent.start();
                            setIsPlaying(true);
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('Failed to apply new config:', error);
                toast.error('Failed to apply new configuration');
            }
        }
    }, [bpm, swing, masterVolume, tickMs, currentFen, isPlaying]);

    const handleResetSettings = () => {
        try {
            // prevent effects from re-persisting during reset
            persistRef.current = false;
            localStorage.removeItem('settings.bpm');
            localStorage.removeItem('settings.swing');
            localStorage.removeItem('settings.volume');
            localStorage.removeItem('settings.tickMs');
        } catch { /* ignore */ }
        // Reset in-memory UI state to defaults
        setBpm(120);
        setSwing(0);
        setMasterVolume(0.7);
        setTickMs(1000);
        // Apply immediately to agent if present
        agent?.setTransport({ bpm: 120, swing: 0 });
        agent?.setMasterVolume(0.7);
        agent?.setTickDuration(1000);
        toast.success('Audio settings cleared and reset to defaults');
        // re-enable persistence after this render cycle
        setTimeout(() => { persistRef.current = true }, 0);
    };

    // Persist selected settings
    useEffect(() => {
        if (!persistRef.current) return;
        try { localStorage.setItem('settings.bpm', String(bpm)); } catch { /* ignore */ }
    }, [bpm]);
    useEffect(() => {
        if (!persistRef.current) return;
        try { localStorage.setItem('settings.swing', String(swing)); } catch { /* ignore */ }
    }, [swing]);
    useEffect(() => {
        if (!persistRef.current) return;
        try { localStorage.setItem('settings.volume', String(masterVolume)); } catch { /* ignore */ }
    }, [masterVolume]);
    useEffect(() => {
        if (!persistRef.current) return;
        try { localStorage.setItem('settings.tickMs', String(tickMs)); } catch { /* ignore */ }
    }, [tickMs]);

    // Preset system removed in favor of JSON agent config; keep placeholder if needed later

    // Game presets with interesting chess games
    const gamePresets = useMemo(() => ({
        'immortal_game': {
            name: "The Immortal Game",
            description: "Anderssen vs Kieseritzky, 1851 - Famous sacrificial attack",
            pgn: `[Event "Immortal Game"]
[Site "London"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g3 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7# 1-0`
        },
        'evergreen_game': {
            name: "The Evergreen Game",
            description: "Anderssen vs Dufresne, 1852 - Brilliant queen sacrifice",
            pgn: `[Event "Evergreen Game"]
[Site "Berlin"]
[Date "1852.??.??"]
[White "Adolf Anderssen"]
[Black "Jean Dufresne"]
[Result "1-0"]

1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O d3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4 Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6 Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8 23.Bd7+ Kf8 24.Bxe7# 1-0`
        },
        'game_of_the_century': {
            name: "Game of the Century",
            description: "Byrne vs Fischer, 1956 - 13-year-old Fischer's masterpiece",
            pgn: `[Event "Rosenwald Memorial"]
[Site "New York"]
[Date "1956.10.17"]
[White "Donald Byrne"]
[Black "Robert James Fischer"]
[Result "0-1"]

1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6 8.e4 Nbd7 9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5 Na4 12.Qa3 Nxc3 13.bxc3 Nxe4 14.Bxe7 Qb6 15.Bc4 Nxc3 16.Bc5 Rfe8+ 17.Kf1 Be6 18.Bxb6 Bxc4+ 19.Kg1 Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+ 22.Kf1 Nc3+ 23.Kg1 axb6 24.Qb4 Ra4 25.Qxb6 Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1 29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3 Ne4 32.Qb8 b5 33.h4 h6 34.Ne5 Kg7 35.Kg1 Bc5+ 36.Kf1 Ng3+ 37.Ke1 Bb4+ 38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2# 0-1`
        },
        'kasparov_deep_blue': {
            name: "Kasparov vs Deep Blue",
            description: "Game 6, 1997 - Historic computer victory",
            pgn: `[Event "IBM Man-Machine"]
[Site "New York"]
[Date "1997.05.11"]
[White "Deep Blue"]
[Black "Garry Kasparov"]
[Result "1-0"]

1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Ng5 Ngf6 6.Bd3 e6 7.N1f3 h6 8.Nxe6 Qe7 9.O-O fxe6 10.Bg6+ Kd8 11.Bf4 b5 12.a4 Bb7 13.Re1 Nd5 14.Bg3 Kc8 15.axb5 cxb5 16.Qd3 Bc6 17.Bf5 exf5 18.Rxe7 Bxe7 19.c4 1-0`
        },
        'opera_game': {
            name: "The Opera Game",
            description: "Morphy vs Duke Karl, 1858 - Brilliant consultation game",
            pgn: `[Event "Paris Opera"]
[Site "Paris"]
[Date "1858.11.02"]
[White "Paul Morphy"]
[Black "Duke Karl/Count Isouard"]
[Result "1-0"]

1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0`
        },
        'queen_endgame': {
            name: "Queen vs Pawns Endgame",
            description: "Queen endgame technique demonstration",
            pgn: `[Event "Endgame Study"]
[Site "Chessizer"]
[Date "2025.01.01"]
[White "White"]
[Black "Black"]
[FEN "8/8/8/8/8/k7/1pp5/1Q6 w - - 0 1"]
[Result "1-0"]

1.Qb3+ Ka2 2.Qc2 Ka3 3.Qc3+ Ka4 4.Qc4+ Ka5 5.Qc5+ Ka6 6.Qc6+ Ka7 7.Qc7+ Ka8 8.Qxb7# 1-0`
        }
    }), []);

    const generatePGN = useCallback((presetId: string) => {
        return gamePresets[presetId as keyof typeof gamePresets]?.pgn || gamePresets.immortal_game.pgn;
    }, [gamePresets]);

    const handleGamePresetChange = (presetId: string) => {
        setGamePreset(presetId);
        const newPGN = generatePGN(presetId);
        setPgnData(newPGN);
        // The PGNViewer will call handlePositionChange with the initial position
    };
    const handlePositionChange = (fen: string, moveNumber: number) => {
        console.log('App: Position changed:', fen, 'move:', moveNumber);
        // Only update state if values actually changed to prevent infinite loops
        setCurrentFen((prev) => {
            if (prev !== fen) {
                console.log('App: FEN changed from', prev, 'to', fen);
                return fen;
            }
            return prev;
        });
        // Only update moveIndex if we're not in the middle of external navigation
        if (externalMoveIndex === undefined) {
            setMoveIndex((prev) => {
                if (prev !== moveNumber) {
                    console.log('App: Move index changed from', prev, 'to', moveNumber);
                    return moveNumber;
                }
                return prev;
            });
        }
    };

    // Initialize with current game preset
    useEffect(() => {
        const initialPGN = generatePGN(gamePreset);
        setPgnData(initialPGN);
        // The PGNViewer will call handlePositionChange with the initial position
    }, [generatePGN, gamePreset]);

    // Clear external move index after it's been processed
    useEffect(() => {
        if (externalMoveIndex !== undefined) {
            const timer = setTimeout(() => {
                setExternalMoveIndex(undefined);
            }, 100); // Give PGNViewer time to process
            return () => clearTimeout(timer);
        }
    }, [externalMoveIndex]); return (
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
                        {/* Game Preset Selector */}
                        <div className="flex items-center gap-3 bg-white/60 px-4 py-2 rounded-lg shadow-sm border border-white/50">
                            <label className="text-sm font-semibold text-gray-700">� Game:</label>
                            <select
                                value={gamePreset}
                                onChange={(e) => {
                                    handleGamePresetChange(e.target.value);
                                    animate('select', {
                                        scale: [1, 1.05, 1],
                                        duration: 200
                                    });
                                }}
                                className="px-3 py-1.5 text-sm border-2 border-blue-200 rounded-lg bg-white/80 hover:border-blue-400 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                title="Select famous chess game"
                            >
                                <option value="immortal_game">The Immortal Game</option>
                                <option value="evergreen_game">The Evergreen Game</option>
                                <option value="game_of_the_century">Game of the Century</option>
                                <option value="kasparov_deep_blue">Kasparov vs Deep Blue</option>
                                <option value="opera_game">The Opera Game</option>
                                <option value="queen_endgame">Queen vs Pawns Endgame</option>
                            </select>
                        </div>

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
                                        externalIndex={externalMoveIndex}
                                        onGameLengthChange={setMoveCount}
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
                                <div>Game: <span className="font-medium">{gamePresets[gamePreset as keyof typeof gamePresets]?.name || 'Unknown'}</span></div>
                                <div>Current FEN: <span className="font-mono text-xs break-all">{currentFen || 'Loading...'}</span></div>
                            </div>
                        </div>

                        {/* Sound Status & Controls */}
                        <div className="rounded-lg border bg-card p-4">
                            <h3 className="font-semibold mb-4">🎵 Sound Engines</h3>

                            {/* Engine Status */}
                            <div className="space-y-2 text-sm mb-4">
                                <div>Tone.js Engine: <span className={isPlaying ? "text-green-600" : "text-red-600"}>
                                    {isPlaying ? "Playing" : "Stopped"}
                                </span></div>
                                <div>Current Position: <span className="font-medium text-xs break-all">{currentFen || 'None'}</span></div>
                            </div>

                            {/* Tone.js Controls */}
                            <div className="space-y-4 mb-6">
                                <h4 className="font-medium text-sm text-gray-700 border-b pb-1">Tone.js Real-time Engine</h4>
                                {/* Transport Controls */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>BPM:</span>
                                        <span className="text-xs font-medium text-gray-600">{bpm}</span>
                                    </label>
                                    <input aria-label="BPM" title="BPM" type="range" min="60" max="200" step="1" value={bpm} onChange={(e) => handleBpmChange([parseInt(e.target.value)])} className="w-full h-2 bg-gradient-to-r from-blue-300 to-purple-300 rounded-lg" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>Swing:</span>
                                        <span className="text-xs font-medium text-gray-600">{Math.round(swing * 100)}%</span>
                                    </label>
                                    <input aria-label="Swing" title="Swing" type="range" min="0" max="100" step="1" value={Math.round(swing * 100)} onChange={(e) => handleSwingChange([parseInt(e.target.value)])} className="w-full h-2 bg-gradient-to-r from-blue-300 to-purple-300 rounded-lg" />
                                </div>

                                {/* Tick Duration */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>Tick duration:</span>
                                        <span className="text-xs font-medium text-gray-600">{(tickMs / 1000).toFixed(2)} s</span>
                                    </label>
                                    <input
                                        aria-label="Tick duration"
                                        title="Tick duration"
                                        type="range"
                                        min="250"
                                        max="5000"
                                        step="50"
                                        value={tickMs}
                                        onChange={(e) => handleTickChange([parseInt(e.target.value)])}
                                        className="w-full h-2 bg-gradient-to-r from-indigo-300 to-pink-300 rounded-lg"
                                    />
                                </div>

                                {/* Volume control remains */}

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

                                {/* Config Editor Button */}
                                <ConfigEditor onConfigChange={handleConfigChange} />

                                {/* Simple timeline controls to ensure FEN moves */}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            const newIndex = Math.max(0, moveIndex - 1);
                                            setExternalMoveIndex(newIndex);
                                            setMoveIndex(newIndex);
                                        }}
                                    >
                                        ◀ Prev
                                    </Button>
                                    <div className="text-xs text-gray-600 min-w-[90px] text-center">
                                        {moveIndex + 1} / {moveCount}
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            const newIndex = Math.min(moveCount - 1, moveIndex + 1);
                                            setExternalMoveIndex(newIndex);
                                            setMoveIndex(newIndex);
                                        }}
                                    >
                                        Next ▶
                                    </Button>
                                </div>

                                {/* Reset settings button */}
                                <Button
                                    onClick={handleResetSettings}
                                    variant="outline"
                                    className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                                >
                                    Reset audio settings
                                </Button>
                            </div>

                            {/* WAV Generator Engine */}
                            <div className="space-y-3 pt-4 border-t">
                                <h4 className="font-medium text-sm text-gray-700 border-b pb-1">Python WAV Generator</h4>
                                <WavPlayerControls
                                    currentFen={currentFen}
                                    isEnabled={!!currentFen}
                                />
                            </div>
                        </div>

                        <TraversalControls agent={agent} />
                        <EarconTester agent={agent} />

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