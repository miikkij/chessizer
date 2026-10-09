
# Chessboard Sound Web App AGENTS

Last updated: 2025-09-12T22:39:27.222441Z

This document tells how to build a web app that listens to a chessboard configuration and turns it into sound. The app plays the board at a user defined tick frequency. The user can switch between several sound configurations. The user can pick a game state from three generators. The user can import games and scrub the move history.

## Goals

1. Fast feeling of the position black versus white through sound.
2. Three game sources.
   1. Start setting.
   2. Random realistic configuration.
   3. Endgame configuration that is near mate.
3. All configuration in JSON files.
4. Web app only. No MIDI.
5. Precise format for a compact board string. One game step equals one string.

## Non goals

1. A chess engine that replaces dedicated analysis tools.
2. Desktop native implementation.
3. Audio export.

## High level system

1. Frontend in React with Vite and Tailwind v4 and shadcn ui.
2. Animation with AnimeJS for board transitions.
3. Audio with Tone.js over the Web Audio API. No MIDI.
4. Chess logic with chess.js or chessops. Either is fine.
5. Build target Node.js v22 for tooling. Static files served by Nginx in Docker.

## Library choices

1. Audio primary choice Tone.js. It gives simple polyphony, envelopes, filters and timing control.
2. Audio fallback raw Web Audio API. Only if Tone is not desired.
3. Chess library chess.js for move legality and PGN. chessops is also allowed.
4. UI shadcn ui and Tailwind v4.
5. Routing is optional. A single page is fine.

## Compact board string format

Purpose is to store one game step as a single fixed length string that the app can read without parsing PGN.

1. Length 256 hex characters.
2. Represents 64 cells. Each cell has two bytes written as four hex chars.
3. Byte one is the piece code.
   1. 00 means empty cell.
   2. White pieces start at 0x10. Black pieces start at 0x20.
   3. Piece index inside the byte.
      1. 01 pawn.
      2. 02 knight.
      3. 03 bishop.
      4. 04 rook.
      5. 05 queen.
      6. 06 king.
   4. Examples.
      1. 0x11 is white pawn.
      2. 0x25 is black queen.
4. Byte two is flags.
   1. Bit 0 piece captured in the last move. Value 1.
   2. Bit 1 piece moved in the last move. Value 2.
   3. Bit 2 piece currently gives check. Value 4.
   4. Bit 3 piece has moved earlier in the game. Value 8.
   5. Bits 4 to 7 are reserved. Value 0.
5. Board traversal is a8 to h8 then a7 to h7 and so on until a1 to h1.
6. Example start setting is in configs/game-presets.json.

Schema is in schemas/board-config.schema.json.

## Sound configuration format

1. Stored in configs/sound-presets.json.
2. Each preset contains engine and mapping sections.
3. Engine gives oscillator, envelope and optional chorus or reverb.
4. Mapping gives rules for pitch, octave, tempo and percussion.
5. Defaults section has tickIntervalMs and compressor settings.

Schema is in schemas/sound-preset.schema.json.

## Sound presets

The repository ships the following presets in sound-presets.json.

1. Harmonic Layers.
   1. Pitch by piece type.
   2. Octave shift by side.
   3. Volume by material value.
   4. Percussion on capture and check.
2. Rhythm Focus.
   1. White as arpeggio.
   2. Black as beat.
   3. Density grows with pieces on board.
3. Electro Scene.
   1. Pulse and glide based textures.
   2. Queen as lead.
   3. King as bass.
4. Ambient Clouds.
   1. Drones and reverb.
   2. Stereo pan reflects balance.
5. Choir Hint.
   1. Choir effect for sides.
   2. Harmony resolves on check and mate.

## Mapping from board to sound

1. Compute material balance.
   1. Pawn 1.
   2. Knight 3.
   3. Bishop 3.
   4. Rook 5.
   5. Queen 9.
2. Compute intensity.
   1. Center control count.
   2. Number of legal captures in the position.
   3. Check state and mate threat.
3. Each tick uses the chosen preset.
   1. Select active voices from kings down to pawns until the polyphony limit.
   2. Map pitch from piece type then shift octave by side.
   3. Set volume from material or piece value.
   4. Play per preset rhythm or chord.
   5. If flags show capture in the last move then trigger percussion once.
4. The tick frequency is adjustable. Default is one second per tick.

## Game sources

### Start setting

1. Fixed board string in configs/game-presets.json under id start_setting.
2. Side to move White.

### Random realistic configuration

1. Generate by random playout from the start using chess.js.
2. Sample a ply count between minPliesFromStart and maxPliesFromStart.
3. Apply legal moves only.
4. Reject positions with both kings in check.
5. Reject immediate illegal castling patterns.
6. Optionally avoid threefold repetition.
7. Convert the board to the compact string for display and sound.

### Endgame configuration near mate

Two strategies are supported.

1. Rule based placement.
   1. Choose a family such as KQ versus K or KR versus K or KBN versus K.
   2. Place kings at a legal distance.
   3. Place the heavy piece or minor pair in typical mating nets.
   4. Validate with chess.js that the side to move has mate in one or two plies.
2. Engine assisted placement.
   1. Use stockfish.wasm in a Web Worker.
   2. Place a random legal endgame with the chosen family.
   3. Search up to mateInMax.
   4. Keep positions that have mate within the limit.

## Import of games

1. Accept PGN text from clipboard or file.
2. Parse with chess.js or chessops.
3. Build a list of positions for each ply.
4. Convert each position to the compact string.
5. Store the list inside the session state.

## Movement history and scrub

