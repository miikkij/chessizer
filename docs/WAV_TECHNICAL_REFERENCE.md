# WAV Sound Player Technical Reference

## Complete Configuration Example

Below is a fully annotated example of a valid WAV sound configuration:

```json
{
  "version": "1.0",
  "name": "chessSoundWaveDemo",
  
  // Core audio format settings
  "audio": {
    "sampleRate": 48000,    // Professional audio standard
    "bitDepth": 16,         // CD quality
    "channels": 2,          // Stereo output
    "lengthMs": 4000,       // 4-second audio clips
    "headroomDb": 6         // Prevent digital clipping
  },
  
  // Performance and complexity limits
  "limits": {
    "maxConcurrentVoices": 4,     // Maximum simultaneous sounds
    "onsetOffsetMs": [20, 50]     // Timing humanization range
  },
  
  // Rhythmic foundation layer
  "groove": {
    "tempoBpm": 120,              // Standard tempo
    "bars": 2,                    // Two bars of rhythm
    
    // Drum kit voice definitions
    "kit": {
      "kick": {
        "type": "sineClick",      // Synthesized kick drum
        "toneHz": 60,             // Sub-bass frequency
        "decayMs": 180,           // Medium decay
        "pan": 0.0,               // Center position
        "gainDb": -6              // Moderate volume
      },
      "snare": {
        "type": "noiseSnap",      // Noise-based snare
        "toneHz": 180,            // Higher fundamental
        "decayMs": 140,           // Shorter decay
        "pan": 0.0,               // Center position
        "gainDb": -9              // Quieter than kick
      },
      "hat": {
        "type": "noiseTick",      // High-frequency percussion
        "toneHz": 8000,           // Very high frequency
        "decayMs": 30,            // Very short decay
        "pan": 0.0,               // Center position
        "gainDb": -12             // Quiet, textural element
      }
    },
    
    // Euclidean rhythm patterns
    "tracks": [
      {
        "voice": "kick",          // Use kick voice
        "steps": 16,              // 16-step pattern (4/4 time)
        "pulses": 4,              // 4 kicks per pattern
        "rotate": 0               // No rotation offset
      },
      {
        "voice": "snare",         // Use snare voice
        "steps": 16,              // 16-step pattern
        "pulses": 3,              // 3 snares (creates syncopation)
        "rotate": 2               // Offset by 2 steps
      },
      {
        "voice": "hat",           // Use hat voice
        "steps": 16,              // 16-step pattern
        "pulses": 9,              // Dense pattern for texture
        "rotate": 0               // No rotation
      }
    ]
  },
  
  // Individual piece sound signatures
  "pulseGrid": {
    "earcons": {
      // Pawn: Simple two-note pattern
      "pawn": {
        "osc": "triangle",        // Warm, simple waveform
        "env": {                  // Envelope shape
          "a": 5,                 // Quick attack
          "d": 60,                // Medium decay
          "s": 0.2,               // Low sustain
          "r": 80                 // Medium release
        },
        "durMs": 240,             // Total duration
        "pattern": [              // Sequential notes
          {
            "t": 0,               // Start immediately
            "semitone": 0,        // Root note
            "durMs": 120          // First note duration
          },
          {
            "t": 140,             // Start after 140ms
            "semitone": 2,        // Major second up
            "durMs": 100          // Second note duration
          }
        ]
      },
      
      // Knight: Three-note jumping pattern
      "knight": {
        "osc": "square",          // Edgy waveform for unique piece
        "env": {
          "a": 5,
          "d": 80,
          "s": 0.2,
          "r": 120
        },
        "durMs": 350,
        "pattern": [
          {
            "t": 0,
            "semitone": 0,        // Starting note
            "durMs": 90
          },
          {
            "t": 120,
            "semitone": 3,        // Minor third up (jump)
            "durMs": 90
          },
          {
            "t": 240,
            "semitone": -1,       // Semitone down (L-shape)
            "durMs": 90
          }
        ]
      },
      
      // Bishop: Smooth two-note glide
      "bishop": {
        "osc": "sine",            // Pure tone for diagonal movement
        "env": {
          "a": 5,
          "d": 120,
          "s": 0.2,
          "r": 120
        },
        "durMs": 320,
        "pattern": [
          {
            "t": 0,
            "semitone": 0,
            "durMs": 160
          },
          {
            "t": 180,
            "semitone": 2,        // Smooth upward glide
            "durMs": 140
          }
        ]
      },
      
      // Rook: Power chord (strong, linear)
      "rook": {
        "osc": "saw",             // Bright, powerful waveform
        "env": {
          "a": 5,
          "d": 100,
          "s": 0.2,
          "r": 140
        },
        "chord": [0, 7, 12],      // Root, fifth, octave
        "durMs": 120
      },
      
      // Queen: Arpeggiated chord (versatile)
      "queen": {
        "osc": "saw",
        "env": {
          "a": 5,
          "d": 120,
          "s": 0.2,
          "r": 180
        },
        "arp": [0, 4, 7, 12],     // Major triad + octave
        "stepMs": 40,             // Arpeggio timing
        "durMs": 220
      },
      
      // King: Two-note harmony (dignified)
      "king": {
        "osc": "sine",
        "env": {
          "a": 5,
          "d": 140,
          "s": 0.2,
          "r": 200
        },
        "dyad": [0, 7],           // Perfect fifth
        "durMs": 180
      }
    },
    
    // Pitch register per side
    "register": {
      "white": "C5",              // Higher register for white
      "black": "C3"               // Lower register for black
    },
    
    // Stereo positioning per side
    "pan": {
      "white": -0.3,              // Slightly left for white
      "black": 0.3                // Slightly right for black
    },
    
    // Volume per side
    "gainDb": {
      "white": -10,
      "black": -10
    }
  },
  
  // Spatial audio field
  "halo": {
    "mode": "threat",             // Emphasize attacking pieces
    "kernel": [                   // 3x3 blur kernel
      [0.25, 0.5, 0.25],
      [0.5, 1.0, 0.5],
      [0.25, 0.5, 0.25]
    ],
    "brightnessHz": {
      "min": 800,                 // Low activity frequency
      "max": 4000                 // High activity frequency
    },
    "width": {
      "min": 0,                   // Narrow stereo field
      "max": 0.5                  // Wide stereo field
    }
  },
  
  // Event-driven sounds
  "events": {
    "capture": {
      "type": "click",            // Sharp transient for captures
      "durMs": 90,
      "leadMs": 30,               // Slight anticipation
      "gainDb": -4,
      "panBySide": {              // Side-specific positioning
        "white": -0.3,
        "black": 0.3
      }
    },
    "check": {
      "type": "glide",            // Gliding tone for checks
      "fromHzWhite": 1100,        // White check start frequency
      "toHzWhite": 1800,          // White check end frequency
      "fromHzBlack": 400,         // Black check start frequency
      "toHzBlack": 260,           // Black check end frequency
      "durMs": 200,
      "gainDb": -6
    }
  },
  
  // Harmonic background
  "ambient": {
    "mode": "triad",              // Chord-based ambient
    "root": "C2",                 // Low bass root
    "qualityByMaterial": {        // Chord quality reflects advantage
      "white": "major",           // Major = positive/advantage
      "black": "minor"            // Minor = negative/disadvantage
    },
    "brightnessHz": {
      "white": 1200,              // Brighter for white advantage
      "black": 800                // Darker for black positions
    },
    "gainDb": -20                 // Subtle background level
  },
  
  // Board scanning strategy
  "traversal": {
    "strategy": "spiralFromCenter",  // Start from center, spiral out
    "params": {
      "center": ["d4", "e4", "d5", "e5"],  // Central squares
      "orientation": "cw"                   // Clockwise spiral
    },
    "tickDurationMs": 300         // 300ms per square
  },
  
  // Dynamic response rules
  "changeRules": {
    "onMaterialSwing": {
      "points": 1,                // Trigger on 1-point material change
      "action": "addHatFill"      // Increase hi-hat density
    },
    "onCheck": {
      "action": "raiseBrightness", // Increase spectral content
      "amount": 0.2               // 20% brightness increase
    },
    "onCapture": {
      "action": "kickFill"        // Add extra kick drums
    },
    "onQuiet": {
      "action": "reduceHalo",     // Decrease spatial complexity
      "amount": 0.2               // 20% reduction
    }
  },
  
  // Development options
  "diagnostics": {
    "writeStemWavs": false,       // Don't export individual layers
    "logSchedule": true           // Log synthesis events
  }
}
```

