import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { createGameState, navigateGameState, parseGame } from '../src/chess/game.ts';
import { GAME_PRESETS } from '../src/data/gamePresets.ts';

test('an empty game contains the standard starting position', () => {
    for (const input of ['', '*', '[Event "Starting Position"]\n\n*']) {
        const game = parseGame(input);
        assert.deepEqual(game.positions, [{ fen: DEFAULT_POSITION, move: null }]);
    }
});

test('PGN import preserves headers and plays the complete main line through annotations', () => {
    const game = parseGame('[Event "Annotated game"]\n[White "Ada"]\n[Black "Grace"]\n\n1.e4 {Center control} e5 (1...c5) 2.Nf3 $1 Nc6 *');
    const expected = new Chess();
    expected.loadPgn('1.e4 e5 2.Nf3 Nc6');
    assert.equal(game.positions.length, 5);
    assert.equal(game.title, 'Annotated game');
    assert.equal(game.headers.White, 'Ada');
    assert.equal(game.headers.Black, 'Grace');
    assert.equal(game.positions[4].fen, expected.fen());
    assert.match(game.pgn, /\{Center control\}/);
    assert.deepEqual(game.positions.slice(1).map(frame => frame.move?.san), ['e4', 'e5', 'Nf3', 'Nc6']);
});

test('custom starting positions and black-to-move counters survive import', () => {
    const fen = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
    const game = parseGame(`[SetUp "1"]\n[FEN "${fen}"]\n\n1.Qg7# 1-0`);
    assert.equal(game.positions[0].fen, fen);
    assert.equal(game.positions.length, 2);
    assert.equal(new Chess(game.positions[1].fen).isCheckmate(), true);
    const blackStart = '7k/8/5K2/8/8/8/8/6Q1 b - - 7 23';
    const blackGame = parseGame(`[SetUp "1"]\n[FEN "${blackStart}"]\n\n23...Kh7 *`);
    assert.equal(blackGame.positions[0].fen, blackStart);
    assert.equal(blackGame.positions[1].move?.color, 'b');
    assert.equal(blackGame.positions[1].fen, '8/7k/5K2/8/8/8/8/6Q1 w - - 8 24');
});

test('a setup-only PGN keeps its position without adding moves', () => {
    const fen = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
    const game = parseGame(`[SetUp "1"]\n[FEN "${fen}"]\n\n*`);
    assert.deepEqual(game.positions, [{ fen, move: null }]);
});

test('an invalid PGN cannot replace the current game with a partial parse', () => {
    let state = navigateGameState(createGameState(parseGame('1.d4 d5')), 1);
    const previous = state;
    assert.throws(() => {
        state = createGameState(parseGame('1.e4 e5 2.Bh6'));
    }, /Invalid move/);
    assert.strictEqual(state, previous);
    assert.equal(state.game.positions[state.positionIndex].move?.san, 'd4');
    assert.throws(() => parseGame('[SetUp "1"]\n[FEN "8/8/8/8/8/k7/1pp5/1Q6 w - - 0 1"]\n\n*'), /missing white king/);
});

test('capture metadata describes the actual move, including en passant', () => {
    const capture = parseGame('1.e4 d5 2.exd5 Nf6');
    assert.equal(capture.positions[3].move?.captured, 'p');
    assert.equal(capture.positions[3].move?.color, 'w');
    assert.equal(capture.positions[4].move?.captured, undefined);
    const enPassant = parseGame('1.e4 a6 2.e5 d5 3.exd6');
    const move = enPassant.positions[5].move;
    assert.equal(move?.from, 'e5');
    assert.equal(move?.to, 'd6');
    assert.equal(move?.captured, 'p');
    const board = new Chess(enPassant.positions[5].fen);
    assert.equal(board.get('d5'), undefined);
    assert.deepEqual(board.get('d6'), { color: 'w', type: 'p' });
});

test('castling and promotion are represented by legal moves and complete positions', () => {
    const castle = parseGame('1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.O-O');
    const castleFrame = castle.positions.at(-1)!;
    assert.equal(castleFrame.move?.san, 'O-O');
    const board = new Chess(castleFrame.fen);
    assert.deepEqual(board.get('g1'), { color: 'w', type: 'k' });
    assert.deepEqual(board.get('f1'), { color: 'w', type: 'r' });
    const promotion = parseGame('[SetUp "1"]\n[FEN "7k/P7/7K/8/8/8/8/8 w - - 0 1"]\n\n1.a8=Q+ *');
    assert.equal(promotion.positions[1].move?.promotion, 'q');
    assert.equal(promotion.positions[1].move?.piece, 'p');
});

test('only a single forward step emits a move event, even across captures', () => {
    const game = parseGame('1.e4 d5 2.exd5 Nf6');
    const initial = createGameState(game);
    assert.deepEqual(initial.transition, { kind: 'load', move: null });
    const first = navigateGameState(initial, 1);
    assert.equal(first.positionIndex, 1);
    assert.equal(first.transition.kind, 'forward');
    assert.equal(first.transition.move?.san, 'e4');
    const jumped = navigateGameState(first, 4);
    assert.deepEqual(jumped.transition, { kind: 'seek', move: null });
    const backToCapture = navigateGameState(jumped, 3);
    assert.deepEqual(backToCapture.transition, { kind: 'backward', move: null });
    const beforeCapture = navigateGameState(backToCapture, 2);
    const playedCapture = navigateGameState(beforeCapture, 3);
    assert.equal(playedCapture.transition.move?.captured, 'p');
    assert.equal(playedCapture.transition.move?.color, 'w');
});

test('navigation clamps bounds, ignores invalid indexes and reload resets to the start', () => {
    const game = parseGame('1.e4 e5');
    const initial = createGameState(game);
    assert.strictEqual(navigateGameState(initial, -100), initial);
    assert.strictEqual(navigateGameState(initial, NaN), initial);
    assert.strictEqual(navigateGameState(initial, Infinity), initial);
    const last = navigateGameState(initial, 100);
    assert.equal(last.positionIndex, 2);
    assert.strictEqual(navigateGameState(last, 3), last);
    const reloaded = createGameState(game);
    assert.equal(reloaded.positionIndex, 0);
    assert.deepEqual(reloaded.transition, { kind: 'load', move: null });
});

test('every bundled preset has a legal complete main line and the endgame reaches mate', () => {
    for (const preset of Object.values(GAME_PRESETS)) {
        const game = parseGame(preset.pgn);
        assert.ok(game.positions.length > 1, preset.name);
        for (const frame of game.positions) assert.doesNotThrow(() => new Chess(frame.fen), preset.name);
    }
    const endgame = parseGame(GAME_PRESETS.queen_endgame.pgn);
    assert.equal(new Chess(endgame.positions.at(-1)!.fen).isCheckmate(), true);
});