1. Show a time line bar that represents moves from start to end.
2. Provide back and forward buttons.
3. Keyboard support.
   1. Left arrow goes back.
   2. Right arrow goes forward.
   3. Space toggles play or pause.
4. AnimeJS animates piece moves between frames.

## UI layout

1. Top bar
   1. Load PGN button.
   2. Generator select with three choices.
   3. Sound preset select.
   4. Tick interval slider in seconds.
   5. Play and pause button.
2. Main area
   1. Chessboard on the left.
   2. History on the right.
   3. Live meters for material and intensity.
3. Bottom area
   1. Status and hints.

All controls live on one page.

## Component plan

1. AppShell
   1. Layout and theme.
2. BoardView
   1. Renders 8 by 8 grid.
   2. Animates changes with AnimeJS.
3. SoundEngine
   1. Wraps Tone.
   2. Prepares synth and percussion per preset.
   3. Drives tick loop.
4. PresetManager
   1. Loads sound-presets.json.
   2. Exposes active preset.
5. GeneratorManager
   1. Start setting returns fixed string.
   2. Random realistic creates legal position.
   3. Endgame near mate creates mating position.
6. Importer
   1. PGN parser.
   2. Timeline builder.
7. HistoryController
   1. Back and forward.
   2. Play and pause.
   3. Jump to index.
8. Encoder
   1. FEN or internal board to compact string.
   2. Compact string to board for debug.
9. Validators
   1. Compact string length equals 256 hex chars.
   2. Only known piece codes used.
   3. Flags are within 0 to 15 for low bits.

## Data contracts

### Board to compact string

1. Input
   1. 8 by 8 matrix of pieces.
2. Output
   1. 256 hex chars string.

### Preset

1. Input
   1. Preset id string.
2. Output
   1. Engine and mapping structures.

### Timeline

1. Input
   1. Array of board strings.
2. Output
   1. The same array and derived metrics.

## Algorithms

### Intensity metric

1. totalCaptures = count of legal capture moves.
2. centerControl = count of squares e4 d4 e5 d5 controlled by any piece.
3. inCheck = 1 if the side to move is in check else 0.
4. intensityScore = 0.4 totalCaptures + 0.4 centerControl + 0.2 inCheck.

### Tempo from intensity

1. tempo = preset.tempoBaseBpm times (1 plus preset.tempoIntensityFactor times normalizedIntensity).
2. Normalize intensity to 0 to 1 with a cap.

### Material balance

1. Sum piece values per side.
2. delta = white minus black.
3. Use delta to adjust master gain and stereo pan if the preset supports it.

## Scheduling and tick loop

1. Tick interval in milliseconds.
2. On each tick
   1. Read current board string.
   2. If moved piece had capture flag then play the capture percussion once.
   3. Select voices per preset.
   4. Schedule notes within the next tick window using Tone.Transport.

## File structure

1. public
2. src
   1. components
   2. audio
   3. chess
   4. state
   5. utils
3. configs
   1. sound-presets.json
   2. game-presets.json
4. schemas
   1. board-config.schema.json
   2. sound-preset.schema.json

## Package scripts

1. dev starts Vite dev server.
2. build creates production build.
3. preview serves dist.

## Docker

A Dockerfile is provided at repo root.

1. Build stage uses node 22 alpine to install and build.
2. Run stage uses nginx to serve dist.
3. Exposes port 80.

### Build and run

1. docker build -t chess-sound .
2. docker run -p 8080:80 chess-sound
3. Open http://localhost:8080

## Agents

The build can be driven by agents. Each agent owns a clear area.

1. Audio Agent
   1. Loads presets.
   2. Creates synth graphs.
   3. Converts board state to scheduled notes.
2. Chess Agent
   1. Holds current position.
   2. Validates legal moves.
   3. Generates random realistic snapshots.
   4. Creates endgames near mate with engine support if enabled.
3. Import Agent
   1. Accepts PGN input.
   2. Produces timeline of compact strings.
4. Encoder Agent
   1. Converts board structures to compact string.
   2. Parses compact string back for checks.
5. UI Agent
   1. Renders board and controls.
   2. Animates transitions.
6. Timeline Agent
   1. Stores move list.
   2. Provides jump and scrub.
7. Preset Agent
   1. Provides preset list.
   2. Validates JSON against schema.
8. QA Agent
   1. Runs checks on config files.
   2. Runs unit tests for encoders and metrics.

## Acceptance criteria

1. Start setting loads and plays with any preset.
2. Random realistic setting produces a legal position within 200 ms on a modern laptop.
3. Endgame setting produces a position with mate in three or less when engine mode is active.
4. Tick interval is adjustable from 0.25 seconds to 5 seconds.
5. Import of a standard PGN works and creates a timeline with correct move count.
6. History left and right works and updates sound and board.
7. All JSON configs pass the provided schemas.

## Security and privacy

1. No network calls to upload game data by default.
2. All processing in the browser.
3. Engine runs in a Web Worker if enabled.

## Performance

1. Audio graphs are pre built when a preset is selected.
2. Use requestIdleCallback to pre compute intensity metrics.
3. Limit polyphony to the preset limit.

## Future ideas

1. Optional convolution reverb samples.
2. Export audio to WAV offline with a worker.
3. Share links that include a compact string.

## Provided files

1. Dockerfile at project root.
2. configs/sound-presets.json
3. configs/game-presets.json
4. schemas/board-config.schema.json
5. schemas/sound-preset.schema.json

## Start position compact string

This value encodes the standard start board. It uses the rules in the format section.

```
2400220023002500260023002200240021002100210021002100210021002100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001100110011001100110011001100110014001200130015001600130012001400
```
