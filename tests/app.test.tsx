import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, mock, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { StrictMode } from 'react';
import { SoundAgent } from '../src/audio/SoundAgent.ts';
import { parseGame, type PositionTransition } from '../src/chess/game.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const matchMedia = (query: string) => ({ matches: query.includes('reduced-motion'), media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
Object.defineProperty(dom.window, 'matchMedia', { value: matchMedia });
Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    Element: { configurable: true, value: dom.window.Element },
    Node: { configurable: true, value: dom.window.Node },
    MutationObserver: { configurable: true, value: dom.window.MutationObserver },
    localStorage: { configurable: true, value: dom.window.localStorage },
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    requestAnimationFrame: { configurable: true, value: dom.window.requestAnimationFrame.bind(dom.window) },
    cancelAnimationFrame: { configurable: true, value: dom.window.cancelAnimationFrame.bind(dom.window) },
    matchMedia: { configurable: true, value: matchMedia },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});

const { render, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react');
const { default: App } = await import('../src/components/App.tsx');
const { toast } = await import('react-hot-toast');
const config = JSON.parse(readFileSync(new URL('../public/configs/sound-agent-demo.json', import.meta.url), 'utf8'));
let positions: { fen: string; transition?: PositionTransition }[];
let volumes: number[];
let started: number;
let pendingInit: Promise<void> | null;
let listeners: WeakMap<SoundAgent, ((playing: boolean) => void) | null>;

beforeEach(() => {
    positions = [];
    volumes = [];
    started = 0;
    pendingInit = null;
    listeners = new WeakMap();
    localStorage.clear();
    mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(config), { headers: { 'Content-Type': 'application/json' } }));
    // Mock only the audio hardware boundary; board, parser, navigation and UI run together.
    mock.method(SoundAgent.prototype, 'setPosition', (fen: string, transition?: PositionTransition) => { positions.push({ fen, transition }); });
    mock.method(SoundAgent.prototype, 'setMasterVolume', (volume: number) => { volumes.push(volume); });
    mock.method(SoundAgent.prototype, 'setPlaybackListener', function (this: SoundAgent, listener: ((playing: boolean) => void) | null) { listeners.set(this, listener); });
    mock.method(SoundAgent.prototype, 'init', () => pendingInit ?? Promise.resolve());
    mock.method(SoundAgent.prototype, 'start', async function (this: SoundAgent) { started++; listeners.get(this)?.(true); });
    mock.method(SoundAgent.prototype, 'stop', function (this: SoundAgent) { listeners.get(this)?.(false); });
    mock.method(SoundAgent.prototype, 'dispose', () => {});
});

afterEach(() => {
    cleanup();
    toast.remove();
    mock.restoreAll();
});
after(() => dom.window.close());

async function openApp() {
    const view = render(<StrictMode><App /></StrictMode>);
    await waitFor(() => assert.equal((view.getByRole('button', { name: 'Listen to position' }) as HTMLButtonElement).disabled, false));
    return view;
}

function importGame(view: ReturnType<typeof render>, pgn: string) {
    fireEvent.click(view.getByText('Import PGN'));
    fireEvent.change(view.getByLabelText('Import a game'), { target: { value: pgn } });
    fireEvent.click(view.getByRole('button', { name: 'Load game' }));
}

test('PGN import, next/previous and scrubbing keep board, notation, history and audio together', async () => {
    const view = await openApp();
    const game = parseGame('[Event "Integration game"]\n\n1.e4 {center} d5 2.exd5 Nf6 *');
    importGame(view, game.pgn);
    assert.ok(view.getByRole('heading', { name: 'Integration game' }));
    assert.equal(view.container.querySelectorAll('cg-board piece').length, 32);
    const currentFen = () => (view.getByLabelText('Current FEN') as HTMLTextAreaElement).value;
    const assertPosition = (index: number, kind: PositionTransition['kind']) => {
        assert.equal(currentFen(), game.positions[index].fen);
        assert.equal(view.getByRole('img', { name: /Chess position/ }).getAttribute('data-fen'), currentFen());
        assert.equal(positions.at(-1)?.fen, currentFen());
        assert.equal(positions.at(-1)?.transition?.kind, kind);
        assert.equal((view.getByRole('slider', { name: /Move history/ }) as HTMLInputElement).value, String(index));
    };
    assertPosition(0, 'load');
    fireEvent.click(view.getByRole('button', { name: 'Next move' }));
    assertPosition(1, 'forward');
    assert.equal(view.getByRole('button', { name: 'Go to 1. e4' }).getAttribute('aria-current'), 'step');
    fireEvent.click(view.getByRole('button', { name: 'Next move' }));
    fireEvent.click(view.getByRole('button', { name: 'Next move' }));
    assertPosition(3, 'forward');
    assert.equal(positions.at(-1)?.transition?.move?.captured, 'p');
    await waitFor(() => assert.equal(view.container.querySelectorAll('cg-board piece.black.pawn').length, 7));
    fireEvent.click(view.getByRole('button', { name: 'Previous move' }));
    assertPosition(2, 'backward');
    assert.equal(positions.at(-1)?.transition?.move, null);
    fireEvent.change(view.getByRole('slider', { name: /Move history/ }), { target: { value: '4' } });
    assertPosition(4, 'seek');
    assert.equal(positions.at(-1)?.transition?.move, null);
});

