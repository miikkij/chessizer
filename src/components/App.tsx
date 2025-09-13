import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import anime from 'animejs';
import { Chess } from 'chess.js';
import presets from '../../configs/sound-presets.json';
import { AudioAgent, type HarmonicPreset } from '../audio/engine';
import type { Piece } from '../chess/compact';

interface BoardPiece extends Piece {
  index: number;
}

const CELL = 60;

function buildTimeline(): BoardPiece[][] {
  const chess = new Chess();
  const positions: BoardPiece[][] = [];
  const moves = ['e4', 'e5', 'Nf3', 'Nc6'];
  const toPieces = () => {
    const board = chess.board();
    const pieces: BoardPiece[] = [];
    const typeMap: Record<string, Piece['type']> = {
      p: 'pawn',
      n: 'knight',
      b: 'bishop',
      r: 'rook',
      q: 'queen',
      k: 'king',
    };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c];
        if (sq) {
          pieces.push({
            type: typeMap[sq.type],
            side: sq.color === 'w' ? 'white' : 'black',
            index: r * 8 + c,
          });
        }
      }
    }
    return pieces;
  };
  positions.push(toPieces());
  for (const m of moves) {
    chess.move(m);
    positions.push(toPieces());
  }
  return positions;
}

function animateMove(prev: BoardPiece[], next: BoardPiece[]) {
  const moved = next.find(
    (p) =>
      !prev.some(
        (q) => q.type === p.type && q.side === p.side && q.index === p.index,
      ),
  );
  if (!moved) return;
  const origin = prev.find(
    (p) => p.type === moved.type && p.side === moved.side,
  );
  if (!origin) return;
  const fromRow = Math.floor(origin.index / 8);
  const fromCol = origin.index % 8;
  const toRow = Math.floor(moved.index / 8);
  const toCol = moved.index % 8;
  anime({
    targets: `#piece-${moved.side}-${moved.type}-${moved.index}`,
    translateX: [(fromCol - toCol) * CELL, 0],
    translateY: [(fromRow - toRow) * CELL, 0],
    duration: 500,
    easing: 'easeInOutQuad',
  });
}

const harmonic = (presets.presets as HarmonicPreset[]).find(
  (p) => p.id === 'harmonic_layers',
)!;
const agent = new AudioAgent(harmonic);

const symbols: Record<string, Record<string, string>> = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙',
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟︎',
  },
};

export default function App() {
  const timeline = useMemo(() => buildTimeline(), []);
  const [index, setIndex] = useState(0);
  const [pieces, setPieces] = useState<BoardPiece[]>(timeline[0]);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPieces(timeline[index]);
    agent.playBoard(timeline[index]);
    if (index > 0) {
      animateMove(timeline[index - 1], timeline[index]);
    }
  }, [index, timeline]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setIndex((i) => Math.min(timeline.length - 1, i + 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [timeline.length]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setIndex((i) => {
        if (i < timeline.length - 1) return i + 1;
        setPlaying(false);
        return i;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, timeline.length]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Chessboard Sound</h1>
      <div
        className="relative border"
        style={{ width: CELL * 8, height: CELL * 8 }}
      >
        {pieces.map((p) => {
          const row = Math.floor(p.index / 8);
          const col = p.index % 8;
          return (
            <div
              key={`piece-${p.side}-${p.type}-${p.index}`}
              id={`piece-${p.side}-${p.type}-${p.index}`}
              className="absolute select-none"
              style={{
                top: row * CELL,
                left: col * CELL,
                width: CELL,
                height: CELL,
                fontSize: CELL - 10,
                lineHeight: `${CELL}px`,
                textAlign: 'center',
              }}
            >
              {symbols[p.side][p.type]}
            </div>
          );
        })}
      </div>
      <div className="space-x-2">
        <Button onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          Prev
        </Button>
        <Button onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          onClick={() => setIndex((i) => Math.min(timeline.length - 1, i + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
