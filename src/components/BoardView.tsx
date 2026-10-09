import { useLayoutEffect, useRef } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { PositionFrame } from '../chess/game';

interface BoardViewProps {
    frame: PositionFrame;
    inCheck: boolean;
    orientation?: 'white' | 'black';
}

export default function BoardView({ frame, inCheck, orientation = 'white' }: BoardViewProps) {
    const elementRef = useRef<HTMLDivElement>(null);
    const boardRef = useRef<Api | null>(null);

    useLayoutEffect(() => {
        const element = elementRef.current;
        if (!element) return;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const board = Chessground(element, {
            viewOnly: true,
            coordinates: true,
            drawable: { enabled: false, visible: false },
            animation: { enabled: !reducedMotion, duration: 180 },
        });
        boardRef.current = board;
        return () => {
            board.destroy();
            boardRef.current = null;
            element.replaceChildren();
        };
    }, []);

    useLayoutEffect(() => {
        const turnColor = frame.fen.split(' ')[1] === 'w' ? 'white' : 'black';
        boardRef.current?.set({
            fen: frame.fen,
            orientation,
            turnColor,
            check: inCheck ? turnColor : false,
            lastMove: frame.move ? [frame.move.from, frame.move.to] : undefined,
        });
    }, [frame, inCheck, orientation]);

    return <div className="board-frame" role="img" aria-label={`Chess position, ${frame.fen.split(' ')[1] === 'w' ? 'White' : 'Black'} to move${inCheck ? ', in check' : ''}`} data-fen={frame.fen}>
        <div ref={elementRef} className="cg-wrap chessizer-board" />
    </div>;
}
