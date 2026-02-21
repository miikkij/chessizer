import { useState, useEffect, useCallback, useRef } from "react";
import Ajv from "ajv";
import { Button } from "./ui/button";
import PGNViewerWrapper from "./PGNViewerWrapper";
import PGNLoader from "./PGNLoader";
import { SoundAgent, type SoundAgentConfig } from "../audio/SoundAgent";
import { animate } from 'animejs';
import EarconTester from "./EarconTester";
import TraversalControls from "./TraversalControls";
import ConfigEditor from "./ConfigEditor";
import { WavPlayerControls } from "./WavPlayerControls";
import { Toaster, toast } from 'react-hot-toast';
import { GAME_PRESETS, getPresetPGN } from "../data/gamePresets";

function App() {
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

    const handlePlay = useCallback(async () => {
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
    }, [agent, currentFen, isPlaying, bpm, swing, masterVolume, tickMs]);

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
                // BUG-001 FIX: Dispose the old agent to prevent audio node memory leaks
                if (agent) {
                    agent.stop();
                    agent.dispose();
                }

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
    }, [agent, bpm, swing, masterVolume, tickMs, currentFen, isPlaying]);

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

    // Game presets extracted to src/data/gamePresets.ts

    const handleGamePresetChange = (presetId: string) => {
        setGamePreset(presetId);
        setPgnData(getPresetPGN(presetId));
    };
    const handlePositionChange = (fen: string, moveNumber: number) => {
        if (import.meta.env.DEV) console.log('App: Position changed:', fen, 'move:', moveNumber);
        // Only update state if values actually changed to prevent infinite loops
        setCurrentFen((prev) => {
            if (prev !== fen) {
                if (import.meta.env.DEV) console.log('App: FEN changed from', prev, 'to', fen);
                return fen;
            }
            return prev;
        });
        // Only update moveIndex if we're not in the middle of external navigation
        if (externalMoveIndex === undefined) {
            setMoveIndex((prev) => {
                if (prev !== moveNumber) {
                    if (import.meta.env.DEV) console.log('App: Move index changed from', prev, 'to', moveNumber);
                    return moveNumber;
                }
                return prev;
            });
        }
    };

    // Initialize with current game preset
    useEffect(() => {
        setPgnData(getPresetPGN(gamePreset));
    }, [gamePreset]);

    // BUG-004 FIX: Acknowledgement callback — PGNViewerWrapper calls this after
    // it has consumed externalMoveIndex, so we can safely clear it without a race.
    const handleExternalIndexProcessed = useCallback(() => {
        setExternalMoveIndex(undefined);
    }, []);

    // Keyboard shortcuts for transport controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't intercept if user is typing in an input/textarea
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

            switch (e.key) {
                case ' ': // Space = play/stop toggle
                    e.preventDefault();
                    handlePlay();
                    break;
                case 'ArrowLeft': // Left arrow = previous move
                    e.preventDefault();
                    {
                        const newIndex = Math.max(0, moveIndex - 1);
                        setExternalMoveIndex(newIndex);
                        setMoveIndex(newIndex);
                    }
                    break;
                case 'ArrowRight': // Right arrow = next move
                    e.preventDefault();
                    {
                        const newIndex = Math.min(moveCount - 1, moveIndex + 1);
                        setExternalMoveIndex(newIndex);
                        setMoveIndex(newIndex);
                    }
                    break;
                case 'Home': // Home = first move
                    e.preventDefault();
                    setExternalMoveIndex(0);
                    setMoveIndex(0);
                    break;
                case 'End': // End = last move
                    e.preventDefault();
                    {
                        const lastIdx = Math.max(0, moveCount - 1);
                        setExternalMoveIndex(lastIdx);
                        setMoveIndex(lastIdx);
                    }
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [moveIndex, moveCount, handlePlay]);

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
                            if (import.meta.env.DEV) console.log('Game loaded with', fens.length, 'positions');
                            // For now, just use the first position
                            if (fens.length > 0) {
                                setCurrentFen(fens[0]);
                            }
                        }} />

                        {/* PGN Data - Same height as game selection */}
                        <div className="flex items-center gap-3 bg-white/60 px-4 py-2 rounded-lg shadow-sm border border-white/50">
                            <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">📝 PGN Data:</label>
                            <div className="bg-gray-50/80 p-2 rounded text-xs font-mono w-96 h-83 overflow-y-auto border border-gray-200 shadow-inner">
                                {pgnData || 'No game loaded - Select a game source above'}
                            </div>
                        </div>

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
                                        onExternalIndexProcessed={handleExternalIndexProcessed}
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
                                <div>Game: <span className="font-medium">{GAME_PRESETS[gamePreset]?.name || 'Unknown'}</span></div>
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
                                        step="0.01"
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
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;