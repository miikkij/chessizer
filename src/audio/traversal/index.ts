/**
 * Traversal strategies for the SoundAgent.
 * Each strategy defines how the 8x8 chess board is scanned to schedule audio events.
 * Extracted from SoundAgent.ts to keep the main agent lean.
 */

import { Chess } from "chess.js"

/** A single traversal tick: the batch of cells to process */
export type TraversalTick = { startTime: number; cells: string[]; done?: boolean }

/** Common interface for all traversal strategies */
export type Traversal = {
  nextTick(): TraversalTick
  reset(): void
}

// ── Row Sequential ──────────────────────────────────────────────────
export type RowParams = { fileOrder?: "aToH" | "hToA"; rowsOrder?: "8to1" | "1to8"; rowsPerTick?: number }

export function makeRowSequential(params?: RowParams): Traversal {
  const fileOrder = params?.fileOrder ?? "aToH"
  const rowsOrder = params?.rowsOrder ?? "8to1"
  const rowsPerTick = Math.max(1, Math.min(8, params?.rowsPerTick ?? 1))
  const files = fileOrder === "aToH" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"]
  const ranks = rowsOrder === "8to1" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  let i = 0
  return {
    nextTick() {
      if (i >= ranks.length) return { startTime: 0, cells: [], done: true }
      const batch = ranks.slice(i, i + rowsPerTick)
      i += rowsPerTick
      const cells: string[] = []
      for (const r of batch) {
        for (const f of files) cells.push(`${f}${r}`)
      }
      return { startTime: 0, cells, done: i >= ranks.length }
    },
    reset() { i = 0 },
  }
}

// ── Column Sequential ───────────────────────────────────────────────
export type ColParams = { fileOrder?: "aToH" | "hToA"; rowsOrder?: "8to1" | "1to8"; colsPerTick?: number }

export function makeColumnSequential(params?: ColParams): Traversal {
  const fileOrder = params?.fileOrder ?? "aToH"
  const rowsOrder = params?.rowsOrder ?? "8to1"
  const colsPerTick = Math.max(1, Math.min(8, params?.colsPerTick ?? 1))
  const files = fileOrder === "aToH" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"]
  const ranks = rowsOrder === "8to1" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  let i = 0
  return {
    nextTick() {
      if (i >= files.length) return { startTime: 0, cells: [], done: true }
      const batchFiles = files.slice(i, i + colsPerTick)
      i += colsPerTick
      const cells: string[] = []
      for (const f of batchFiles) {
        for (const r of ranks) cells.push(`${f}${r}`)
      }
      return { startTime: 0, cells, done: i >= files.length }
    },
    reset() { i = 0 },
  }
}

// ── Spiral From Center ──────────────────────────────────────────────
export type SpiralParams = { center?: string[]; spiral?: "cw" | "ccw"; cellsPerTick?: number }

function sqToCoord(sq: string): { f: number; r: number } | null {
  if (!/^[a-h][1-8]$/.test(sq)) return null
  const f = sq.charCodeAt(0) - 97
  const r = parseInt(sq[1]) - 1
  return { f, r }
}

export function makeSpiralFromCenter(params?: SpiralParams): Traversal {
  const seeds = (params?.center && Array.isArray(params.center) && params.center.length > 0) ? params.center : ["d4", "e4", "d5", "e5"]
  const coords = seeds.map(sqToCoord).filter((x): x is { f: number; r: number } => !!x)
  const cx = coords.length ? coords.reduce((a, c) => a + c.f, 0) / coords.length : 3.5
  const cy = coords.length ? coords.reduce((a, c) => a + c.r, 0) / coords.length : 3.5
  const dir = params?.spiral === "ccw" ? "ccw" : "cw"
  const step = Math.max(1, Math.min(64, params?.cellsPerTick ?? 16))

  type Cell = { f: number; r: number; layer: number; angle: number }
  const cells: Cell[] = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const dx = f - cx
      const dy = r - cy
      const layer = Math.max(Math.abs(dx), Math.abs(dy))
      const angle = Math.atan2(dy, dx) // CCW from +x
      cells.push({ f, r, layer, angle })
    }
  }
  cells.sort((a, b) => a.layer - b.layer || (dir === "ccw" ? a.angle - b.angle : b.angle - a.angle) || a.r - b.r || a.f - b.f)
  const ids = cells.map((c) => `${String.fromCharCode(97 + c.f)}${c.r + 1}`)
  let i = 0
  return {
    nextTick() {
      if (i >= ids.length) return { startTime: 0, cells: [], done: true }
      const batch = ids.slice(i, i + step)
      i += step
      return { startTime: 0, cells: batch, done: i >= ids.length }
    },
    reset() { i = 0 },
  }
}

