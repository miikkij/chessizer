import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';

interface UseWavPlayerProps {
    currentFen?: string;
    isEnabled?: boolean;
    onError?: (error: string) => void;
    onSuccess?: () => void;
}

interface KitVoice {
    type: string;
    toneHz: number;
    decayMs: number;
    pan: number;
    gainDb: number;
}

interface GrooveTrack {
    voice: string;
    steps: number;
    pulses: number;
    rotate: number;
}

interface PatternStep {
    t: number;
    semitone: number;
    durMs: number;
}

interface Envelope {
    a: number;
    d: number;
    s: number;
    r: number;
}

interface Earcon {
    osc: string;
    env: Envelope;
    durMs: number;
    pattern?: PatternStep[];
    chord?: number[];
    arp?: number[];
    dyad?: number[];
    stepMs?: number;
}

interface EventCue {
    type: string;
    durMs?: number;
    leadMs?: number;
    gainDb?: number;
    panBySide?: Record<string, number>;
    fromHzWhite?: number;
    toHzWhite?: number;
    fromHzBlack?: number;
    toHzBlack?: number;
}

export interface WavConfig {
    version: string;
    name: string;
    audio: {
        sampleRate: number;
        bitDepth: number;
        channels: number;
        lengthMs: number;
        headroomDb: number;
    };
    limits: {
        maxConcurrentVoices: number;
        onsetOffsetMs: number[];
    };
    groove: {
        tempoBpm: number;
        bars: number;
        kit: Record<string, KitVoice>;
        tracks: GrooveTrack[];
    };
    pulseGrid: {
        earcons: Record<string, Earcon>;
        register: Record<string, string>;
        pan: Record<string, number>;
        gainDb: Record<string, number>;
    };
    halo: {
        mode: string;
        kernel: number[][];
        brightnessHz: Record<string, number>;
        width: Record<string, number>;
    };
    events: {
        capture: EventCue;
        check: EventCue;
    };
    ambient: {
        mode: string;
        root: string;
        qualityByMaterial: Record<string, string>;
        brightnessHz: Record<string, number>;
        gainDb: number;
    };
    traversal: {
        strategy: string;
        params: Record<string, string[] | string>;
        tickDurationMs: number;
    };
    changeRules: Record<string, { points?: number; action: string; amount?: number }>;
    diagnostics: {
        writeStemWavs: boolean;
        logSchedule: boolean;
    };
}

