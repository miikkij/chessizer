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
