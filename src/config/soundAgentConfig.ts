import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import schema from './sound-agent.schema.json' with { type: 'json' };
import type { SoundAgentConfig } from '../audio/SoundAgent';

export const SOUND_CONFIG_URL = '/configs/sound-agent-demo.json';
export const SOUND_CONFIG_STORAGE_KEY = 'chessizer_config__configs_sound-agent-demo_json';

export type ConfigValidation =
    | { valid: true; config: SoundAgentConfig; errors: [] }
    | { valid: false; errors: string[] };

let validateSchema: ValidateFunction | undefined;
let schemaError: string | undefined;
try {
    validateSchema = new Ajv({ allErrors: true }).compile(schema);
} catch (cause) {
    schemaError = `Sound configuration schema could not be loaded: ${cause instanceof Error ? cause.message : String(cause)}`;
}

function describeError(error: ErrorObject): string {
    const path = error.instancePath || 'configuration';
    if (error.keyword === 'additionalProperties') return `${path}: unknown field "${error.params.additionalProperty}".`;
    if (error.keyword === 'required') return `${path}: missing field "${error.params.missingProperty}".`;
    return `${path}: ${error.message}.`;
}

/** Validate structure and graph references without creating an audio context. */
export function validateSoundAgentConfig(value: unknown): ConfigValidation {
    if (!validateSchema) return { valid: false, errors: [schemaError ?? 'Sound configuration schema is unavailable.'] };
    if (!validateSchema(value)) return { valid: false, errors: (validateSchema.errors ?? []).map(describeError) };

    const config = value as SoundAgentConfig;
    const errors: string[] = [];
    const voices = config.voices!;
    const checkVoice = (voiceId: string, path: string) => {
        if (!Object.hasOwn(voices, voiceId)) errors.push(`${path}: unknown voice "${voiceId}".`);
        else if (voices[voiceId].type === 'Player') errors.push(`${path}: Player voices cannot play note events; use a synth or sampler.`);
    };
    for (const voiceId of Object.keys(voices)) {
        if (/__(white|black)$/.test(voiceId)) errors.push(`/voices/${voiceId}: this suffix is reserved for generated side voices.`);
    }
    for (const [piece, earcon] of Object.entries(config.mappings!.pieceEarcons!)) {
        checkVoice(earcon.voiceId, `/mappings/pieceEarcons/${piece}/voiceId`);
    }
    if (config.events?.check) checkVoice(config.events.check.voiceId, '/events/check/voiceId');
    if (config.events?.capture) checkVoice(config.events.capture.voiceId, '/events/capture/voiceId');
    config.events?.checkmate?.sequence?.forEach((event, index) => checkVoice(event.voiceId, `/events/checkmate/sequence/${index}/voiceId`));
    if (config.scaling?.drone) checkVoice(config.scaling.drone.voiceId, '/scaling/drone/voiceId');

    const checkRange = (range: [number, number] | undefined, path: string) => {
        if (range && range[0] > range[1]) errors.push(`${path}: the minimum must not exceed the maximum.`);
    };
    checkRange(config.limits?.onsetOffsetMs, '/limits/onsetOffsetMs');
    checkRange(config.traversal.concurrency?.onsetOffsetMs, '/traversal/concurrency/onsetOffsetMs');
    const intensity = config.traversal.concurrency?.intensityScaling;
    if (intensity) checkRange([intensity.minFactor ?? 0.5, intensity.maxFactor ?? 1], '/traversal/concurrency/intensityScaling');
    const brightness = config.scaling?.drone?.brightnessByMaterial;
    if (brightness) checkRange([brightness.minHz, brightness.maxHz], '/scaling/drone/brightnessByMaterial');

    return errors.length ? { valid: false, errors } : { valid: true, config, errors: [] };
}

export function parseSoundAgentConfig(text: string): ConfigValidation {
    try {
        return validateSoundAgentConfig(JSON.parse(text));
    } catch (cause) {
        return { valid: false, errors: [`Invalid JSON: ${cause instanceof Error ? cause.message : String(cause)}`] };
    }
}

export function assertSoundAgentConfig(value: unknown): SoundAgentConfig {
    const result = validateSoundAgentConfig(value);
    if (!result.valid) throw new Error(`Invalid sound configuration. ${result.errors.slice(0, 4).join(' ')}`);
    return result.config;
}

export async function fetchSoundAgentConfig(signal: AbortSignal): Promise<{ text: string; config: SoundAgentConfig }> {
    const response = await fetch(SOUND_CONFIG_URL, { signal });
    if (!response.ok) throw new Error(`Could not load sound configuration (HTTP ${response.status}). Try loading defaults again.`);
    const text = await response.text();
    const result = parseSoundAgentConfig(text);
    if (!result.valid) throw new Error(`Could not load sound configuration. ${result.errors.slice(0, 4).join(' ')}`);
    return { text, config: result.config };
}
