# Chessizer contributor instructions

Read [README.md](README.md) for the current product behavior and setup. The [original project specification](docs/archive/project-spec/AGENTS.original.md) is preserved as design history, including the desired sound presets and position generators. Historical documents describe goals, not proof that a feature exists.

## Product intent

- Make the relationship between White and Black easier to perceive through sound.
- Keep board, history, metrics and audio synchronized to one selected position.
- Preserve legal chess state and explicit move events. Loading, rewinding and seeking must not invent captures.
- Browser audio is the primary experience. The Python WAV renderer is optional; never require it for PGN navigation or Tone.js playback.
- Keep PGN processing local. Document any optional service to which position data is sent.
- This is not a replacement for a chess analysis engine. Random and near-mate generators, the compact board format and the named sound presets remain planned work.

## Current structure

- `src/chess/`: PGN parsing, FEN timeline, move metadata and metrics.
- `src/hooks/useGameState.ts`: the selected game and position.
- `src/audio/`: Tone.js lifecycle, note scheduling, traversal and WAV client.
- `public/configs/sound-agent-demo.json`: the canonical browser sound configuration.
- `src/config/`: the runtime sound schema and shared validation.
- `soundAgentsv2/`: the optional FastAPI/NumPy service and its current operating guide.
- `docs/archive/`: preserved specifications, old reports and inactive design data.
- `examples/audio/`: a documented historical WAV sample.

Use the Node version in `.node-version`, the pnpm version in `package.json`, and Python 3.12 or newer for WAV work. Prefer the service's `.venv` environment. Do not edit generated `dist/`, `node_modules/`, virtual environments or local agent settings as project source.

## Making changes

Use the existing React, Tailwind, chess.js, Chessground and Tone.js interfaces. Reuse the shared sound validator; keep runtime data and archived design examples distinct. Preserve user work and use focused changes. Keep code comments and prompts in English.

For relevant changes run `pnpm lint`, `pnpm test`, `pnpm typecheck` and `pnpm build`. The build must include the active configuration and license notices. For WAV changes, run `python -W error -m unittest discover -s soundAgentsv2 -p test_semantics.py -v` in the configured Python environment. Browser tests do not replace listening checks for sound-design changes.

Update current documentation when behavior or setup changes. Keep original design material in the archive rather than presenting it as implemented behavior. Follow [NOTICE.md](NOTICE.md) when distributing the combined application; preserve dependency notices and make corresponding source available to recipients.