// Default WAV configuration
const DEFAULT_WAV_CONFIG: WavConfig = {
    version: "1.0",
    name: "chessSoundWaveDemo",
    audio: {
        sampleRate: 48000,
        bitDepth: 16,
        channels: 2,
        lengthMs: 4000,
        headroomDb: 6
    },
    limits: {
        maxConcurrentVoices: 4,
        onsetOffsetMs: [20, 50]
    },
    groove: {
        tempoBpm: 120,
        bars: 2,
        kit: {
            kick: { type: "sineClick", toneHz: 60, decayMs: 180, pan: 0.0, gainDb: -6 },
            snare: { type: "noiseSnap", toneHz: 180, decayMs: 140, pan: 0.0, gainDb: -9 },
            hat: { type: "noiseTick", toneHz: 8000, decayMs: 30, pan: 0.0, gainDb: -12 }
        },
        tracks: [
            { voice: "kick", steps: 16, pulses: 4, rotate: 0 },
            { voice: "snare", steps: 16, pulses: 3, rotate: 2 },
            { voice: "hat", steps: 16, pulses: 9, rotate: 0 }
        ]
    },
    pulseGrid: {
        earcons: {
            pawn: {
                osc: "triangle",
                env: { a: 5, d: 60, s: 0.2, r: 80 },
                durMs: 240,
                pattern: [
                    { t: 0, semitone: 0, durMs: 120 },
                    { t: 140, semitone: 2, durMs: 100 }
                ]
            },
            knight: {
                osc: "square",
                env: { a: 5, d: 80, s: 0.2, r: 120 },
                durMs: 350,
                pattern: [
                    { t: 0, semitone: 0, durMs: 90 },
                    { t: 120, semitone: 3, durMs: 90 },
                    { t: 240, semitone: -1, durMs: 90 }
                ]
            },
            bishop: {
                osc: "sine",
                env: { a: 5, d: 120, s: 0.2, r: 120 },
                durMs: 320,
                pattern: [
                    { t: 0, semitone: 0, durMs: 160 },
                    { t: 180, semitone: 2, durMs: 140 }
                ]
            },
            rook: {
                osc: "saw",
                env: { a: 5, d: 100, s: 0.2, r: 140 },
                chord: [0, 7, 12],
                durMs: 120
            },
            queen: {
                osc: "saw",
                env: { a: 5, d: 120, s: 0.2, r: 180 },
                arp: [0, 4, 7, 12],
                stepMs: 40,
                durMs: 220
            },
            king: {
                osc: "sine",
                env: { a: 5, d: 140, s: 0.2, r: 200 },
                dyad: [0, 7],
                durMs: 180
            }
        },
        register: { white: "C5", black: "C3" },
        pan: { white: -0.3, black: 0.3 },
        gainDb: { white: -10, black: -10 }
    },
    halo: {
        mode: "threat",
        kernel: [[0.25, 0.5, 0.25], [0.5, 1.0, 0.5], [0.25, 0.5, 0.25]],
        brightnessHz: { min: 800, max: 4000 },
        width: { min: 0.0, max: 0.5 }
    },
    events: {
        capture: {
            type: "click",
            durMs: 90,
            leadMs: 30,
            gainDb: -4,
            panBySide: { white: -0.3, black: 0.3 }
        },
        check: {
            type: "glide",
            fromHzWhite: 1100,
            toHzWhite: 1800,
            fromHzBlack: 400,
            toHzBlack: 260,
            durMs: 200,
            gainDb: -6
        }
    },
    ambient: {
        mode: "triad",
        root: "C2",
        qualityByMaterial: { white: "major", black: "minor" },
        brightnessHz: { white: 1200, black: 800 },
        gainDb: -20
    },
    traversal: {
        strategy: "spiralFromCenter",
        params: { center: ["d4", "e4", "d5", "e5"], orientation: "cw" },
        tickDurationMs: 300
    },
    changeRules: {
        onMaterialSwing: { points: 1, action: "addHatFill" },
        onCheck: { action: "raiseBrightness", amount: 0.2 },
        onCapture: { action: "kickFill" },
        onQuiet: { action: "reduceHalo", amount: 0.2 }
    },
    diagnostics: {
        writeStemWavs: false,
        logSchedule: true
    }
};

/** @deprecated Use `useWavPlayer` instead */
export const WavSoundPlayer = useWavPlayer;

