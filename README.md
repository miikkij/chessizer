# Chessboard Sound Web App

This project renders a chess position and interprets it as sound. It is built with React, Vite, Tailwind CSS v4 and shadcn ui components. Audio is generated with Tone.js while chess logic uses compact board strings defined in JSON presets.

## Development

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Run development server**
   ```bash
   pnpm dev
   ```
3. **Build for production**
   ```bash
   pnpm build
   ```
4. **Preview build**
   ```bash
   pnpm preview
   ```
5. **Docker build**
   ```bash
   pnpm docker:build
   ```
6. **Docker run**
   ```bash
   pnpm docker:run
   ```

Configuration files live in `configs/` and follow the schemas in `schemas/`.

## Notes

- Uses Tone.js for audio synthesis.
- Built with Vite, React, and Tailwind.

### SoundAgent (JSON-driven audio)

This project includes a JSON-driven SoundAgent based on `soundAGENTS.md`.

- Config file: `configs/sound-agent-demo.json`
- Engine: `src/audio/SoundAgent.ts`
- App wiring: `src/components/App.tsx` (Play triggers a ~2s clip rendering of the current FEN)

How it works:

- Loads the config at startup, builds voices and a simple row-sequential traversal.
- On Play, schedules earcons for the selected rank per tick with slight jitter and pan by side.
- Plays a short check cue if the current side is in check.

Limitations in the first cut:

- Only `rowSequential` traversal implemented; others can be added where noted in the code.
- Event cues for capture are not wired (need move history); check cue is supported.