## API Request Format

### HTTP POST to `/generate`

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "config": { /* Full WavConfig object as shown above */ },
  "previousFen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
}
```

### Response

**Success (200 OK)**:
- Content-Type: `audio/wav`
- Binary WAV file data
- Content-Disposition header with filename

**Validation Error (422 Unprocessable Entity)**:
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "config", "pulseGrid", "earcons", "pawn", "durMs"],
      "msg": "Field required",
      "input": { /* Problematic input object */ }
    }
  ]
}
```

## Synthesis Algorithm Details

### Euclidean Rhythm Generation

For each groove track with `steps` and `pulses`:

1. Create array of `steps` boolean values
2. Distribute `pulses` as evenly as possible using Bresenham's algorithm
3. Apply `rotate` offset by shifting the pattern
4. Convert to timing events based on `tempoBpm`

Example: `steps=8, pulses=3` produces pattern `[1,0,0,1,0,0,1,0]`

### Earcon Synthesis

Each piece type generates audio according to its configuration:

1. **Pattern Mode**: Sequential notes with individual timing and pitch
2. **Chord Mode**: Simultaneous notes at specified intervals
3. **Arp Mode**: Arpeggiated notes with fixed step timing
4. **Dyad Mode**: Two-note harmony

### Spatial Processing

The halo field uses 2D convolution to blur piece influence:

1. Map piece positions to 8x8 grid with influence values
2. Apply convolution kernel to create smooth field
3. Convert field values to audio parameters (frequency, stereo width)
4. Generate filtered noise or tonal content

### Event Detection

Position comparison detects:
- **Captures**: Piece count reduction between positions
- **Checks**: King under attack in current position
- **Material Swings**: Significant point value changes
- **Quiet Moves**: No captures or checks

## Development and Testing

### Validation

The service validates all input against Pydantic models:
- Type checking for all fields
- Range validation for numeric values
- Enum validation for string choices
- Required field enforcement

### Error Handling

Common validation errors:
- Missing required fields (especially `durMs` in earcons)
- Invalid FEN strings
- Out-of-range numeric values
- Unknown enumeration values

### Performance Tuning

Key parameters for performance:
- `maxConcurrentVoices`: Lower values improve CPU performance
- `lengthMs`: Shorter clips render faster
- `sampleRate`: Lower rates reduce memory usage
- Earcon complexity: Simpler patterns render faster

### Debugging

Use diagnostics options:
- `writeStemWavs`: Export individual layer files for analysis
- `logSchedule`: Console output of synthesis events and timing

This technical reference provides the exact JSON structure and implementation details needed to work with the WAV Sound Player system.