import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import axios from 'axios';
import type { PositionTransition } from '../chess/game';

interface UseWavPlayerProps {
    currentFen?: string;
    previousFen?: string;
    transition: PositionTransition;
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

export function useWavPlayer({
    currentFen,
    previousFen,
    transition,
    isEnabled = true,
    onError,
    onSuccess
}: UseWavPlayerProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [wavConfig, setWavConfig] = useState<WavConfig>(DEFAULT_WAV_CONFIG);
    const [error, setError] = useState<string | null>(null);
    const [volume, setVolume] = useState(0.7);
    const [microserviceUrl, setMicroserviceUrl] = useState('http://localhost:8001');
    const [isLooping, setIsLooping] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const generateAndPlayRef = useRef<(() => Promise<void>) | null>(null);
    const mountedRef = useRef(false);
    const requestIdRef = useRef(0);
    const wantsPlaybackRef = useRef(false);
    const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const positionKey = `${currentFen ?? ''}|${transition.kind}|${previousFen ?? ''}`;
    const activePositionRef = useRef(positionKey);
    const playbackSettingsRef = useRef({ volume, isLooping, playbackSpeed });

    const releaseAudio = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
        }
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
        }
    }, []);

    const cancelActive = useCallback(() => {
        requestIdRef.current += 1;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        if (restartTimerRef.current !== null) {
            clearTimeout(restartTimerRef.current);
            restartTimerRef.current = null;
        }
        releaseAudio();
    }, [releaseAudio]);

    const generateAndPlay = useCallback(async () => {
        if (!mountedRef.current || !currentFen || !isEnabled) return;

        cancelActive();
        const requestId = requestIdRef.current;
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        wantsPlaybackRef.current = true;
        setError(null);
        setIsPlaying(false);
        setIsGenerating(true);
        const isCurrent = () => mountedRef.current
            && requestIdRef.current === requestId
            && activePositionRef.current === positionKey
            && !abortController.signal.aborted;

        try {
            const response = await axios.post(
                `${microserviceUrl}/generate`,
                {
                    fen: currentFen,
                    config: wavConfig,
                    // History navigation and loading never replay move events.
                    ...(transition.kind === 'forward' && previousFen ? { previousFen } : {})
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

            if (!isCurrent()) return;

            const blob = new Blob([response.data], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;
            const audio = audioRef.current;
            if (!audio) throw new Error('Audio player is unavailable');
            audio.src = url;
            audio.volume = playbackSettingsRef.current.volume;
            audio.loop = playbackSettingsRef.current.isLooping;
            audio.playbackRate = playbackSettingsRef.current.playbackSpeed;
            await audio.play();
            if (!isCurrent()) return;
            setIsPlaying(true);
            onSuccess?.();

        } catch (error: unknown) {
            if (!isCurrent() || axios.isCancel(error)) return;

            console.error('Error generating WAV:', error);

            let errorMessage = 'Failed to generate sound';
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404 || error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
                    errorMessage = 'WAV server not running. Start it with: cd soundAgentsv2 && start.bat';
                } else if (error.response?.status === 400 || error.response?.status === 422) {
                    errorMessage = 'Invalid chess position or WAV configuration';
                } else if (error.response?.status === 500) {
                    errorMessage = 'WAV server could not generate this sound';
                } else if (error.code === 'ENOTFOUND') {
                    errorMessage = 'Cannot reach WAV server. Check connection and URL.';
                }
            }
            releaseAudio();
            wantsPlaybackRef.current = false;
            setError(errorMessage);
            onError?.(errorMessage);
        } finally {
            // An older request must never clear a newer request's busy state.
            if (isCurrent()) {
                setIsGenerating(false);
                abortControllerRef.current = null;
            }
        }
    }, [currentFen, previousFen, transition.kind, positionKey, isEnabled, wavConfig, microserviceUrl, onError, onSuccess, cancelActive, releaseAudio]);

    const stopPlayback = useCallback(() => {
        wantsPlaybackRef.current = false;
        cancelActive();
        setIsPlaying(false);
        setIsGenerating(false);
        setError(null);
    }, [cancelActive]);

    const handleAudioEnded = useCallback(() => {
        // Only set playing to false if not looping
        if (!isLooping) {
            wantsPlaybackRef.current = false;
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
        if (!loop && restartTimerRef.current !== null) {
            stopPlayback();
        }
        if (audioRef.current) {
            audioRef.current.loop = loop;
        }
    }, [stopPlayback]);

    const handleSpeedChange = useCallback((speed: number) => {
        setPlaybackSpeed(speed);
        if (audioRef.current) {
            audioRef.current.playbackRate = speed;
        }
    }, []);

    useLayoutEffect(() => {
        generateAndPlayRef.current = generateAndPlay;
        playbackSettingsRef.current = { volume, isLooping, playbackSpeed };
    }, [generateAndPlay, volume, isLooping, playbackSpeed]);

    useLayoutEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            wantsPlaybackRef.current = false;
            cancelActive();
        };
    }, [cancelActive]);

    useLayoutEffect(() => {
        const changed = activePositionRef.current !== positionKey;
        activePositionRef.current = positionKey;
        if (!changed && isEnabled) return;

        const restart = wantsPlaybackRef.current && isLooping && isEnabled && !!currentFen;
        cancelActive();
        setIsPlaying(false);
        setIsGenerating(false);
        setError(null);
        wantsPlaybackRef.current = restart;
        if (restart) {
            setIsGenerating(true);
            restartTimerRef.current = setTimeout(() => {
                restartTimerRef.current = null;
                if (wantsPlaybackRef.current && mountedRef.current) {
                    void generateAndPlayRef.current?.();
                }
            }, 500);
        }
    }, [positionKey, currentFen, isEnabled, isLooping, cancelActive]);

    return {
        generateAndPlay,
        stopPlayback,
        isGenerating,
        isPlaying,
        error,
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
