/**
 * Custom hook for chess game state (presets, PGN, FEN, navigation).
 * Extracted from App.tsx to keep the main component lean.
 */
import { useState, useEffect, useCallback } from "react";
import { getPresetPGN } from "../data/gamePresets";

export function useGameState() {
    const [gamePreset, setGamePreset] = useState('immortal_game');
    const [pgnData, setPgnData] = useState('');
    const [currentFen, setCurrentFen] = useState('');
    const [moveIndex, setMoveIndex] = useState(0);
    const [externalMoveIndex, setExternalMoveIndex] = useState<number | undefined>(undefined);
    const [moveCount, setMoveCount] = useState(1);

    const handleGamePresetChange = useCallback((presetId: string) => {
        setGamePreset(presetId);
        setPgnData(getPresetPGN(presetId));
    }, []);

    const handlePositionChange = useCallback((fen: string, moveNumber: number) => {
        if (import.meta.env.DEV) console.log('App: Position changed:', fen, 'move:', moveNumber);
        setCurrentFen((prev) => {
            if (prev !== fen) {
                if (import.meta.env.DEV) console.log('App: FEN changed from', prev, 'to', fen);
                return fen;
            }
            return prev;
        });
        // moveIndex is updated via a ref callback from the caller (to avoid stale closure)
        setMoveIndex((prev) => {
            if (prev !== moveNumber) {
                if (import.meta.env.DEV) console.log('App: Move index changed from', prev, 'to', moveNumber);
                return moveNumber;
            }
            return prev;
        });
    }, []);

    const goToPrev = useCallback(() => {
        const newIndex = Math.max(0, moveIndex - 1);
        setExternalMoveIndex(newIndex);
        setMoveIndex(newIndex);
    }, [moveIndex]);

    const goToNext = useCallback(() => {
        const newIndex = Math.min(moveCount - 1, moveIndex + 1);
        setExternalMoveIndex(newIndex);
        setMoveIndex(newIndex);
    }, [moveIndex, moveCount]);

    const goToFirst = useCallback(() => {
        setExternalMoveIndex(0);
        setMoveIndex(0);
    }, []);

    const goToLast = useCallback(() => {
        const lastIdx = Math.max(0, moveCount - 1);
        setExternalMoveIndex(lastIdx);
        setMoveIndex(lastIdx);
    }, [moveCount]);

    // BUG-004 FIX: Acknowledgement callback
    const handleExternalIndexProcessed = useCallback(() => {
        setExternalMoveIndex(undefined);
    }, []);

    // Initialize with current game preset
    useEffect(() => {
        setPgnData(getPresetPGN(gamePreset));
    }, [gamePreset]);

    return {
        gamePreset, pgnData, currentFen, moveIndex, externalMoveIndex, moveCount,
        setCurrentFen, setMoveCount,
        handleGamePresetChange, handlePositionChange,
        goToPrev, goToNext, goToFirst, goToLast,
        handleExternalIndexProcessed,
    };
}
