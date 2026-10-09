# 🎵 Chessizer - Sonic Chess Experience

Experience chess through sound! This web application converts chess positions into rich audio landscapes using two complementary sound engines:

- **Tone.js Real-time Engine** - Interactive synthesis for live exploration
- **Python WAV Generator** - High-quality layered soundscapes as downloadable files

Built with React, Vite, Tailwind CSS v4, and shadcn/ui components.

## ✨ Features

### 🎼 Dual Sound Engines
- **Real-time Synthesis**: Continuous audio feedback as you navigate through games
- **WAV Generation**: Create rich 5-layer soundscapes with groove, piece sounds, spatial effects, event cues, and ambient textures
- **Configurable**: Extensive JSON-driven configuration for both engines

### 🏁 Chess Integration  
- **PGN Support**: Load and navigate through chess games
- **Famous Games**: Includes classics like the Immortal Game, Evergreen Game, etc.
- **Real-time Analysis**: Audio responds immediately to position changes
- **FEN Compatibility**: Works with any valid chess position

### 🎛️ Advanced Audio
- **Spatial Audio**: Stereo positioning reflects piece colors and board layout
- **Euclidean Rhythms**: Mathematically pleasing drum patterns
- **Piece Earcons**: Unique sounds for each piece type (pawn, knight, bishop, etc.)
- **Dynamic Effects**: Halo fields, material balance, and threat detection

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v22.12 or higher)
- **pnpm** package manager
- **Python** (v3.8 or higher) - for WAV generator

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/miikkij/chessizer.git
   cd chessizer
   ```

2. **Install Node.js dependencies**
   ```bash
   # Install pnpm if you don't have it
   npm install -g pnpm
   
   # Install project dependencies
   pnpm install
   ```

3. **Set up Python WAV Generator** (optional but recommended)
   ```bash
   # Navigate to the microservice directory
   cd soundAgentsv2
   
   # Windows users:
   start.bat
   
   # Linux/macOS users:
   chmod +x start.sh && ./start.sh
   
   # Or manually:
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python main.py
   
   # The service will start on http://localhost:8001 with CORS enabled for the React app
   ```

4. **Start the development server**
   ```bash
   # In the main project directory
   pnpm dev:frontend
   ```

5. **Open your browser**
   - React app: `http://localhost:12173`
   - Python API docs: `http://localhost:8001/docs` (if WAV generator is running)

## 🎮 Usage

### Basic Operation

1. **Load a game**: Choose a sample or open **Import PGN** to paste text or open a `.pgn` file. Comments and custom FEN starting positions are supported. An invalid import keeps the current game open.
2. **Navigate**: Use the move list, timeline slider or previous/next buttons. Left/Right navigate; Home/End jump to the start/end. The board and audio use the same selected position.
3. **Listen**: Click **Listen to position**, or press Space, to repeat the current position. Set the repeat interval and volume below the board. Listening does not automatically advance the game.
4. **Read the position**: Material, available captures and center control are shown beside the board. Activity measures captures, center attacks and check; it is not an engine evaluation.
5. **Explore further**: Open **Sound tools and advanced settings** for traversal controls, individual sound previews, configuration editing and optional WAV playback. WAV playback requires the Python service and stops when browser audio starts or the position changes.

### Sound Engine Comparison

| Feature | Tone.js Engine | WAV Generator |
|---------|---------------|---------------|
| Response | Instant | 1-3 seconds |
| Quality | Real-time synthesis | Studio-quality rendering |
| Playback | Continuous loop | Fixed clips (1-10s) |
| Customization | BPM, swing, volume | Full 5-layer configuration |
| Best for | Live analysis | Final audio, sharing |

### Configuration

- **Browser audio**: Adjust position repeat interval and volume in real time
- **WAV Settings**: Click ⚙️ to configure tempo, clip length, voice limits, and audio layers
- **Presets**: Quick settings for different moods (Slow & Atmospheric, Fast & Energetic, Minimal)

## 🏗️ Development

### Available Scripts

```bash
# Development
pnpm dev:frontend # Browser app only, http://localhost:12173
pnpm dev          # Browser app and local Python WAV service together
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
pnpm test         # PGN, navigation, audio lifecycle and React integration regressions

# Docker
pnpm docker:build # Build Docker image
pnpm docker:run   # Run in Docker container
```

### Project Structure

```
├── src/
│   ├── components/         # React components
│   │   ├── App.tsx        # Main application
│   │   ├── BoardView.tsx  # Board controlled by the selected timeline frame
│   │   ├── MoveHistory.tsx # Timeline navigation
│   │   ├── WavPlayerControls.tsx  # WAV generator UI
│   │   └── ...
│   ├── audio/             # Sound engines
│   │   ├── SoundAgent.ts  # Tone.js real-time engine
│   │   └── WavSoundPlayer.tsx     # WAV generator integration
│   └── ...
├── tests/                 # Node/React regression tests (pnpm test)
├── soundAgentsv2/         # Python WAV microservice
│   ├── main.py           # FastAPI application
│   ├── requirements.txt  # Python dependencies
│   ├── sample_config.json # Example configuration
│   └── ...
├── configs/              # JSON configurations
│   ├── sound-presets.json
│   └── game-presets.json
└── schemas/              # JSON schemas
```

