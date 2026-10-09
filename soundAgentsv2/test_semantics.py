"""Regression tests for move-aware WAV rendering; no HTTP server required."""

import io
import json
import unittest
import wave
from pathlib import Path

import chess
import numpy as np
from fastapi import HTTPException

from main import GenerateRequest, capture_side, generate_chess_wav


def position_after(*moves):
    board = chess.Board()
    for move in moves:
        board.push_san(move)
    return board


def quiet_config():
    # Silence the musical layers so the rendered event can be measured directly.
    return {
        "name": "event-regression",
        "audio": {"lengthMs": 1000},
        "groove": {"kit": {}, "tracks": []},
        "pulseGrid": {"earcons": {}},
        "events": {
            "capture": {
                "type": "click", "leadMs": 30, "durMs": 90,
                "panBySide": {"white": -1, "black": 1},
            },
            "check": {"type": "none"},
        },
        "ambient": {"gainDb": -120},
        "diagnostics": {"logSchedule": False},
    }


def render(current_fen, previous_fen=None, config=None):
    request = GenerateRequest(
        fen=current_fen,
        previousFen=previous_fen,
        config=config or quiet_config(),
    )
    wav_bytes = generate_chess_wav(request)
    with wave.open(io.BytesIO(wav_bytes)) as wav:
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").reshape(-1, 2)


class CaptureSemanticsTests(unittest.TestCase):
    def test_shipped_config_renders_and_preserves_register_json_contract(self):
        config = json.loads(Path(__file__).with_name("sample_config.json").read_text())
        config["audio"]["lengthMs"] = 1000
        request = GenerateRequest(fen=position_after("e4", "e5", "Nf3").fen(), config=config)
        self.assertEqual(request.config.pulseGrid.register_["white"], config["pulseGrid"]["register"]["white"])
        serialized = request.config.pulseGrid.model_dump(by_alias=True)
        self.assertIn("register", serialized)
        self.assertNotIn("register_", serialized)
        samples = render(request.fen, config=config)
        self.assertTrue(np.any(samples))

    def test_capture_opportunity_is_not_a_capture_event(self):
        board = position_after("e4", "d5")
        self.assertTrue(any(board.is_capture(move) for move in board.legal_moves))
        self.assertIsNone(capture_side(None, board.fen()))
        self.assertFalse(np.any(render(board.fen())))

    def test_quiet_forward_move_has_no_capture_event(self):
        previous = position_after("e4")
        current = previous.copy()
        current.push_san("d5")
        self.assertIsNone(capture_side(previous.fen(), current.fen()))
        self.assertFalse(np.any(render(current.fen(), previous.fen())))

    def test_white_capture_is_audible_on_white_side_in_short_clip(self):
        previous = position_after("e4", "d5")
        current = previous.copy()
        current.push_san("exd5")
        self.assertEqual(capture_side(previous.fen(), current.fen()), "white")
        samples = render(current.fen(), previous.fen())
        self.assertTrue(np.any(samples[:, 0]))
        self.assertFalse(np.any(samples[:, 1]))

    def test_black_capture_is_audible_on_black_side(self):
        previous = position_after("e4", "d5", "exd5")
        current = previous.copy()
        current.push_san("Qxd5")
        self.assertEqual(capture_side(previous.fen(), current.fen()), "black")
        samples = render(current.fen(), previous.fen())
        self.assertFalse(np.any(samples[:, 0]))
        self.assertTrue(np.any(samples[:, 1]))

    def test_en_passant_is_a_capture(self):
        previous = position_after("e4", "a6", "e5", "d5")
        current = previous.copy()
        move = current.parse_san("exd6")
        self.assertTrue(current.is_en_passant(move))
        current.push(move)
        self.assertEqual(capture_side(previous.fen(), current.fen()), "white")

    def test_promotion_capture_is_a_capture(self):
        previous = chess.Board("5r2/6Pk/8/8/8/8/8/K7 w - - 0 1")
        current = previous.copy()
        current.push_san("gxf8=Q")
        self.assertEqual(capture_side(previous.fen(), current.fen()), "white")

    def test_castling_has_no_capture_event(self):
        previous = chess.Board("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
        current = previous.copy()
        current.push_san("O-O")
        self.assertIsNone(capture_side(previous.fen(), current.fen()))

    def test_backward_seek_and_unchanged_positions_have_no_capture(self):
        before_capture = position_after("e4", "d5")
        after_capture = position_after("e4", "d5", "exd5")
        pairs = [
            (after_capture.fen(), before_capture.fen()),
            (chess.STARTING_FEN, after_capture.fen()),
            (before_capture.fen(), before_capture.fen()),
        ]
        for previous, current in pairs:
            with self.subTest(previous=previous, current=current):
                self.assertIsNone(capture_side(previous, current))
                self.assertFalse(np.any(render(current, previous)))

    def test_move_counters_are_part_of_transition_validation(self):
        previous = position_after("e4", "d5")
        current = position_after("e4", "d5", "exd5")
        current.fullmove_number += 5
        self.assertIsNone(capture_side(previous.fen(), current.fen()))

    def test_invalid_current_and_previous_fen_remain_client_errors(self):
        for current, previous in [
            ("bad fen", None),
            (chess.STARTING_FEN, "bad fen"),
            ("8/8/8/8/8/8/8/8 w - - 0 1", None),
        ]:
            with self.subTest(current=current, previous=previous):
                with self.assertRaises(HTTPException) as caught:
                    render(current, previous)
                self.assertEqual(caught.exception.status_code, 400)

    def test_king_dyad_produces_audio(self):
        config = quiet_config()
        config["pulseGrid"]["earcons"] = {
            "king": {
                "osc": "sine", "env": {"a": 5, "d": 20, "s": 0.2, "r": 30},
                "dyad": [0, 7], "durMs": 100,
            },
        }
        # White king is on d4, included in the first traversal tick.
        samples = render("7k/8/8/8/3K4/8/8/8 w - - 0 1", config=config)
        self.assertTrue(np.any(samples))


if __name__ == "__main__":
    unittest.main()
