import { useId, useRef, useState } from 'react';
import { Button } from './ui/button';
import { parseGame, type GameTimeline } from '../chess/game';

interface PGNLoaderProps {
    onGameLoaded: (game: GameTimeline) => void;
}

export function PGNLoader({ onGameLoaded }: PGNLoaderProps) {
    const [pgnText, setPgnText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadedMessage, setLoadedMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputId = useId();
    const helpId = useId();
    const errorId = useId();

    const loadText = (text: string) => {
        setError('');
        setLoadedMessage('');
        try {
            const game = parseGame(text);
            // Parsing must finish successfully before the current game changes.
            onGameLoaded(game);
            setLoadedMessage(`Loaded ${game.title}: ${game.positions.length - 1} half-moves.`);
        } catch (cause) {
            const detail = cause instanceof Error ? cause.message : 'The notation could not be read.';
            setError(`Could not load this game. ${detail} Your current game is still open.`);
        }
    };

    const handlePaste = async () => {
        setIsLoading(true);
        setError('');
        setLoadedMessage('');
        try {
            const text = await navigator.clipboard.readText();
            setPgnText(text);
            loadText(text);
        } catch {
            setError('Clipboard access is unavailable. Paste your PGN into the text field, then choose Load game.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFile = async (file: File) => {
        setIsLoading(true);
        setError('');
        setLoadedMessage('');
        try {
            const text = await file.text();
            setPgnText(text);
            loadText(text);
        } catch {
            setError(`Could not read ${file.name}. Choose a readable PGN or text file.`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pgn-loader space-y-3">
            <label htmlFor={inputId} className="block text-sm font-semibold">Import a game</label>
            <textarea
                id={inputId}
                value={pgnText}
                onChange={(event) => {
                    setPgnText(event.target.value);
                    setError('');
                    setLoadedMessage('');
                }}
                placeholder="Paste PGN here, for example: 1.e4 e5 2.Nf3 Nc6"
                aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
                aria-invalid={!!error}
                disabled={isLoading}
                className="min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-200"
            />
            <p id={helpId} className="text-xs text-slate-500">
                Loads the main line, including comments and custom starting positions. Files stay in your browser.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button onClick={() => loadText(pgnText)} disabled={!pgnText.trim() || isLoading} size="sm">
                    Load game
                </Button>
                <Button onClick={handlePaste} disabled={isLoading} variant="outline" size="sm">
                    Paste PGN
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} variant="outline" size="sm">
                    {isLoading ? 'Reading…' : 'Open PGN file'}
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pgn,.txt,application/x-chess-pgn,text/plain"
                    aria-label="Open PGN file"
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) void handleFile(file);
                    }}
                />
            </div>
            {error && <p id={errorId} role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {loadedMessage && <p role="status" className="text-sm text-emerald-700">{loadedMessage}</p>}
        </div>
    );
}

export default PGNLoader;
