import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, mock, test } from 'node:test';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import { Chess } from 'chess.js';
import { useWavPlayer } from '../src/audio/WavSoundPlayer.tsx';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
const { act, cleanup, renderHook } = await import('@testing-library/react');

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

type HookProps = Parameters<typeof useWavPlayer>[0];
type PendingRequest = {
    body: { fen: string; previousFen?: string };
    signal: AbortSignal;
    response: ReturnType<typeof deferred<{ data: Uint8Array }>>;
};
let requests: PendingRequest[];
let playedSources: string[];
let pausedSources: string[];
let revokedUrls: string[];
let pendingPlay: ReturnType<typeof deferred<void>> | undefined;
let nextUrl: number;

const board = new Chess();
const initialFen = board.fen();
board.move('e4');
const afterE4 = board.fen();
board.move('d5');
const afterD5 = board.fen();

function initialProps(overrides: Partial<HookProps> = {}): HookProps {
    return {
        currentFen: initialFen,
        transition: { kind: 'load', move: null },
        ...overrides,
    };
}

function renderPlayer(props = initialProps()) {
    const view = renderHook((input: HookProps) => useWavPlayer(input), { initialProps: props });
    const audio = document.createElement('audio');
    view.result.current.audioRef.current = audio;
    return { ...view, audio };
}

function startPlayer(player: ReturnType<typeof renderPlayer>) {
    let playback!: Promise<void>;
    act(() => { playback = player.result.current.generateAndPlay(); });
    return playback;
}

async function resolveRequest(index: number, playback: Promise<void>) {
    await act(async () => {
        requests[index].response.resolve({ data: new Uint8Array([1, 2, 3]) });
        await playback;
    });
}

beforeEach(() => {
    requests = [];
    playedSources = [];
    pausedSources = [];
    revokedUrls = [];
    pendingPlay = undefined;
    nextUrl = 0;
    // Deliberately ignore abort in this transport stub: late responses must be
    // harmless even when cancellation cannot prevent their eventual delivery.
    mock.method(axios, 'post', (_url: string, body: PendingRequest['body'], options: { signal: AbortSignal }) => {
        const response = deferred<{ data: Uint8Array }>();
        requests.push({ body, signal: options.signal, response });
        return response.promise;
    });
    mock.method(URL, 'createObjectURL', () => `blob:mock-${++nextUrl}`);
    mock.method(URL, 'revokeObjectURL', (url: string) => { revokedUrls.push(url); });
    mock.method(dom.window.HTMLMediaElement.prototype, 'play', function (this: HTMLMediaElement) {
        playedSources.push(this.getAttribute('src') ?? '');
        return pendingPlay?.promise ?? Promise.resolve();
    });
    mock.method(dom.window.HTMLMediaElement.prototype, 'pause', function (this: HTMLMediaElement) {
        pausedSources.push(this.getAttribute('src') ?? '');
    });
    mock.method(dom.window.HTMLMediaElement.prototype, 'load', () => {});
});

afterEach(() => {
    cleanup();
    mock.restoreAll();
});
after(() => { dom.window.close(); });

test('a response for a previous position never starts playback or clears a newer request', async () => {
    const player = renderPlayer();
    const oldPlayback = startPlayer(player);
    assert.equal(player.result.current.isGenerating, true);

    player.rerender(initialProps({ currentFen: afterE4, transition: { kind: 'forward', move: null } }));
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(player.result.current.isGenerating, false);
    const newPlayback = startPlayer(player);

    await resolveRequest(0, oldPlayback);
    assert.equal(playedSources.length, 0);
    assert.equal(player.result.current.isGenerating, true);
    assert.equal(requests[1].signal.aborted, false);

    await resolveRequest(1, newPlayback);
    assert.equal(playedSources.length, 1);
    assert.equal(player.result.current.isGenerating, false);
    assert.equal(player.result.current.isPlaying, true);
});

