import assert from "node:assert/strict"
import test from "node:test"
import { Chess } from "chess.js"
import { captureSideForTransition, materialBrightness } from "../src/audio/audioSemantics.ts"
import { calculatePositionMetrics } from "../src/chess/metrics.ts"
import type { PositionTransition } from "../src/chess/game.ts"

test("starting position has equal material and no attacks on the four center squares", () => {
  const metrics = calculatePositionMetrics(new Chess())
  assert.equal(metrics.whiteMaterial, 39)
  assert.equal(metrics.blackMaterial, 39)
  assert.equal(metrics.materialBalance, 0)
  assert.equal(metrics.whiteCenterControl, 0)
  assert.equal(metrics.blackCenterControl, 0)
  assert.equal(metrics.centerControl, 0)
  assert.equal(metrics.legalCaptures, 0)
  assert.equal(metrics.intensity, 0)
})

test("center control counts pawn attacks for both sides, not moves or occupancy", () => {
  const placement = "4k3/8/4p3/8/4P3/8/8/4K3"
  for (const turn of ["w", "b"]) {
    const metrics = calculatePositionMetrics(`${placement} ${turn} - - 0 1`)
    assert.equal(metrics.whiteCenterControl, 1)
    assert.equal(metrics.blackCenterControl, 1)
    assert.equal(metrics.centerControl, 1, "both sides attack d5; count the square only once")
    assert.equal(metrics.intensity, 0.1)
  }
})

test("position metrics preserve the side to move and report checkmate", () => {
  const chess = new Chess()
  for (const san of ["f3", "e5", "g4", "Qh4#"]) chess.move(san)
  const before = chess.fen()
  const metrics = calculatePositionMetrics(chess)
  assert.equal(chess.fen(), before)
  assert.equal(metrics.inCheck, true)
  assert.equal(metrics.isCheckmate, true)
  assert.equal(metrics.legalCaptures, 0)
  assert.ok(metrics.intensity >= 0.2 && metrics.intensity <= 1)
})

test("material balance and brightness distinguish equally sized advantages for both sides", () => {
  const mapping = { minHz: 400, maxHz: 2000, slopeCentroidHzPerPoint: 80 }
  const white = calculatePositionMetrics("4k3/8/8/8/8/8/8/Q3K3 w - - 0 1")
  const black = calculatePositionMetrics("q3k3/8/8/8/8/8/8/4K3 b - - 0 1")
  assert.equal(white.materialBalance, 9)
  assert.equal(black.materialBalance, -9)
  const neutral = materialBrightness(0, mapping)
  assert.equal(neutral, 1200)
  for (const advantage of [1, 3, 9]) {
    const positive = materialBrightness(advantage, mapping)
    const negative = materialBrightness(-advantage, mapping)
    assert.ok(positive > neutral)
    assert.ok(negative < neutral)
    assert.equal(positive - neutral, neutral - negative)
  }
  assert.equal(materialBrightness(100, mapping), mapping.maxHz)
  assert.equal(materialBrightness(-100, mapping), mapping.minHz)
})

test("only forward capture moves produce a capture cue, including en passant", () => {
  const chess = new Chess()
  for (const san of ["e4", "h6", "e5", "d5"]) chess.move(san)
  const capture = chess.move("exd6")
  assert.equal(capture.captured, "p")
  assert.equal(captureSideForTransition({ kind: "forward", move: capture }), "white")
  for (const kind of ["load", "backward", "seek"] as const) {
    assert.equal(captureSideForTransition({ kind, move: capture }), null)
  }
  assert.equal(captureSideForTransition(undefined), null)
  assert.equal(captureSideForTransition({ kind: "forward", move: null }), null)
})

test("capture cue follows the actual moving side and ignores a quiet move", () => {
  const chess = new Chess()
  const quiet = chess.move("e4")
  assert.equal(captureSideForTransition({ kind: "forward", move: quiet }), null)
  chess.move("d5")
  chess.move("exd5")
  const capture = chess.move("Qxd5")
  const transition: PositionTransition = { kind: "forward", move: capture }
  assert.equal(captureSideForTransition(transition), "black")
})

test("legal captures include en passant while material remains unchanged until the move", () => {
  const chess = new Chess()
  for (const san of ["e4", "h6", "e5", "d5"]) chess.move(san)
  const before = calculatePositionMetrics(chess)
  assert.equal(before.legalCaptures, 1)
  assert.equal(before.materialBalance, 0)
  chess.move("exd6")
  assert.equal(calculatePositionMetrics(chess).materialBalance, 1)
})