### Configuration System

Both sound engines use JSON-driven configuration:

- **Tone.js Config**: `configs/sound-agent-demo.json`
- **WAV Config**: Editable through UI, see `soundAgentsv2/sample_config.json`

Example WAV configuration:
```json
{
  "groove": {
    "tempoBpm": 120,
    "kit": {
      "kick": {"type": "sineClick", "toneHz": 60, "gainDb": -6}
    }
  },
  "pulseGrid": {
    "earcons": {
      "queen": {
        "osc": "saw",
        "arp": [0, 4, 7, 12],
        "stepMs": 40
      }
    }
  }
}
```

## 🔧 Advanced Features

### Python WAV Generator

The microservice (`soundAgentsv2/`) generates rich audio with 5 layers:

1. **Groove Layer** - Euclidean drum patterns
2. **Pulse Grid** - Piece-specific sounds with spatial placement
3. **Halo Field** - Influence/threat visualization through audio
4. **Event Cues** - Capture and check sound effects
5. **Ambient Bed** - Harmonic background reflecting position

### API Usage

```bash
# Generate WAV for starting position
curl -X POST "http://localhost:8001/generate" \
     -H "Content-Type: application/json" \
     -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "config": {...}}' \
     --output chess_sound.wav
```

### Testing

```bash
# Core regressions (does not require audio hardware or a running server)
pnpm test
pnpm lint
pnpm build

# WAV move-event and synthesis regressions (activate the Python environment first)
cd soundAgentsv2
python -m unittest test_semantics -v

# Test the WAV microservice
python test_service.py

# Extended tests with configuration variations  
python test_service.py --extended
```

The frontend tests mount the real board, PGN importer and navigation in JSDOM while mocking audio hardware. They check that visible positions and audio inputs agree, but do not replace listening and layout checks in a browser. WAV regression tests render audio in memory without starting the HTTP service.

## 🐳 Docker Deployment

```bash
# Build and run with Docker
pnpm docker:build
pnpm docker:run

# Access at http://localhost:8080
```

The Docker container includes only the React app. Run the Python microservice separately if needed.

## 📚 Documentation

- **[WAV Integration Guide](WAV_INTEGRATION_GUIDE.md)** - Complete usage guide
- **[soundAGENTS v2](soundAgentsv2/soundAGENTS_wavev2.md)** - WAV generator specification  
- **[Python Service README](soundAgentsv2/README.md)** - Microservice documentation

## 🛠️ Troubleshooting

### Common Issues

#### CORS Errors
**Error**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**: 
1. Make sure the Python microservice is running: `cd soundAgentsv2 && python main.py`
2. Verify the service shows "CORS enabled" in the startup logs
3. Check that your React app URL is included in the CORS allow_origins list in `soundAgentsv2/main.py`
4. Try restarting both the Python service and React app

#### WAV Generator Not Working
**Error**: `Microservice not available` or `Network Error`

**Solutions**:
- Ensure Python service is running on port 8001
- Check firewall settings aren't blocking port 8001
- Verify the microservice URL in the WAV settings (⚙️ button)
- Check browser console for detailed error messages

#### Python Dependencies
**Error**: Package installation failures

**Solutions**:
- Make sure you're using Python 3.8 or higher: `python --version`
- Try updating pip: `python -m pip install --upgrade pip`
- Use a virtual environment to avoid conflicts
- On Windows, you may need Visual Studio Build Tools for some packages

#### Performance Issues
**Problem**: Slow WAV generation or choppy real-time audio

**Solutions**:
- Reduce WAV clip length to 3 seconds or less
- Lower sample rate to 22kHz for faster generation
- Reduce max concurrent voices to 2-4
- Close other browser tabs to free up memory

## 🛠️ Technical Details

### Dependencies

**Frontend:**
- React 19+ with TypeScript
- Vite for build tooling
- Tone.js for real-time audio synthesis
- Tailwind CSS v4 for styling
- chess.js for chess logic
- axios for HTTP requests

**Backend (WAV Generator):**
- FastAPI for web framework
- python-chess for position analysis
- NumPy for audio processing
- Pydantic for data validation

### Performance

- **React App**: ~2MB bundle, loads in <2s
- **WAV Generation**: 1-3 seconds per clip
- **Real-time Audio**: <10ms latency with Web Audio API
- **Memory Usage**: ~50MB during WAV generation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Notes

- Uses JSON schemas for configuration validation
- Real-time audio via Tone.js and Web Audio API
- WAV generation uses pure Python NumPy synthesis
- Responsive design with Tailwind CSS
- TypeScript for type safety

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tone.js** community for excellent Web Audio abstractions
- **python-chess** for comprehensive chess logic
- **FastAPI** for elegant Python web APIs  
- **Vite** and **React** teams for amazing developer experience

## 🎵 Sound Design Credits

The audio synthesis approach is based on:
- Euclidean rhythm algorithms for natural drum patterns
- Spatial audio principles for chess board representation
- Psychoacoustic research on earcons and auditory icons
- Musical harmony theory for position-based chord progressions

---

**Experience chess like never before - through the power of sound! 🎼♟️**