export function useWavPlayer({
    currentFen,
    isEnabled = true,
    onError,
    onSuccess
}: UseWavPlayerProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [wavConfig, setWavConfig] = useState<WavConfig>(DEFAULT_WAV_CONFIG);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [volume, setVolume] = useState(0.7);
    const [microserviceUrl, setMicroserviceUrl] = useState('http://localhost:8001');
    const [isLooping, setIsLooping] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [lastFenPlayed, setLastFenPlayed] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const generateAndPlayRef = useRef<(() => Promise<void>) | null>(null);

    const generateAndPlay = useCallback(async () => {
        if (!currentFen) {
            onError?.('No chess position available');
            return;
        }

        if (!isEnabled) {
            onError?.('WAV player is disabled');
            return;
        }

        // Cancel any existing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsGenerating(true);

        try {
            // Clean up previous audio
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }

            // Generate WAV from microservice
            const response = await axios.post(
                `${microserviceUrl}/generate`,
                {
                    fen: currentFen,
                    config: wavConfig
                },
                {
                    responseType: 'blob',
                    signal: abortController.signal,
                    timeout: 30000, // 30 second timeout
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (abortController.signal.aborted) {
                return;
            }

            // Create blob URL for audio playback
            const blob = new Blob([response.data], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);

            // Play the generated audio
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.volume = volume;
                audioRef.current.loop = isLooping;
                audioRef.current.playbackRate = playbackSpeed;
                await audioRef.current.play();
                setIsPlaying(true);
                setLastFenPlayed(currentFen); // Track which FEN we're playing
                onSuccess?.();
            }

        } catch (error: unknown) {
            if (axios.isCancel(error) || abortController.signal.aborted) {
                // Request was cancelled, ignore
                return;
            }

            console.error('Error generating WAV:', error);

            let errorMessage = 'Failed to generate sound';
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404 || error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
                    errorMessage = 'WAV server not running. Start it with: cd soundAgentsv2 && start.bat';
                } else if (error.response?.status === 400) {
                    errorMessage = `Invalid request: ${error.response.data?.detail || 'Bad request'}`;
                } else if (error.response?.status === 500) {
                    errorMessage = `Server error: ${error.response.data?.detail || 'Internal error'}`;
                } else if (error.code === 'ENOTFOUND') {
                    errorMessage = 'Cannot reach WAV server. Check connection and URL.';
                }
            }

            onError?.(errorMessage);
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    }, [currentFen, isEnabled, wavConfig, microserviceUrl, volume, audioUrl, onError, onSuccess, isLooping, playbackSpeed]);

    // Store the generateAndPlay function in a ref to avoid dependency issues
    generateAndPlayRef.current = generateAndPlay;

    const stopPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }

        // Reset the FEN tracking when stopping
        setLastFenPlayed(null);

        // Cancel generation if in progress
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsGenerating(false);
        }
    }, []);

    const handleAudioEnded = useCallback(() => {
        // Only set playing to false if not looping
        if (!isLooping) {
            setIsPlaying(false);
        }
    }, [isLooping]);

    const handleVolumeChange = useCallback((newVolume: number) => {
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    }, []);

    const handleLoopChange = useCallback((loop: boolean) => {
        setIsLooping(loop);
        if (audioRef.current) {
            audioRef.current.loop = loop;
        }
    }, []);

    const handleSpeedChange = useCallback((speed: number) => {
        setPlaybackSpeed(speed);
        if (audioRef.current) {
            audioRef.current.playbackRate = speed;
        }
    }, []);

    // Initialize audio element and event listeners
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }

        const audio = audioRef.current;

        // Set up event listeners
        audio.addEventListener('ended', handleAudioEnded);

        // Cleanup
        return () => {
            audio.removeEventListener('ended', handleAudioEnded);
        };
    }, [handleAudioEnded]);

    // BUG-007 FIX: Auto-regenerate with proper debounce (500ms) and abort previous requests
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        let aborted = false;

        // Only auto-regenerate if:
        // 1. We're currently playing in loop mode
        // 2. The current FEN is different from the one we're playing
        // 3. We have a valid FEN
        if (isPlaying && isLooping && currentFen && currentFen !== lastFenPlayed) {
            // Abort any in-flight requests before scheduling new one
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Debounce: 500ms to avoid rapid regeneration during quick position changes
            timeoutId = setTimeout(async () => {
                if (aborted) return;
                if (import.meta.env.DEV) {
                    console.log(`Auto-regenerating WAV: FEN changed to ${currentFen}`);
                }
                try {
                    if (generateAndPlayRef.current) {
                        await generateAndPlayRef.current();
                    }
                } catch (error) {
                    if (!aborted) {
                        console.error('Auto-regeneration failed:', error);
                    }
                }
            }, 500);
        }

        return () => {
            aborted = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [currentFen, lastFenPlayed, isPlaying, isLooping]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    return {
        generateAndPlay,
        stopPlayback,
        isGenerating,
        isPlaying,
        volume,
        setVolume: handleVolumeChange,
        isLooping,
        setLooping: handleLoopChange,
        playbackSpeed,
        setPlaybackSpeed: handleSpeedChange,
        wavConfig,
        setWavConfig,
        microserviceUrl,
        setMicroserviceUrl,
        audioRef,
        onAudioEnded: handleAudioEnded
    };
}

export default useWavPlayer;