test('a FEN-based import resets the actual board, and an invalid PGN preserves it', async () => {
    const view = await openApp();
    const pgn = '[Event "Mate study"]\n[SetUp "1"]\n[FEN "7k/5K2/6Q1/8/8/8/8/8 w - - 0 1"]\n\n1.Qg7# 1-0';
    importGame(view, pgn);
    await waitFor(() => assert.equal(view.container.querySelectorAll('cg-board piece').length, 3));
    fireEvent.click(view.getByRole('button', { name: 'Next move' }));
    assert.ok(view.getByText('Checkmate. White wins.'));
    const fen = (view.getByLabelText('Current FEN') as HTMLTextAreaElement).value;
    fireEvent.change(view.getByLabelText('Import a game'), { target: { value: '1.e4 invalidmove' } });
    fireEvent.click(view.getByRole('button', { name: 'Load game' }));
    assert.match(view.getByRole('alert').textContent ?? '', /current game is still open/);
    assert.equal((view.getByLabelText('Current FEN') as HTMLTextAreaElement).value, fen);
    assert.equal(positions.at(-1)?.fen, fen);
});

test('keyboard navigation works after button clicks and ignores text inputs and native Space', async () => {
    const view = await openApp();
    const button = view.getByRole('button', { name: 'Next move' });
    fireEvent.click(button);
    button.focus();
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    assert.equal((view.getByRole('slider', { name: /Move history/ }) as HTMLInputElement).value, '2');
    fireEvent.keyDown(button, { key: 'Home' });
    assert.equal((view.getByRole('slider', { name: /Move history/ }) as HTMLInputElement).value, '0');
    fireEvent.keyDown(view.getByLabelText('Import a game'), { key: 'ArrowRight' });
    assert.equal((view.getByRole('slider', { name: /Move history/ }) as HTMLInputElement).value, '0');
    fireEvent.keyDown(button, { key: ' ' });
    assert.equal(started, 0);
});

test('opening a PGN file and switching to a preset replace the entire timeline', async () => {
    const view = await openApp();
    fireEvent.click(view.getByText('Import PGN'));
    const pgn = '[Event "From file"]\n\n1.d4 d5 2.c4 *';
    const file = { name: 'example.pgn', text: async () => pgn };
    await act(async () => {
        fireEvent.change(view.getByLabelText('Open PGN file', { selector: 'input' }), { target: { files: [file] } });
    });
    assert.ok(view.getByRole('heading', { name: 'From file' }));
    assert.equal((view.getByRole('slider', { name: /Move history/ }) as HTMLInputElement).max, '3');
    fireEvent.click(view.getByRole('button', { name: 'Last position' }));
    fireEvent.change(view.getByLabelText('Game', { exact: true }), { target: { value: 'start' } });
    assert.ok(view.getByRole('heading', { name: 'Starting position' }));
    const slider = view.getByRole('slider', { name: /Move history/ }) as HTMLInputElement;
    assert.equal(slider.value, '0');
    assert.equal(slider.disabled, true);
    assert.equal(positions.at(-1)?.transition?.kind, 'load');
    assert.equal(positions.at(-1)?.fen, parseGame('*').positions[0].fen);
});

test('audio startup uses the latest slider value and cannot finish after unmount', async () => {
    let finish!: () => void;
    pendingInit = new Promise<void>(resolve => { finish = resolve; });
    const view = await openApp();
    fireEvent.click(view.getByRole('button', { name: 'Listen to position' }));
    assert.ok(view.getByRole('button', { name: 'Starting audio…' }));
    fireEvent.change(view.getByRole('slider', { name: /Volume/ }), { target: { value: '0' } });
    await act(async () => { finish(); await pendingInit; });
    assert.equal(volumes.at(-1), 0);
    assert.equal(started, 1);
    fireEvent.click(view.getByRole('button', { name: 'Pause audio' }));
    pendingInit = new Promise<void>(resolve => { finish = resolve; });
    fireEvent.click(view.getByRole('button', { name: 'Listen to position' }));
    view.unmount();
    await act(async () => { finish(); await pendingInit; });
    assert.equal(started, 1, 'unmount must invalidate a pending audio start');
});
