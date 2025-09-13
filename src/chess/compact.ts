import { Chess } from 'chess.js';
import type { Square, Color } from 'chess.js';

export type Side = 'white' | 'black';
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export interface Piece {
  type: PieceType;
  side: Side;
}

// Piece encoding values as per AGENTS.md spec
const PIECE_CODES = {
  // Empty square
  empty: 0x00,

  // White pieces (0x10 + piece index)
  white: {
    pawn: 0x11,
    knight: 0x12,
    bishop: 0x13,
    rook: 0x14,
    queen: 0x15,
    king: 0x16,
  },

  // Black pieces (0x20 + piece index)
  black: {
    pawn: 0x21,
    knight: 0x22,
    bishop: 0x23,
    rook: 0x24,
    queen: 0x25,
    king: 0x26,
  }
};

// Flag bits as per AGENTS.md spec
const FLAGS = {
  CAPTURED: 1 << 0,     // Piece captured in last move
  MOVED: 1 << 1,        // Piece moved in last move
  GIVES_CHECK: 1 << 2,  // Piece gives check
  HAS_MOVED: 1 << 3,    // Piece has moved earlier
};

export interface CompactBoardState {
  boardString: string;
  sideToMove: Color;
  castling: string;
  enPassant: string | null;
  halfmove: number;
  fullmove: number;
}

export interface MoveInfo {
  from: Square;
  to: Square;
  captured?: boolean;
}

const typeMap: Record<number, PieceType> = {
  0x1: 'pawn',
  0x2: 'knight',
  0x3: 'bishop',
  0x4: 'rook',
  0x5: 'queen',
  0x6: 'king',
};

export function decodeBoardString(boardString: string): Piece[] {
  const pieces: Piece[] = [];

  // Validate input
  if (!boardString || typeof boardString !== 'string') {
    console.warn('Invalid board string provided to decodeBoardString');
    return pieces;
  }

  try {
    for (let i = 0; i < 64; i++) {
      const startIndex = i * 4;
      if (startIndex + 4 > boardString.length) break; // Prevent out of bounds

      const cell = boardString.slice(startIndex, startIndex + 4);
      const pieceByte = parseInt(cell.slice(0, 2), 16);

      if (isNaN(pieceByte) || pieceByte === 0) continue;

      const side: Side = (pieceByte & 0xf0) === 0x10 ? 'white' : 'black';
      const type = typeMap[pieceByte & 0x0f];

      if (type && side) {
        pieces.push({ type, side });
      }
    }
  } catch (error) {
    console.error('Error in decodeBoardString:', error);
  }

  return pieces;
}

/**
 * Converts a Chess.js position to compact 256-hex string format
 */
export function encodePosition(
  chess: Chess,
  lastMove?: MoveInfo,
  movingPiecesSquares?: Square[]
): string {
  const board = chess.board();
  const result: number[] = [];

  // Get squares that give check
  const checkingSquares = getCheckingSquares(chess);

  // Traverse a8 to h8, then a7 to h7, etc. down to a1 to h1
  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = board[rank][file];
      const squareName = (String.fromCharCode(97 + file) + (rank + 1)) as Square;

      let pieceCode = PIECE_CODES.empty;
      let flags = 0;

      if (square) {
        // Get piece code
        const color = square.color === 'w' ? 'white' : 'black';
        pieceCode = PIECE_CODES[color][square.type as keyof typeof PIECE_CODES.white];

        // Set flags
        if (lastMove?.captured && squareName === lastMove.to) {
          flags |= FLAGS.CAPTURED;
        }

        if (lastMove && (squareName === lastMove.from || squareName === lastMove.to)) {
          flags |= FLAGS.MOVED;
        }

        if (checkingSquares.includes(squareName)) {
          flags |= FLAGS.GIVES_CHECK;
        }

        // Has moved flag - simplified check (could be enhanced)
        if (movingPiecesSquares?.includes(squareName)) {
          flags |= FLAGS.HAS_MOVED;
        }
      }

      // Add piece code and flags as two bytes (4 hex chars)
      result.push(pieceCode);
      result.push(flags);
    }
  }

  // Convert to hex string
  return result.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse PGN and generate timeline of compact strings
 */
export function generateTimeline(pgn: string): CompactBoardState[] {
  const chess = new Chess();
  const timeline: CompactBoardState[] = [];

  try {
    chess.loadPgn(pgn);
    const history = chess.history({ verbose: true });

    // Reset to start
    chess.reset();

    // Add starting position
    timeline.push({
      boardString: encodePosition(chess),
      sideToMove: chess.turn(),
      castling: getCastlingString(chess),
      enPassant: null,
      halfmove: 0,
      fullmove: 1
    });

    // Play through each move
    for (const move of history) {
      chess.move(move);

      const lastMove = {
        from: move.from,
        to: move.to,
        captured: !!move.captured
      };

      timeline.push({
        boardString: encodePosition(chess, lastMove),
        sideToMove: chess.turn(),
        castling: getCastlingString(chess),
        enPassant: chess.getComment(),
        halfmove: 0,
        fullmove: Math.floor(timeline.length / 2) + 1
      });
    }
  } catch (error) {
    console.error('Failed to parse PGN:', error);
  }

  return timeline;
}

function getCheckingSquares(chess: Chess): Square[] {
  // Simple implementation - could be enhanced
  const squares: Square[] = [];
  const isInCheck = chess.inCheck();

  if (!isInCheck) return squares;

  // Get all pieces and check which ones attack the king
  const kingSquare = findKing(chess, chess.turn());
  if (!kingSquare) return squares;

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = (String.fromCharCode(97 + file) + (rank + 1)) as Square;
      try {
        const moves = chess.moves({ square, verbose: true });
        if (moves.some(move => move.to === kingSquare)) {
          squares.push(square);
        }
      } catch {
        // Ignore invalid squares
      }
    }
  }

  return squares;
}

function findKing(chess: Chess, color: Color): Square | null {
  const board = chess.board();

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece && piece.type === 'k' && piece.color === color) {
        return (String.fromCharCode(97 + file) + (rank + 1)) as Square;
      }
    }
  }

  return null;
}

function getCastlingString(chess: Chess): string {
  // Simple implementation - return FEN castling part
  const fen = chess.fen();
  return fen.split(' ')[2];
}

/**
 * Create starting position compact string
 */
export function getStartPosition(): string {
  const chess = new Chess();
  return encodePosition(chess);
}
