# Optional WAV generator

This Python service renders one chess position into a WAV clip. The main application uses Tone.js in the browser; this service is needed only for its WAV panel. This page describes the current [implementation](main.py). The older [WAV design](../docs/archive/wav-design/soundAGENTS_wavev2.md) includes features that are not implemented.

## Setup and startup

Python **3.12 or newer** is required by NumPy. Use the repository's Node.js and pnpm versions from the [main README](../README.md) when starting through the shared launcher.

From the repository root, create a local environment and install dependencies.

Windows PowerShell:

```powershell
py -3.13 -m venv soundAgentsv2/.venv
soundAgentsv2/.venv/Scripts/python.exe -m pip install -r soundAgentsv2/requirements.txt
pnpm wav:server
```

Linux/macOS, with Python 3.12 or a newer installed version:

```sh
python3.12 -m venv soundAgentsv2/.venv
soundAgentsv2/.venv/bin/python -m pip install -r soundAgentsv2/requirements.txt
pnpm wav:server
```

The launcher prefers `soundAgentsv2/.venv`, falls back to the legacy `venv` directory, and rejects Python versions below 3.12. It does not create or replace environments. [start.bat](start.bat) and [start.sh](start.sh) call the same launcher from any working directory.

`pnpm dev` runs the frontend and this service together. `pnpm dev:frontend` runs only the browser application. With an installed Python environment, the service can also be started directly with that environment's Python and `soundAgentsv2/main.py`.

The API is available at **http://localhost:8001**. The current Python entry point binds to `0.0.0.0:8001`; it has no authentication. CORS allows the localhost development origins listed in [main.py](main.py).

## API

| Method and path | Result |
| --- | --- |
| `GET /` | Brief HTML endpoint help |
| `GET /health` | Service health JSON |
| `GET /docs` | Interactive API documentation |
| `GET /openapi.json` | Generated request schema |
| `POST /generate` | Binary WAV, `Content-Type: audio/wav`, attachment filename |

`POST /generate` accepts JSON with:

- `fen`: a legal chess position in FEN notation.
- `config`: a WAV configuration; start with [sample_config.json](sample_config.json).
- `previousFen`: optional previous position. A capture cue is produced only when one legal capture from this position reaches the exact current position, including its turn and move counters. Omit it for loading, seeking or moving backward through history.

The WAV configuration is separate from the browser's Tone.js configuration. They are not interchangeable.

Example Python request, run from the repository root after installing [requirements-dev.txt](requirements-dev.txt):

```python
import json
from pathlib import Path
import requests

config = json.loads(Path("soundAgentsv2/sample_config.json").read_text())
response = requests.post(
    "http://localhost:8001/generate",
    json={
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "config": config,
    },
    timeout=30,
)
response.raise_for_status()
Path("chess_sound.wav").write_bytes(response.content)
```

Invalid or illegal FEN returns **400**. Request-model validation errors return **422**. Other rendering failures return **500**. Pydantic validates the types, required fields and some numeric ranges, but string choices and all cross-field constraints are not fully validated. Unknown fields are ignored. A successfully parsed configuration does not imply that every field affects the sound.

## What the renderer implements

The clip combines repeating percussion, piece motifs, capture/check cues and an ambient chord. A blurred board-occupancy field changes the brightness of piece motifs; it is not a separate audio layer or a chess attack map. Noise and onset jitter make repeated renders nondeterministic.

