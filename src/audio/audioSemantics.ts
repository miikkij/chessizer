import type { PositionTransition } from "../chess/game"

export function captureSideForTransition(transition?: PositionTransition): "white" | "black" | null {
  if (transition?.kind !== "forward" || !transition.move?.captured) return null
  return transition.move.color === "w" ? "white" : "black"
}

/** Equal material is centered, with equally sized responses for either side's advantage. */
export function materialBrightness(
  balance: number,
  mapping: { slopeCentroidHzPerPoint: number; minHz: number; maxHz: number },
): number {
  const midpoint = (mapping.minHz + mapping.maxHz) / 2
  return Math.max(mapping.minHz, Math.min(mapping.maxHz, midpoint + mapping.slopeCentroidHzPerPoint * balance))
}
