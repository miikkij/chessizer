import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, mock, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { StrictMode } from 'react';
import type { SoundAgent } from '../src/audio/SoundAgent.ts';
import { SOUND_CONFIG_STORAGE_KEY, SOUND_CONFIG_URL } from '../src/config/soundAgentConfig.ts';

const defaultConfig = JSON.parse(readFileSync(new URL('../public/configs/sound-agent-demo.json', import.meta.url), 'utf8'));

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    HTMLInputElement: { configurable: true, value: dom.window.HTMLInputElement },
    Element: { configurable: true, value: dom.window.Element },
    Node: { configurable: true, value: dom.window.Node },
    NodeFilter: { configurable: true, value: dom.window.NodeFilter },
    CustomEvent: { configurable: true, value: dom.window.CustomEvent },
    MutationObserver: { configurable: true, value: dom.window.MutationObserver },
    localStorage: { configurable: true, value: dom.window.localStorage },
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    requestAnimationFrame: { configurable: true, value: dom.window.requestAnimationFrame.bind(dom.window) },
    cancelAnimationFrame: { configurable: true, value: dom.window.cancelAnimationFrame.bind(dom.window) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
});
const { act, cleanup, fireEvent, render, waitFor } = await import('@testing-library/react');
const { default: TraversalControls } = await import('../src/components/TraversalControls.tsx');
const { default: ConfigEditor } = await import('../src/components/ConfigEditor.tsx');

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

type Traversal = ReturnType<SoundAgent['getTraversal']>;
function createAgent(traversal: Traversal) {
    const applied: Traversal[] = [];
    // These controls only need the traversal boundary, not an audio device.
    const agent = {
        getTraversal: () => ({ ...traversal, params: { ...traversal.params } }),
        setTraversal: (strategy: Traversal['strategy'], params: Traversal['params']) => {
            applied.push({ strategy, params: { ...params } });
        },
    } as unknown as SoundAgent;
    return { agent, applied };
}

type PendingRequest = {
    path: string;
    signal: AbortSignal;
    response: ReturnType<typeof deferred<Response>>;
};
let requests: PendingRequest[];
let immediateResponse: ((request: PendingRequest, index: number) => Response | undefined) | undefined;

function defaultResponse(path: string) {
    return path === SOUND_CONFIG_URL
        ? new Response(JSON.stringify(defaultConfig), { headers: { 'Content-Type': 'application/json' } })
        : new Response('Not found', { status: 404 });
}

async function resolveRequest(index: number) {
    await act(async () => { requests[index].response.resolve(defaultResponse(requests[index].path)); });
}

function openEditor(view: ReturnType<typeof render>) {
    fireEvent.click(view.getByRole('button', { name: 'Sound configuration editor' }));
}

beforeEach(() => {
    requests = [];
    immediateResponse = undefined;
    localStorage.clear();
    // Ignore abort deliberately so a transport's late response still exercises
    // the loader's own stale-result guard.
    mock.method(globalThis, 'fetch', (input: Parameters<typeof fetch>[0], options?: RequestInit) => {
        assert.ok(options?.signal, 'Initial editor requests must be cancellable');
        const request: PendingRequest = {
            path: String(input),
            signal: options.signal,
            response: deferred<Response>(),
        };
        requests.push(request);
        const response = immediateResponse?.(request, requests.length - 1);
        return response ? Promise.resolve(response) : request.response.promise;
    });
});

afterEach(() => {
    cleanup();
    mock.restoreAll();
});
after(() => { dom.window.close(); });

test('traversal edits survive a parent render and only reach the same agent on Apply', () => {
    const { agent, applied } = createAgent({ strategy: 'rowSequential', params: { rowsPerTick: 2 } });
    const view = render(<TraversalControls agent={agent} />);
    fireEvent.change(view.getByLabelText('rowsPerTick'), { target: { value: '5' } });
    view.rerender(<TraversalControls agent={agent} />);

    assert.equal((view.getByLabelText('rowsPerTick') as HTMLInputElement).value, '5');
    assert.deepEqual(applied, []);
    fireEvent.click(view.getByRole('button', { name: 'Apply' }));
    assert.deepEqual(applied, [{ strategy: 'rowSequential', params: { rowsPerTick: 5 } }]);
});

test('replacing an agent resets both traversal strategy and its unapplied parameters', () => {
    const first = createAgent({ strategy: 'rowSequential', params: { rowsPerTick: 2 } });
    const second = createAgent({ strategy: 'columnSequential', params: { colsPerTick: 3 } });
    const view = render(<TraversalControls agent={first.agent} />);
    fireEvent.change(view.getByLabelText('rowsPerTick'), { target: { value: '6' } });
    view.rerender(<TraversalControls agent={second.agent} />);

    assert.equal((view.getByLabelText('Traversal strategy') as HTMLSelectElement).value, 'columnSequential');
    assert.equal(view.queryByLabelText('rowsPerTick'), null);
    assert.equal((view.getByLabelText('colsPerTick') as HTMLInputElement).value, '3');
    fireEvent.click(view.getByRole('button', { name: 'Apply' }));
    assert.deepEqual(first.applied, []);
    assert.deepEqual(second.applied, [{ strategy: 'columnSequential', params: { colsPerTick: 3 } }]);
});

