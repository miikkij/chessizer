import { useEffect, useRef } from 'react';
import type { GameTimeline } from '../chess/game';

interface MoveHistoryProps {
    game: GameTimeline;
    positionIndex: number;
    onSelect: (index: number) => void;
}

export default function MoveHistory({ game, positionIndex, onSelect }: MoveHistoryProps) {
    const currentRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const button = currentRef.current;
        const list = listRef.current;
        if (!button || !list) return;
        const top = button.offsetTop - list.offsetTop;
        if (top < list.scrollTop || top + button.offsetHeight > list.scrollTop + list.clientHeight) {
            list.scrollTop = Math.max(0, top - list.clientHeight / 2);
        }
    }, [positionIndex, game]);

    return <div ref={listRef} className="move-list" aria-label="Move history">
        {game.positions.map((frame, index) => {
            const before = index > 0 ? game.positions[index - 1].fen.split(' ') : null;
            const label = frame.move && before
                ? `${before[5]}${frame.move.color === 'w' ? '.' : '...'} ${frame.move.san}`
                : 'Start';
            return <button
                key={index}
                ref={index === positionIndex ? currentRef : undefined}
                type="button"
                className={`move-button ${index === positionIndex ? 'is-current' : ''}`}
                aria-current={index === positionIndex ? 'step' : undefined}
                aria-label={index === 0 ? 'Starting position' : `Go to ${label}`}
                onClick={() => onSelect(index)}
            >{label}</button>;
        })}
    </div>;
}