test('position changes stop current audio and release its URL immediately', async () => {
    const player = renderPlayer();
    await resolveRequest(0, startPlayer(player));
    const playingUrl = player.audio.getAttribute('src')!;
    assert.equal(player.result.current.isPlaying, true);

    player.rerender(initialProps({ currentFen: afterD5, transition: { kind: 'seek', move: null } }));
    assert.equal(player.result.current.isPlaying, false);
    assert.equal(player.audio.getAttribute('src'), null);
    assert.ok(pausedSources.includes(playingUrl));
    assert.ok(revokedUrls.includes(playingUrl));
});

test('disabling WAV cancels a pending request and rejects its late response', async () => {
    const player = renderPlayer();
    const playback = startPlayer(player);
    player.rerender(initialProps({ isEnabled: false }));
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(player.result.current.isGenerating, false);

    await resolveRequest(0, playback);
    assert.equal(playedSources.length, 0);
    assert.equal(player.result.current.isPlaying, false);
    await act(async () => { await player.result.current.generateAndPlay(); });
    assert.equal(requests.length, 1);
});

test('disabling WAV also stops audio that is already playing', async () => {
    const player = renderPlayer();
    await resolveRequest(0, startPlayer(player));
    const playingUrl = player.audio.getAttribute('src')!;
    player.rerender(initialProps({ isEnabled: false }));
    assert.equal(player.result.current.isPlaying, false);
    assert.equal(player.audio.getAttribute('src'), null);
    assert.ok(pausedSources.includes(playingUrl));
    assert.ok(revokedUrls.includes(playingUrl));
});

test('only forward transitions send previousFen to the WAV service', async () => {
    const player = renderPlayer();
    for (const kind of ['load', 'forward', 'backward', 'seek'] as const) {
        player.rerender(initialProps({
            currentFen: afterE4,
            previousFen: initialFen,
            transition: { kind, move: null },
        }));
        const playback = startPlayer(player);
        const index = requests.length - 1;
        assert.equal(Object.hasOwn(requests[index].body, 'previousFen'), kind === 'forward');
        if (kind === 'forward') assert.equal(requests[index].body.previousFen, initialFen);
        await resolveRequest(index, playback);
    }
});

test('an old audio.play promise cannot restore playing state after navigation', async () => {
    let successes = 0;
    pendingPlay = deferred<void>();
    const player = renderPlayer(initialProps({ onSuccess: () => { successes += 1; } }));
    const playback = startPlayer(player);
    await act(async () => {
        requests[0].response.resolve({ data: new Uint8Array([1]) });
        await Promise.resolve();
    });
    assert.equal(playedSources.length, 1);
    assert.equal(player.result.current.isGenerating, true);

    player.rerender(initialProps({ currentFen: afterE4 }));
    await act(async () => {
        pendingPlay!.resolve();
        await playback;
    });
    assert.equal(player.result.current.isPlaying, false);
    assert.equal(player.result.current.isGenerating, false);
    assert.equal(successes, 0);
    assert.equal(player.audio.getAttribute('src'), null);
});

test('unmount aborts generation and prevents subsequent playback', async () => {
    let successes = 0;
    const player = renderPlayer(initialProps({ onSuccess: () => { successes += 1; } }));
    const playback = startPlayer(player);
    player.unmount();
    assert.equal(requests[0].signal.aborted, true);
    await resolveRequest(0, playback);
    assert.equal(playedSources.length, 0);
    assert.equal(successes, 0);
});

test('unmount stops playing audio and revokes its object URL', async () => {
    const player = renderPlayer();
    await resolveRequest(0, startPlayer(player));
    const playingUrl = player.audio.getAttribute('src')!;
    player.unmount();
    assert.equal(player.audio.getAttribute('src'), null);
    assert.ok(pausedSources.includes(playingUrl));
    assert.ok(revokedUrls.includes(playingUrl));
});
