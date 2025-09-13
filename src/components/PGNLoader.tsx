import { useState } from 'react';
import { Button } from './ui/button';
import { Chess } from 'chess.js';

interface PGNLoaderProps {
    onGameLoaded: (fens: string[]) => void;
}

export function PGNLoader({ onGameLoaded }: PGNLoaderProps) {
    const [pgnText, setPgnText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Sample famous games
    const sampleGames = {
        "Immortal Game (1851)": `1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g3 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7# 1-0`,

        "Evergreen Game (1852)": `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O d3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4 Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6 Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8 23.Bd7+ Kf8 24.Bxe7# 1-0`,

        "Game of the Century (1956)": `1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6 8.e4 Nbd7 9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5 Na4 12.Qa3 Nxc3 13.bxc3 Nxe4 14.Bxe7 Qb6 15.Bc4 Nxc3 16.Bc5 Rfe8+ 17.Kf1 Be6 18.Bxb6 Bxc4+ 19.Kg1 Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+ 22.Kf1 Nc3+ 23.Kg1 axb6 24.Qb4 Ra4 25.Qxb6 Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1 29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3 Ne4 32.Qb8 b5 33.h4 h6 34.Ne5 Kg7 35.Kg1 Bc5+ 36.Kf1 Ng3+ 37.Ke1 Bb4+ 38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2# 0-1`,

        "Fischer vs Spassky (1992)": `1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8 10.d4 Nbd7 11.c4 c6 12.cxb5 axb5 13.Nc3 Bb7 14.Bg5 b4 15.Nb1 h6 16.Bh4 c5 17.dxe5 Nxe4 18.Bxe7 Qxe7 19.exd6 Qf6 20.Nbd2 Nxd6 21.Nc4 Nxc4 22.Bxc4 Nb6 23.Ne5 Rae8 24.Bxf7+ Rxf7 25.Nxf7 Rxe1+ 26.Qxe1 Kxf7 27.Qe3 Qg5 28.Qxg5 hxg5 29.b3 Ke6 30.a3 Kd6 31.axb4 cxb4 32.Ra5 Nd5 33.f3 Bc8 34.Kf2 Bf5 35.Ra7 g6 36.Ra6+ Kc5 37.Ke1 Nf4 38.g3 Nxh3 39.Kd2 Kb5 40.Rd6 Kc5 41.Ra6 Nf2 42.g4 Bd3 43.Re6 1/2-1/2`,

        "Simple Opening": `1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7`
    };

    const handleLoadSample = (gameKey: string) => {
        const pgn = sampleGames[gameKey as keyof typeof sampleGames];
        setPgnText(pgn);
        parsePGN(pgn);
    };

    const parsePGN = (pgn: string) => {
        setIsLoading(true);
        try {
            const chess = new Chess();
            const fens = [chess.fen()]; // Start with initial position

            // Load the PGN
            chess.loadPgn(pgn);

            // Get the move history and replay to generate FEN for each position
            const moves = chess.history();
            chess.reset(); // Reset to replay moves

            // Add initial position
            moves.forEach(move => {
                chess.move(move);
                fens.push(chess.fen());
            });

            console.log(`Loaded game with ${moves.length} moves:`, moves);
            console.log(`Generated ${fens.length} positions`);

            onGameLoaded(fens);
        } catch (error) {
            console.error('Error parsing PGN:', error);
            alert('Error parsing PGN. Please check the format.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setPgnText(text);
            parsePGN(text);
        } catch (err) {
            console.error('Failed to read clipboard:', err);
            alert('Could not read from clipboard. Please paste manually.');
        }
    };

    return (
        <div className="pgn-loader space-y-4 p-4 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold">🏛️ Load Chess Game</h3>

            {/* Sample Games */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Famous Games:</h4>
                <div className="grid grid-cols-2 gap-2">
                    {Object.keys(sampleGames).map(gameKey => (
                        <Button
                            key={gameKey}
                            onClick={() => handleLoadSample(gameKey)}
                            variant="outline"
                            className="text-xs justify-start"
                        >
                            {gameKey}
                        </Button>
                    ))}
                </div>
            </div>

            {/* PGN Input */}
            <div className="space-y-2">
                <div className="flex gap-2">
                    <Button onClick={handlePaste} variant="outline" size="sm">
                        📋 Paste PGN
                    </Button>
                    <Button
                        onClick={() => parsePGN(pgnText)}
                        disabled={!pgnText.trim() || isLoading}
                        size="sm"
                    >
                        {isLoading ? '⏳ Loading...' : '🎵 Load & Play'}
                    </Button>
                </div>

                <textarea
                    value={pgnText}
                    onChange={(e) => setPgnText(e.target.value)}
                    placeholder="Paste PGN notation here... (e.g., 1.e4 e5 2.Nf3 Nc6 ...)"
                    className="w-full h-24 p-2 border border-gray-300 rounded resize-none text-sm font-mono bg-gray-50"
                />
            </div>
        </div>
    );
}

export default PGNLoader;