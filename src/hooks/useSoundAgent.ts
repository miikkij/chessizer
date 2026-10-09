import { useCallback, useEffect, useRef, useState } from 'react';
import Ajv from 'ajv';
import { SoundAgent, type SoundAgentConfig } from '../audio/SoundAgent';
import type { PositionFrame, PositionTransition } from '../chess/game';

interface PlaybackSettings {
    bpm: number;
    swing: number;
    tickMs: number;
    masterVolume: number;
}

const validateConfig = new Ajv({ allErrors: true }).compile({
    type: 'object',
    required: ['version', 'name', 'voices', 'mappings', 'traversal'],
    properties: {
        version: { type: 'string' },
        name: { type: 'string' },
        voices: { type: 'object', minProperties: 1 },
        mappings: {
            type: 'object', required: ['pieceEarcons'],
            properties: { pieceEarcons: { type: 'object', minProperties: 1 } },
        },
        traversal: {
            type: 'object', required: ['strategy'],
            properties: { strategy: { type: 'string' }, tickDurationMs: { type: 'number', minimum: 1 } },
        },
    },
});

export function useSoundAgent(frame: PositionFrame, transition: PositionTransition) {
    const [agent, setAgent] = useState<SoundAgent | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const agentRef = useRef<SoundAgent | null>(null);
    const playingRef = useRef(false);
    const startingRef = useRef(false);
    const generationRef = useRef(0);

    const replaceAgent = useCallback((config: unknown) => {
        if (!validateConfig(config)) throw new Error('Invalid sound configuration. Check voices, mappings and traversal.');
        generationRef.current += 1;
        agentRef.current?.setPlaybackListener(null);
        agentRef.current?.dispose();
        const next = new SoundAgent(structuredClone(config) as SoundAgentConfig);
        next.setPlaybackListener((playing) => {
            playingRef.current = playing;
            setIsPlaying(playing);
        });
        agentRef.current = next;
        playingRef.current = false;
        startingRef.current = false;
        setIsPlaying(false);
        setIsStarting(false);
        setError(null);
        setAgent(next);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const generation = generationRef.current;
        async function load() {
            try {
                const response = await fetch('/configs/sound-agent-demo.json', { signal: controller.signal });
                if (!response.ok) throw new Error('Could not load sound configuration. Reload to try again.');
                const config: unknown = await response.json();
                if (!controller.signal.aborted && generation === generationRef.current) replaceAgent(config);
            } catch (cause) {
                if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not prepare audio.');
            }
        }
        void load();
        return () => {
            controller.abort();
            generationRef.current += 1;
            agentRef.current?.setPlaybackListener(null);
            agentRef.current?.dispose();
            agentRef.current = null;
        };
    }, [replaceAgent]);

    useEffect(() => {
        agent?.setPosition(frame.fen, transition);
    }, [agent, frame, transition]);

    const toggle = useCallback(async (getSettings: () => PlaybackSettings) => {
        const current = agentRef.current;
        if (!current || startingRef.current) return;
        if (playingRef.current) {
            current.stop();
            return;
        }
        startingRef.current = true;
        setIsStarting(true);
        setError(null);
        const generation = generationRef.current;
        try {
            await current.init();
            if (generation !== generationRef.current) return;
            const settings = getSettings();
            current.setTransport({ bpm: settings.bpm, swing: settings.swing });
            current.setMasterVolume(settings.masterVolume);
            current.setTickDuration(settings.tickMs);
            await current.start();
        } catch (cause) {
            if (generation === generationRef.current) {
                current.stop();
                setError(cause instanceof Error ? cause.message : 'Could not start audio. Try again.');
            }
        } finally {
            if (generation === generationRef.current) {
                startingRef.current = false;
                setIsStarting(false);
            }
        }
    }, []);

    return { agent, isPlaying, isStarting, error, toggle, replaceAgent };
}