// ── Rings From King ─────────────────────────────────────────────────
export type RingsParams = { side?: "turn" | "white" | "black"; cellsPerTick?: number }

export function makeRingsFromKing(chess: Chess, params?: RingsParams): Traversal {
  const side = params?.side ?? "turn"
  const turn: "white" | "black" = chess.turn() === "w" ? "white" : "black"
  const useSide: "white" | "black" = side === "turn" ? turn : (side as "white" | "black")
  // find king square for chosen side
  const pieces = chess.board()
  let kingSquare: { f: number; r: number } | null = null
  pieces.forEach((row, rIdx) => {
    row.forEach((sq, fIdx) => {
      if (sq && sq.type === "k" && (sq.color === (useSide === "white" ? "w" : "b"))) {
        kingSquare = { f: fIdx, r: 7 - rIdx } // 0-indexed from a1 -> f:0..7, r:0..7
      }
    })
  })
  // if not found, fall back to center
  const center = { f: 3, r: 3 }
  const origin = kingSquare ?? center
  // precompute all cells with their manhattan distance from origin
  const cells: { f: number; r: number; d: number }[] = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const d = Math.abs(f - origin.f) + Math.abs(r - origin.r)
      cells.push({ f, r, d })
    }
  }
  cells.sort((a, b) => a.d - b.d || a.r - b.r || a.f - b.f)
  const cellIds = cells.map((c) => `${String.fromCharCode(97 + c.f)}${c.r + 1}`)
  const step = Math.max(1, Math.min(64, params?.cellsPerTick ?? 16))
  let i = 0
  return {
    nextTick() {
      if (i >= cellIds.length) return { startTime: 0, cells: [], done: true }
      const batch = cellIds.slice(i, i + step)
      i += step
      return { startTime: 0, cells: batch, done: i >= cellIds.length }
    },
    reset() { i = 0 },
  }
}

// ── Random Seeded ───────────────────────────────────────────────────
export type RandomParams = { seed?: number | string; cellsPerTick?: number }

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function makeRandomSeeded(params?: RandomParams): Traversal {
  const step = Math.max(1, Math.min(64, params?.cellsPerTick ?? 16))
  const seed = typeof params?.seed === "number" ? params.seed : hashString(String(params?.seed ?? "seed"))
  const rnd = mulberry32(seed >>> 0)
  const ids: string[] = []
  for (let r = 1; r <= 8; r++) {
    for (let f = 0; f < 8; f++) ids.push(`${String.fromCharCode(97 + f)}${r}`)
  }
  // shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  let i = 0
  return {
    nextTick() {
      if (i >= ids.length) return { startTime: 0, cells: [], done: true }
      const batch = ids.slice(i, i + step)
      i += step
      return { startTime: 0, cells: batch, done: i >= ids.length }
    },
    reset() { i = 0 },
  }
}

// ── Custom List ─────────────────────────────────────────────────────
export type CustomListParams = { order: string[]; cellsPerTick?: number }

export function makeCustomList(params?: CustomListParams): Traversal {
  const order = (params?.order || []).filter((sq) => /^[a-h][1-8]$/.test(sq))
  const stepSource = params?.cellsPerTick ?? (order.length || 64)
  const step = Math.max(1, Math.min(64, stepSource))
  let i = 0
  return {
    nextTick() {
      if (i >= order.length) return { startTime: 0, cells: [], done: true }
      const batch = order.slice(i, i + step)
      i += step
      return { startTime: 0, cells: batch, done: i >= order.length }
    },
    reset() { i = 0 },
  }
}

// ── Factory ─────────────────────────────────────────────────────────
/** Build the appropriate traversal strategy from config */
export function buildTraversal(
  strategy: string,
  params: Record<string, unknown>,
  chess?: Chess,
): Traversal {
  switch (strategy) {
    case "rowSequential":
      return makeRowSequential(params as RowParams)
    case "columnSequential":
      return makeColumnSequential(params as ColParams)
    case "spiralFromCenter":
      return makeSpiralFromCenter(params as SpiralParams)
    case "randomSeeded":
      return makeRandomSeeded(params as RandomParams)
    case "customList":
      return makeCustomList(params as CustomListParams)
    case "ringsFromKing":
      return chess ? makeRingsFromKing(chess, params as RingsParams) : makeRowSequential(params as RowParams)
    default:
      return makeRowSequential(params as RowParams)
  }
}
