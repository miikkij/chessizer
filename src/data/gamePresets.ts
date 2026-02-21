/**
 * Famous chess game presets for Chessizer.
 * Extracted from App.tsx to keep the main component lean.
 */

export interface GamePreset {
    name: string;
    description: string;
    pgn: string;
}

export const GAME_PRESETS: Record<string, GamePreset> = {
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
};

/** Get a preset by ID, falling back to the immortal game */
export function getPresetPGN(presetId: string): string {
    return GAME_PRESETS[presetId]?.pgn || GAME_PRESETS.immortal_game.pgn;
}

/** List of preset IDs for use in dropdowns */
export const PRESET_IDS = Object.keys(GAME_PRESETS) as (keyof typeof GAME_PRESETS)[];
