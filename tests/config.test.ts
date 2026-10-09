import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import { Chess } from 'chess.js';
import { build, createServer } from 'vite';
import { parseGame } from '../src/chess/game.ts';
import { assertSoundAgentConfig, parseSoundAgentConfig, SOUND_CONFIG_URL, validateSoundAgentConfig } from '../src/config/soundAgentConfig.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const defaultConfig = readJson('public/configs/sound-agent-demo.json');

test('the sole runtime sound asset passes the shared schema and graph validation', () => {
    assert.equal(validateSoundAgentConfig(defaultConfig).valid, true);
    assert.deepEqual(readdirSync(join(root, 'public/configs')), ['sound-agent-demo.json']);
    assert.equal(existsSync(join(root, 'configs/sound-agent-demo.json')), false);
    assert.equal(existsSync(join(root, 'schemas/board-config.schema.json')), false);
    assert.equal(existsSync(join(root, 'schemas/sound-preset.schema.json')), false);
    const invalidJson = parseSoundAgentConfig('{');
    assert.equal(invalidJson.valid, false);
    assert.match(invalidJson.errors[0], /Invalid JSON/);
});

test('the shared validator rejects malformed graphs before an agent can replace working audio', () => {
    const variants: [string, (config: typeof defaultConfig) => void][] = [
        ['unknown synth constructor', config => { config.voices.synthPawn.voice = 'NotAToneConstructor'; }],
        ['unknown effect constructor', config => { config.voices.synthPawn.chain[0].node = 'AudioContext'; }],
        ['malformed options', config => { config.voices.synthPawn.options = { envelope: { sustain: 2 } }; }],
        ['unknown options', config => { config.voices.synthPawn.options = { somethingIgnored: true }; }],
        ['missing voice', config => { config.mappings.pieceEarcons.pawn.voiceId = 'missing'; }],
        ['invalid event reference', config => { config.events.check.voiceId = 'missing'; }],
        ['invalid note', config => { config.mappings.pieceEarcons.pawn.register.white = 'banana'; }],
        ['negative duration', config => { config.mappings.pieceEarcons.pawn.pattern[0].d = -1; }],
        ['ambiguous step', config => { config.mappings.pieceEarcons.pawn.pattern[0].chord = ['0', '7']; }],
        ['unknown traversal', config => { config.traversal.strategy = 'notImplemented'; }],
        ['empty custom traversal', config => { config.traversal = { strategy: 'customList', params: {} }; }],
        ['bad pan', config => { config.colors.white.pan = 3; }],
        ['reversed onset range', config => { config.limits.onsetOffsetMs = [100, 10]; }],
        ['reversed brightness', config => { config.scaling.drone.brightnessByMaterial.minHz = 9000; }],
        ['non-finite number', config => { config.traversal.tickDurationMs = NaN; }],
        ['reserved side alias', config => { config.voices.synthPawn__white = { type: 'Synth' }; }],
        ['player used for notes', config => { config.voices.synthPawn = { type: 'Player', options: { url: '/sound.wav' } }; }],
    ];
    for (const [name, mutate] of variants) {
        const config = structuredClone(defaultConfig);
        mutate(config);
        const result = validateSoundAgentConfig(config);
        assert.equal(result.valid, false, name);
        assert.ok(result.errors.length, name);
        assert.throws(() => assertSoundAgentConfig(config), /Invalid sound configuration/, name);
    }
});

test('archive data is explicit, schema-valid and preserves the non-served legacy difference', () => {
    const archive = 'docs/archive/design-configs/';
    const games = readJson(`${archive}game-presets.json`);
    const validateGames = new Ajv({ allErrors: true }).compile(readJson(`${archive}board-config.schema.json`));
    assert.equal(validateGames(games), true, JSON.stringify(validateGames.errors));
    const validateSounds = new Ajv2020({ allErrors: true }).compile(readJson(`${archive}sound-preset.schema.json`));
    assert.equal(validateSounds(readJson(`${archive}sound-presets.json`)), true, JSON.stringify(validateSounds.errors));
    for (const preset of games.presets) {
        if (preset.type === 'fixed') assert.equal(parseGame(preset.pgn).positions[0].fen, preset.fen);
    }
    const start = games.presets.find((preset: { id: string }) => preset.id === 'start_setting');
    const indexes: Record<string, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
    const expected = new Chess().board().flat().map(piece => piece ? `${piece.color === 'w' ? '1' : '2'}${indexes[piece.type]}00` : '0000').join('');
    assert.equal(start.boardString.length, 256);
    assert.equal(start.boardString, expected);
    const legacy = readJson(`${archive}sound-agent-demo.legacy.json`);
    assert.equal(legacy.limits.clipLengthMs, 2200);
    delete legacy.limits.clipLengthMs;
    assert.deepEqual(legacy, defaultConfig);
    assert.throws(() => JSON.parse(readFileSync(join(root, archive, 'game-presets.original-invalid.txt'), 'utf8')));
});

test('Vite serves and builds the same canonical configuration without publishing design archives', async () => {
    const server = await createServer({ root, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
    try {
        await server.listen();
        const address = server.httpServer?.address();
        assert.ok(address && typeof address !== 'string');
        const response = await fetch(`http://127.0.0.1:${address.port}${SOUND_CONFIG_URL}`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), defaultConfig);
    } finally { await server.close(); }

    const output = await mkdtemp(join(tmpdir(), 'chessizer-config-assets-'));
    try {
        await build({ root, logLevel: 'silent', build: {
            outDir: output,
            emptyOutDir: true,
            lib: { entry: join(root, 'src/config/soundAgentConfig.ts'), formats: ['es'], fileName: 'sound-config-validation' },
        } });
        assert.deepEqual(JSON.parse(readFileSync(join(output, SOUND_CONFIG_URL.slice(1)), 'utf8')), defaultConfig);
        assert.deepEqual(readdirSync(join(output, 'configs')), ['sound-agent-demo.json']);
        assert.equal(existsSync(join(output, 'docs/archive/design-configs')), false);
        assert.equal(existsSync(join(output, 'schemas')), false);
    } finally {
        // Verify the exact temporary destination before recursive cleanup on Windows.
        assert.equal(dirname(resolve(output)), resolve(tmpdir()));
        assert.ok(output.startsWith(join(tmpdir(), 'chessizer-config-assets-')));
        await rm(output, { recursive: true, force: true });
    }
});
