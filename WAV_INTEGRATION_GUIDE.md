# Chess Sound WAV Integration Guide

This guide explains how to use the new Python WAV Generator alongside the existing Tone.js sound engine in the Chessizer app.

## Quick Start

### 1. Start the Python Microservice

```bash
# Navigate to the soundAgentsv2 directory
cd soundAgentsv2

# Windows users:
start.bat

# Linux/macOS users:
chmod +x start.sh && ./start.sh
```

The microservice will start on `http://localhost:8001` and display:
```
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

### 2. Start the Chess App

```bash
# In the main project directory
pnpm dev
```

The app will start on `http://localhost:5173` (or similar port).

### 3. Using Both Sound Engines

The app now has **two sound engines** in the Sound Controls panel:

#### **Tone.js Real-time Engine** (Original)
- Plays continuously as you navigate through moves
- Real-time synthesis with BPM, swing, and tick duration controls
- Immediate response to position changes

#### **Python WAV Generator** (New)
- Generates complete soundscapes as downloadable WAV files
- Rich 5-layer audio with groove, pulse grid, halo effects, event cues, and ambient bed
- Configurable tempo, clip length, voice limits, and more
- Click "Play WAV" to generate and play a soundscape for the current position

## Features of the WAV Generator

### Sound Layers

1. **Groove Layer** - Euclidean drum patterns providing rhythmic foundation
2. **Pulse Grid** - Each piece type has its own unique sound signature
3. **Halo Field** - Spatial effects showing piece influence and threats
4. **Event Cues** - Special sounds for captures and checks
5. **Ambient Bed** - Background harmony reflecting material balance

### Configuration Options

Click the ⚙️ settings button in the WAV section to configure:

- **Microservice URL** - Default: `http://localhost:8001`
- **Audio Settings** - Length (1-10 seconds), sample rate (22-48 kHz)
- **Groove** - Tempo (60-200 BPM), number of bars (1-8)
- **Board Traversal** - Tick duration affecting how pieces are sonified
- **Voice Limits** - Max concurrent sounds (1-16)
- **Presets** - Quick settings for different moods

### Presets

- **Slow & Atmospheric** - 90 BPM, 6-second clips, relaxed pace
- **Fast & Energetic** - 140 BPM, 3-second clips, rapid traversal
- **Minimal** - Limited voices, clean sound

## Comparing the Two Engines

| Feature | Tone.js Engine | WAV Generator |
|---------|---------------|---------------|
| **Response Time** | Instant | 1-3 seconds generation |
| **Audio Quality** | Real-time synthesis | High-quality offline rendering |
| **Playback** | Continuous loop | Fixed-length clips |
| **Customization** | BPM, swing, tick rate | Full 5-layer configuration |
| **Resource Usage** | Low CPU | Higher CPU during generation |
| **File Output** | Browser-only | Downloadable WAV files |
| **Best For** | Live analysis, exploration | Final audio, sharing, archival |

## Use Cases

### **Live Analysis with Tone.js**
- Navigate through games with immediate audio feedback
- Adjust tempo and timing to match your analysis speed
- Get instant sense of position changes

### **Position Portraits with WAV Generator**
- Create high-quality audio "snapshots" of important positions
- Generate shareable audio files of beautiful chess moments
- Experiment with different sonic interpretations of positions
- Archive audio representations of famous games

## Troubleshooting

### WAV Generator Issues

**"Microservice not available"**
- Ensure Python service is running: `cd soundAgentsv2 && python main.py`
- Check the service URL in settings (should be `http://localhost:8001`)
- Verify no firewall is blocking port 8001

**"Invalid request" errors**
- Make sure you have a valid chess position loaded
- Try navigating to a different move and back
- Check browser console for detailed error messages

**Generation is slow**
- Reduce clip length in settings (try 3 seconds instead of 4+)
- Lower the sample rate to 22kHz for faster generation
- Reduce max concurrent voices to 2-4

**No sound from generated WAV**
- Check your browser's volume settings
- Try the volume slider in the WAV player controls
- Verify the WAV file downloaded correctly (check for file size > 0)

### Tone.js Engine Issues

**No real-time sound**
- Click the Play button in the Tone.js section
- Check master volume slider
- Make sure you have a position loaded (navigate through moves)

**Choppy or distorted audio**
- Reduce BPM if your system is struggling
- Increase tick duration for less frequent updates
- Reset audio settings to defaults

## Integration Details

### Data Flow

1. **Chess Position** → Same FEN string used by both engines
2. **Tone.js Engine** → Real-time synthesis via Web Audio API
3. **WAV Generator** → HTTP request to Python microservice → Binary WAV response
4. **Browser Playback** → Standard HTML5 audio element

### Configuration Sync

- Both engines use the **same chess position** (FEN) automatically
- **Independent controls** - changing Tone.js BPM doesn't affect WAV tempo
- **Separate volume controls** - master volume for Tone.js, dedicated slider for WAV

### File Management

- Generated WAV files are played directly in the browser
- Each new generation replaces the previous audio
- Files are temporary - no automatic saving (but you can right-click save)

## Advanced Usage

### Custom Configurations

Edit the WAV configuration JSON to create unique soundscapes:

```json
{
  "groove": {
    "tempoBpm": 80,          // Slow, contemplative tempo
    "kit": {
      "kick": { "gainDb": -12 }  // Quiet kick drum
    }
  },
  "pulseGrid": {
    "register": {
      "white": "C6",         // High register for white
      "black": "C2"          // Low register for black
    }
  }
}
```

### Batch Generation

Use the Python microservice directly to generate WAV files for entire games:

```python
import requests

positions = ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ...]
config = { ... }

for i, fen in enumerate(positions):
    response = requests.post("http://localhost:8001/generate", 
                           json={"fen": fen, "config": config})
    with open(f"move_{i:02d}.wav", "wb") as f:
        f.write(response.content)
```

## Future Enhancements

- **Sync Playback** - Play WAV and Tone.js simultaneously with synchronized timing
- **Position Comparison** - Generate WAVs showing the difference between positions
- **Batch Mode** - Generate WAVs for entire game sequences
- **Export Options** - Save multiple formats (MP3, FLAC, etc.)
- **Preset Sharing** - Import/export sound configuration presets

## Conclusion

The integration of the Python WAV Generator provides the best of both worlds:

- **Real-time exploration** with the Tone.js engine for live analysis
- **High-quality rendering** with the WAV generator for creating definitive audio representations

Experiment with both engines to discover new ways of experiencing chess through sound!