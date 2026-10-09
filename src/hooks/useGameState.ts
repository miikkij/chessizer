import { useCallback, useState } from 'react';
import { getPresetPGN } from '../data/gamePresets';
import { createGameState, navigateGameState, parseGame, type GameTimeline } from '../chess/game';

/** The board, navigation and audio all consume this one position state. */
export function useGameState(initialGame?: GameTimeline) {
    const [state, setState] = useState(() => createGameState(
        initialGame ?? parseGame(getPresetPGN('immortal_game')),
    ));

    const loadGame = useCallback((game: GameTimeline) => {
        setState(createGameState(game));
    }, []);
    const goTo = useCallback((index: number) => {
        setState(current => navigateGameState(current, index));
    }, []);
    const prev = useCallback(() => {
        setState(current => navigateGameState(current, current.positionIndex - 1));
    }, []);
    const next = useCallback(() => {
        setState(current => navigateGameState(current, current.positionIndex + 1));
    }, []);
    const first = useCallback(() => {
        setState(current => navigateGameState(current, 0));
    }, []);
    const last = useCallback(() => {
        setState(current => navigateGameState(current, current.game.positions.length - 1));
    }, []);

    return {
        ...state,
        frame: state.game.positions[state.positionIndex],
        loadGame, goTo, prev, next, first, last,
    };
}