| Configuration | Current behavior |
| --- | --- |
| `audio.lengthMs` | Clip length, 1,000–10,000 ms. Sounds beyond the clip boundary are cut off. |
| `audio.bitDepth` | Use 16 or 24 for PCM encoding. The model does not restrict the value; the writer treats every non-16 value as 24-bit. |
| `audio.headroomDb` | Attenuates the mix, with an additional peak cap of 0.9. |
| `audio.sampleRate`, `audio.channels` | Accepted but ignored. Output is always **48 kHz stereo**. |
| `groove` | Tempo, bars, kit voices and Euclidean track patterns are used. Each bar has four beats. Missing kit names are skipped. Kit `toneHz` affects tonal voices, not noise voices. |
| `limits.maxConcurrentVoices` | Caps selected occupied cells in each tick. The scanner visits at most four cells per tick; this is not a global limit on overlapping notes. |
| `limits.onsetOffsetMs` | Two values define the random onset-delay range in milliseconds. |
| `pulseGrid` | Uses side-specific `register`, `pan` and `gainDb`, and piece `earcons`. Missing piece earcons are skipped. |
| Earcon shapes | Uses the first nonempty shape in this order: `pattern`, `chord`/`dyad`, `arp` with nonzero `stepMs`. Pattern steps carry their own timing. Chords/dyads use `durMs`; arpeggio notes last `stepMs * 1.5`. |
| Earcon fields | `osc` and `env` are used. `durMs` is required even for patterns/arpeggios, where it does not determine their length. Oscillators are `sine`, `triangle`, `square`, `saw`, `noise`; unknown names fall back to sine. |
| `halo.kernel` | Blurs occupied cells, regardless of piece side or attacks, to set motif brightness. |
| `halo.mode`, `halo.brightnessHz`, `halo.width` | Accepted but ignored. |
| `traversal.tickDurationMs` | Time between four-cell groups. A fixed center-out traversal visits all 64 cells in 16 ticks and repeats. Short clips may end before all pieces are visited. |
| `traversal.strategy`, `traversal.params` | Accepted but ignored; they do not change the traversal. |
| `events.capture` | Only `type: "click"` renders. Uses verified capture side, duration, gain and optional side pan. `leadMs` is a nonnegative delay from clip start, not an advance before the move. |
| `events.check` | Only `type: "glide"` renders. Uses the side whose king is in check to select frequencies and optional pan. Starts at **1.5 seconds**, so clips ending by then contain no check cue. Uses duration/gain; `leadMs` is ignored. |
| `ambient.root`, `ambient.gainDb` | Set the root and volume of a centered sine chord. White material advantage greater than one point gives a major triad; black advantage greater than one gives a minor triad; otherwise a diminished seventh is used. |
| `ambient.mode`, `ambient.qualityByMaterial`, `ambient.brightnessHz` | Accepted but ignored; the chord rule above is fixed. |
| `changeRules` | Accepted but ignored. |
| `diagnostics.logSchedule` | Logs position metrics once per render, not individual note scheduling. |
| `diagnostics.writeStemWavs` | Accepted but ignored. No stem files are written. |
| `version`, `name` | Metadata; neither selects rendering behavior. |

The implementation does not include Stockfish analysis, mate-threat scoring, batch rendering, reverb, caching, streaming generation or MIDI output. Browser audio and WAV rendering use different synthesis paths and need not sound identical.

## Verification

The semantic regression suite needs no running server:

```powershell
soundAgentsv2/.venv/Scripts/python.exe -W error -m unittest discover -s soundAgentsv2 -p test_semantics.py -v
```

On Linux/macOS, use `soundAgentsv2/.venv/bin/python` for the same command.

For the optional HTTP generation utility, install its requests dependency and start the service first:

```powershell
soundAgentsv2/.venv/Scripts/python.exe -m pip install -r soundAgentsv2/requirements-dev.txt
soundAgentsv2/.venv/Scripts/python.exe -X utf8 soundAgentsv2/test_service.py --extended
```

[test_service.py](test_service.py) prints endpoint results and writes `test_*.wav` files into the current working directory. It is a manual diagnostic utility, not a pass/fail regression runner; inspect its output for individual failures.

A preserved six-second recording is available in [examples/audio](../examples/audio/README.md). Its generating position and configuration are not recorded, so it is not a reference output for the current renderer.

## Troubleshooting

- Service unavailable: run `pnpm wav:server` from the repository root and check `/health`.
- Environment error: install Python 3.12 or newer and create `.venv` using the commands above. An existing Python 3.10 `venv` is insufficient.
- HTTP 422: compare the response details with `sample_config.json`; every earcon requires `durMs`.
- No capture cue: supply the exact legal predecessor in `previousFen`. An available capture in the current position is not a completed capture.
- No check cue: use a clip longer than 1.5 seconds and `events.check.type: "glide"`.
- An option has no effect: consult the implementation table before using an archived design example.

Historical documents are preserved under [docs/archive/wav-design](../docs/archive/wav-design/). They describe design intent and earlier behavior, not the current API contract.