test('the runtime-only editor preserves a saved draft and applies it only on explicit Apply', async () => {
    const saved = JSON.stringify({ ...defaultConfig, name: 'saved locally' });
    localStorage.setItem(SOUND_CONFIG_STORAGE_KEY, saved);
    const changes: unknown[] = [];
    const onConfigChange = (value: unknown) => { changes.push(value); };
    const view = render(<ConfigEditor onConfigChange={onConfigChange} />);
    openEditor(view);
    assert.ok(view.getByText('Loading...'));
    assert.equal(view.queryByRole('textbox'), null);

    await waitFor(() => assert.ok(view.queryByRole('textbox')));

    const editor = view.getByRole('textbox') as HTMLTextAreaElement;
    assert.equal(editor.value, saved);
    const edited = JSON.stringify({ ...defaultConfig, name: 'edited after load' });
    fireEvent.change(editor, { target: { value: edited } });
    view.rerender(<ConfigEditor onConfigChange={onConfigChange} />);
    assert.equal((view.getByRole('textbox') as HTMLTextAreaElement).value, edited);
    assert.equal(localStorage.getItem(SOUND_CONFIG_STORAGE_KEY), edited);
    assert.deepEqual(changes, []);
    fireEvent.click(view.getByRole('button', { name: 'Apply' }));
    assert.deepEqual(changes, [JSON.parse(edited)]);
    assert.match(view.getByText(/Sound configuration applied\. Press Listen/).textContent ?? '', /applied/);
    assert.equal(requests.length, 0);
    assert.equal(view.queryByText('Game Presets'), null);
    assert.equal(view.queryByText('Sound Presets'), null);
});

test('a cancelled StrictMode default load cannot replace a newer edit', async () => {
    immediateResponse = (request, index) => index === 0 ? undefined : defaultResponse(request.path);
    const view = render(<StrictMode><ConfigEditor /></StrictMode>);
    openEditor(view);
    await waitFor(() => assert.ok(view.queryByRole('textbox')));
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(requests[1].signal.aborted, false);

    const draft = JSON.stringify({ ...defaultConfig, name: 'keep my current edit' });
    fireEvent.change(view.getByRole('textbox'), { target: { value: draft } });
    const configRequestCount = requests.filter(request => request.path.startsWith('/configs/')).length;
    await resolveRequest(0);

    assert.equal((view.getByRole('textbox') as HTMLTextAreaElement).value, draft);
    assert.equal(requests.filter(request => request.path.startsWith('/configs/')).length, configRequestCount);
});

test('unmount aborts pending config loading and tolerates its eventual response', async () => {
    const changed = mock.fn();
    const view = render(<ConfigEditor onConfigChange={changed} />);
    await waitFor(() => assert.equal(requests.at(-1)?.path, SOUND_CONFIG_URL));
    const pendingIndex = requests.length - 1;
    assert.equal(requests[pendingIndex].signal.aborted, false);

    view.unmount();
    assert.equal(requests[pendingIndex].signal.aborted, true);
    await resolveRequest(pendingIndex);
    assert.equal(view.container.childElementCount, 0);
    assert.equal(changed.mock.callCount(), 0);
});

test('invalid JSON and invalid graph references stay editable and cannot be applied', async () => {
    immediateResponse = request => defaultResponse(request.path);
    const changed = mock.fn();
    const view = render(<ConfigEditor onConfigChange={changed} />);
    openEditor(view);
    await waitFor(() => assert.ok(view.queryByRole('textbox')));
    fireEvent.change(view.getByRole('textbox'), { target: { value: '' } });
    assert.ok(view.getByRole('textbox'));
    assert.match(view.getByRole('alert').textContent ?? '', /Invalid JSON/);
    assert.equal((view.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled, true);

    const invalid = structuredClone(defaultConfig);
    invalid.mappings.pieceEarcons.pawn.voiceId = 'doesNotExist';
    fireEvent.change(view.getByRole('textbox'), { target: { value: JSON.stringify(invalid) } });
    assert.match(view.getByRole('alert').textContent ?? '', /unknown voice "doesNotExist"/);
    fireEvent.click(view.getByRole('button', { name: 'Apply' }));
    assert.equal(changed.mock.callCount(), 0);
    fireEvent.change(view.getByRole('textbox'), { target: { value: JSON.stringify(defaultConfig) } });
    assert.equal((view.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled, false);
    fireEvent.click(view.getByRole('button', { name: 'Apply' }));
    assert.equal(changed.mock.callCount(), 1);
});

test('failed default requests are shown and can be retried without applying anything', async () => {
    immediateResponse = () => new Response('Unavailable', { status: 503 });
    const changed = mock.fn();
    const view = render(<ConfigEditor onConfigChange={changed} />);
    openEditor(view);
    await waitFor(() => assert.match(view.getByRole('alert').textContent ?? '', /HTTP 503/));
    assert.ok(view.getByRole('textbox'));
    assert.equal((view.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled, true);
    immediateResponse = request => defaultResponse(request.path);
    fireEvent.click(view.getByRole('button', { name: 'Load defaults' }));
    await waitFor(() => assert.ok(view.queryByRole('textbox')));
    assert.equal(changed.mock.callCount(), 0);
    assert.ok(requests.every(request => request.path === SOUND_CONFIG_URL));
});

test('the editor reports an apply failure instead of claiming success', async () => {
    immediateResponse = request => defaultResponse(request.path);
    const view = render(<ConfigEditor onConfigChange={() => { throw new Error('Audio graph could not be prepared'); }} />);
    openEditor(view);
    await waitFor(() => assert.ok(view.queryByRole('textbox')));
    fireEvent.click(view.getByRole('button', { name: 'Apply' }));
    assert.match(view.getByRole('alert').textContent ?? '', /Audio graph could not be prepared/);
    assert.equal(view.queryByText(/Sound configuration applied\. Press Listen/), null);
});
