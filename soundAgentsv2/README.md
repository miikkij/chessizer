# Chess Sound WAV Generator Microservice

A Python microservice that generates stereo WAV soundscapes from chess positions using the layered audio approach described in `soundAGENTS_wavev2.md`.

## Overview

This microservice converts chess positions (FEN notation) into rich audio soundscapes with 5 distinct layers:

1. **Groove Layer** - Euclidean rhythm patterns providing rhythmic foundation
2. **Pulse Grid** - Individual piece sounds arranged spatially across the board
3. **Halo Field** - Spatial audio effects representing piece influence/threats
4. **Event Cues** - Audio icons for captures, checks, and special moves  
5. **Ambient Bed** - Background drones reflecting material balance and position

## Quick Start

### Prerequisites

- Python 3.8 or higher
- pip package manager

### Installation & Running

#### Windows
```bash
# Navigate to the soundAgentsv2 directory
cd soundAgentsv2

# Run the startup script
start.bat
```

#### Linux/macOS
```bash
# Navigate to the soundAgentsv2 directory
cd soundAgentsv2

# Make script executable and run
chmod +x start.sh
./start.sh
```

#### Manual Setup
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the microservice
python main.py
```

The service will start on `http://localhost:8001`

## API Usage

### Endpoints

- **GET /** - API documentation page
- **GET /health** - Health check endpoint
- **GET /docs** - Interactive OpenAPI documentation  
- **POST /generate** - Generate WAV from chess position

### Generate WAV Endpoint

**POST /generate**

Accepts a JSON payload with:
- `fen` (string) - Chess position in FEN notation
- `config` (object) - Sound configuration (see Configuration section)
- `previousFen` (optional string) - Previous position for change detection

Returns a binary WAV file.

#### Example Request

```bash
curl -X POST "http://localhost:8001/generate" \
     -H "Content-Type: application/json" \
     -d '{
       "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
       "config": { ... }
     }' \
     --output chess_sound.wav
```

## Configuration

The sound configuration is a comprehensive JSON object that controls all aspects of audio generation. See `sample_config.json` for a complete example.

### Key Configuration Sections

#### Audio Settings
```json
{
  "audio": {
    "sampleRate": 48000,    // Sample rate in Hz
    "bitDepth": 16,         // Bit depth (16 or 24)
    "channels": 2,          // Stereo channels
    "lengthMs": 4000,       // Clip length in milliseconds
    "headroomDb": 6         // Headroom for limiting
  }
}
```

#### Groove Layer
```json
{
  "groove": {
    "tempoBpm": 120,        // Tempo in beats per minute
    "bars": 2,              // Number of bars in pattern
    "kit": {                // Drum kit definitions
      "kick": { "type": "sineClick", "toneHz": 60, "decayMs": 180, "gainDb": -6 },
      "snare": { "type": "noiseSnap", "toneHz": 180, "decayMs": 140, "gainDb": -9 },
      "hat": { "type": "noiseTick", "toneHz": 8000, "decayMs": 30, "gainDb": -12 }
    },
    "tracks": [             // Euclidean rhythm patterns
      { "voice": "kick", "steps": 16, "pulses": 4, "rotate": 0 }
    ]
  }
}
```

#### Pulse Grid (Piece Sounds)
```json
{
  "pulseGrid": {
    "earcons": {            // Sound definitions for each piece type
      "pawn": {
        "osc": "triangle",  // Oscillator type
        "env": { "a": 5, "d": 60, "s": 0.2, "r": 80 }, // ADSR envelope
        "pattern": [        // Sequence of notes
          { "t": 0, "semitone": 0, "durMs": 120 },
          { "t": 140, "semitone": 2, "durMs": 100 }
        ]
      }
    },
    "register": { "white": "C5", "black": "C3" },  // Base notes for colors
    "pan": { "white": -0.3, "black": 0.3 },        // Stereo positioning
    "gainDb": { "white": -10, "black": -10 }       // Volume levels
  }
}
```

## Testing

Test the microservice with the included test script:

```bash
# Basic test - generates WAV files for different positions
python test_service.py

# Extended test - includes configuration variations
python test_service.py --extended
```

This will:
1. Check if the service is running
2. Generate WAV files for various chess positions
3. Verify the generated files are valid WAV format
4. Test configuration variations (if --extended flag is used)

## Integration with Chess App

The microservice integrates with the main React chess application through the `WavPlayerControls` component:

1. **Automatic Position Sync** - Uses the same FEN position as the Tone.js engine
2. **Real-time Configuration** - UI controls to adjust tempo, length, voices, etc.
3. **Error Handling** - Clear error messages for common issues (service down, invalid FEN)
4. **Audio Playback** - Generated WAV files play directly in the browser

### Troubleshooting Integration

**"Microservice not available"**
- Ensure Python service is running: `cd soundAgentsv2 && python main.py`
- Check the URL in the UI (default: `http://localhost:8001`)
- Verify no firewall is blocking port 8001

**"Invalid request" errors**
- Check that the current chess position is valid
- Verify the sound configuration is complete

## Architecture

### Sound Generation Pipeline

1. **FEN Parsing** - Convert chess notation to 8x8 board matrix
2. **Position Analysis** - Calculate metrics (material balance, center control, threats)
3. **Layer Generation**:
   - Groove: Euclidean rhythm patterns
   - Pulse Grid: Piece-specific earcons with spatial placement
   - Halo: Convolution-based influence field
   - Events: Capture and check audio cues
   - Ambient: Material-based harmonic background
4. **Audio Mixing** - Combine layers with proper gain staging
5. **WAV Export** - Convert to binary audio format

### Performance

- **Generation Time**: ~1-3 seconds for typical 4-second clips
- **Memory Usage**: ~50MB during generation
- **File Size**: ~400KB for 4-second stereo WAV at 48kHz/16-bit

## Files

- `main.py` - FastAPI microservice implementation
- `requirements.txt` - Python dependencies
- `sample_config.json` - Example sound configuration
- `test_service.py` - Test script for verification
- `start.bat` / `start.sh` - Startup scripts
- `soundAGENTS_wavev2.md` - Complete specification document

## Dependencies

- **FastAPI** - Web framework
- **python-chess** - Chess position analysis
- **numpy** - Audio processing and synthesis
- **pydantic** - Configuration validation
- **uvicorn** - ASGI server

## Future Enhancements

- **Stockfish Integration** - AI-powered position evaluation
- **Batch Processing** - Generate WAVs for entire games
- **Custom Tunings** - Microtonal and alternative scales
- **Convolution Reverb** - Realistic acoustic spaces
- **MIDI Export** - Generate MIDI alongside WAV

## Support

For issues or questions:
1. Check the health endpoint: `http://localhost:8001/health`
2. Review the interactive docs: `http://localhost:8001/docs` 
3. Run the test script to verify functionality
4. Check console output for detailed error messages