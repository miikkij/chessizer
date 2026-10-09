import { Chess, type PieceSymbol, type Square } from 'chess.js';

export type MoveEvent = {
    from: Square;
    to: Square;
    color: 'w' | 'b';
    piece: PieceSymbol;
    captured?: PieceSymbol;
    promotion?: PieceSymbol;
    san: string;
};

export type PositionTransition = {
    kind: 'load' | 'forward' | 'backward' | 'seek';
    move: MoveEvent | null;
};

export type PositionFrame = {
    fen: string;
    move: MoveEvent | null;
};

export type GameTimeline = {
    pgn: string;
    title: string;
    headers: Record<string, string>;
    positions: PositionFrame[];
};

export type GameState = {
    game: GameTimeline;
    positionIndex: number;
    transition: PositionTransition;
};

/** Parse the complete main line before publishing any position to the app. */
export function parseGame(pgn: string): GameTimeline {
    const chess = new Chess();
    chess.loadPgn(pgn.replace(/^\uFEFF/, ''));
    const history = chess.history({ verbose: true });
    const headers = chess.getHeaders();
    const players = [headers.White, headers.Black].filter(name => name && name !== '?');
    const event = headers.Event && headers.Event !== '?' ? headers.Event : undefined;

    // Verbose moves retain the actual initial FEN, including setup positions,
    // castling rights, en passant and counters. Never reset to the default board.
    const positions: PositionFrame[] = [{
        fen: history[0]?.before ?? chess.fen(),
        move: null,
    }];
    for (const move of history) {
        const { from, to, color, piece, captured, promotion, san } = move;
        positions.push({
            fen: move.after,
            move: { from, to, color, piece, captured, promotion, san },
        });
    }

    return {
        pgn: chess.pgn(),
        title: event ?? (players.length ? players.join(' vs ') : history.length ? 'Imported game' : 'Starting position'),
        headers,
        positions,
    };
}

export function createGameState(game: GameTimeline): GameState {
    if (!game.positions.length) throw new Error('A game must contain its starting position.');
    return { game, positionIndex: 0, transition: { kind: 'load', move: null } };
}

/** Only advancing one ply represents a new move being played. */
export function navigateGameState(state: GameState, requestedIndex: number): GameState {
    if (!Number.isFinite(requestedIndex)) return state;
    const positionIndex = Math.max(0, Math.min(state.game.positions.length - 1, Math.floor(requestedIndex)));
    if (positionIndex === state.positionIndex) return state;

    const distance = positionIndex - state.positionIndex;
    const kind = distance === 1 ? 'forward' : distance === -1 ? 'backward' : 'seek';
    return {
        ...state,
        positionIndex,
        transition: {
            kind,
            move: kind === 'forward' ? state.game.positions[positionIndex].move : null,
        },
    };
}
