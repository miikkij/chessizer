/**
 * Custom hook for audio transport settings with localStorage persistence.
 * Extracted from App.tsx to keep the main component lean.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { SoundAgent } from "../audio/SoundAgent";
import { toast } from "react-hot-toast";

function readNumber(key: string, fallback: number, min?: number, max?: number): number {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        const n = Number(raw);
        if (!Number.isFinite(n)) return fallback;
        if (typeof min === 'number' && n < min) return min;
        if (typeof max === 'number' && n > max) return max;
        return n;
    } catch {
        return fallback;
    }
}

export function useAudioSettings(agent: SoundAgent | null) {
    const [bpm, setBpm] = useState(() => readNumber('settings.bpm', 120, 40, 300));
    const [swing, setSwing] = useState(() => readNumber('settings.swing', 0, 0, 1));
    const [tickMs, setTickMs] = useState(() => readNumber('settings.tickMs', 1000, 250, 5000));
    const [masterVolume, setMasterVolume] = useState(() => readNumber('settings.volume', 0.7, 0, 1));
    const persistRef = useRef(true);

    const handleBpmChange = useCallback((value: number[]) => {
        const v = value[0];
        setBpm(v);
        agent?.setTransport({ bpm: v });
    }, [agent]);

    const handleSwingChange = useCallback((value: number[]) => {
        const v = value[0] / 100; // slider 0..100 -> 0..1
        setSwing(v);
        agent?.setTransport({ swing: v });
    }, [agent]);

    const handleTickChange = useCallback((value: number[]) => {
        const v = value[0];
        setTickMs(v);
        agent?.setTickDuration(v);
    }, [agent]);

    const handleVolumeChange = useCallback((value: number[]) => {
        const newVolume = value[0];
        setMasterVolume(newVolume);
        agent?.setMasterVolume(newVolume);
    }, [agent]);

    const resetSettings = useCallback(() => {
        try {
            persistRef.current = false;
            localStorage.removeItem('settings.bpm');
            localStorage.removeItem('settings.swing');
            localStorage.removeItem('settings.volume');
            localStorage.removeItem('settings.tickMs');
        } catch { /* ignore */ }
        setBpm(120);
        setSwing(0);
        setMasterVolume(0.7);
        setTickMs(1000);
        agent?.setTransport({ bpm: 120, swing: 0 });
        agent?.setMasterVolume(0.7);
        agent?.setTickDuration(1000);
        toast.success('Audio settings cleared and reset to defaults');
        setTimeout(() => { persistRef.current = true }, 0);
    }, [agent]);

    // Persist settings to localStorage
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

    return {
        bpm, swing, tickMs, masterVolume,
        handleBpmChange, handleSwingChange, handleTickChange, handleVolumeChange,
        resetSettings,
    };
}
