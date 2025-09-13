export type Side = 'white' | 'black';
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export interface Piece {
  type: PieceType;
  side: Side;
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
  for (let i = 0; i < 64; i++) {
    const cell = boardString.slice(i * 4, i * 4 + 4);
    const pieceByte = parseInt(cell.slice(0, 2), 16);
    if (pieceByte === 0) continue;
    const side: Side = (pieceByte & 0xf0) === 0x10 ? 'white' : 'black';
    const type = typeMap[pieceByte & 0x0f];
    if (type) {
      pieces.push({ type, side });
    }
  }
  return pieces;
}
