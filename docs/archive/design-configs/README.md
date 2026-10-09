# Archived configuration designs

These files preserve earlier designs. The app does not fetch this directory or expose these proposals as runtime presets.

- `sound-presets.json` and `sound-preset.schema.json` preserve the five proposed sound presets and their historical schema unchanged.
- `game-presets.original-invalid.txt` preserves the malformed original file verbatim. It contained overlapping JSON documents and cannot be parsed as JSON.
- `game-presets.json` reconstructs the distinct proposals as valid JSON. The starting compact board is 256 hex characters and matches the standard position. Fixed examples use explicit, legal FEN setups; the queen example reaches mate in one. No generator or Stockfish implementation is implied.
- `board-config.original.schema.json` preserves the original game schema. `board-config.schema.json` validates the repaired archive data, including the compact snapshot's piece codes and flag range.
- `sound-agent-demo.legacy.json` preserves the older non-served audio configuration. It differs from the active default only by `limits.clipLengthMs: 2200`, which stopped playback after a short clip. The active default retains continuous listening.

The only active browser sound configuration is [public/configs/sound-agent-demo.json](../../../public/configs/sound-agent-demo.json). Its shared runtime validator uses [src/config/sound-agent.schema.json](../../../src/config/sound-agent.schema.json). FEN remains the full game state; the planned compact snapshot does not replace its move metadata.
