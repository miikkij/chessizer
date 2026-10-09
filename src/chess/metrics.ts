import { Chess, type PieceSymbol, type Square } from "chess.js"

const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const CENTER_SQUARES: Square[] = ["d4", "e4", "d5", "e5"]

export interface PositionMetrics {
  whiteMaterial: number
  blackMaterial: number
  materialBalance: number
  whiteCenterControl: number
  blackCenterControl: number
  /** Distinct center squares attacked by at least one side, from zero to four. */
  centerControl: number
  /** Legal captures available to the side to move. */
  legalCaptures: number
  inCheck: boolean
  isCheckmate: boolean
  /** A normalized activity indicator, not an engine evaluation of advantage. */
  intensity: number
}

export function calculatePositionMetrics(position: string | Chess): PositionMetrics {
  const chess = typeof position === "string" ? new Chess(position) : position
  let whiteMaterial = 0
  let blackMaterial = 0
  for (const piece of chess.board().flat()) {
    if (!piece) continue
    if (piece.color === "w") whiteMaterial += PIECE_VALUES[piece.type]
    else blackMaterial += PIECE_VALUES[piece.type]
  }

  let whiteCenterControl = 0
  let blackCenterControl = 0
  let centerControl = 0
  for (const square of CENTER_SQUARES) {
    const white = chess.isAttacked(square, "w")
    const black = chess.isAttacked(square, "b")
    if (white) whiteCenterControl++
    if (black) blackCenterControl++
    if (white || black) centerControl++
  }

  const legalCaptures = chess.moves({ verbose: true }).filter((move) => move.captured).length
  const inCheck = chess.isCheck()
  const intensity = 0.4 * Math.min(1, legalCaptures / 20)
    + 0.4 * centerControl / CENTER_SQUARES.length
    + 0.2 * Number(inCheck)

  return {
    whiteMaterial,
    blackMaterial,
    materialBalance: whiteMaterial - blackMaterial,
    whiteCenterControl,
    blackCenterControl,
    centerControl,
    legalCaptures,
    inCheck,
    isCheckmate: chess.isCheckmate(),
    intensity,
  }
}
