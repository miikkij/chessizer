#!/usr/bin/env python3
"""
Chess Sound WAV Generator Microservice

Based on soundAGENTS_wavev2.md specifications:
- Generates layered soundscapes as stereo WAV files
- Accepts FEN chess positions and JSON sound configurations
- Renders 5 layers: groove, pulse grid, halo field, event cues, ambient bed
- Uses Euclidean rhythms and spatial audio processing
"""

import numpy as np
import math
import wave
from typing import Dict, Tuple, List, Optional, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import chess
import chess.engine
from io import BytesIO
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Chess Sound WAV Generator", 
    description="Generates stereo WAV soundscapes from chess positions",
    version="1.0.0"
)

# Add CORS middleware to allow requests from the React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Default React dev server
        "http://localhost:5173",   # Vite default port
        "http://localhost:12173",  # Custom Vite port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173", 
        "http://127.0.0.1:12173",
        "http://localhost:8080",   # Docker container
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Audio constants
SR = 48000  # Sample rate
MAX_AMPLITUDE = 0.9  # Headroom for limiting

class AudioConfig(BaseModel):
    sampleRate: int = Field(default=48000, ge=22050, le=96000)
    bitDepth: int = Field(default=16, description="Bit depth (16 or 24)")
    channels: int = Field(default=2, description="Number of channels (1 or 2)")
    lengthMs: int = Field(default=3000, ge=1000, le=10000)
    headroomDb: float = Field(default=6.0, ge=0, le=12)

class LimitsConfig(BaseModel):
    maxConcurrentVoices: int = Field(default=4, ge=1, le=16)
    onsetOffsetMs: List[float] = Field(default=[20.0, 50.0])

class KitVoice(BaseModel):
    type: str = Field(description="Voice type: sineClick, noiseSnap, noiseTick")
    toneHz: float = Field(description="Base frequency")
    decayMs: float = Field(description="Decay time")
    pan: float = Field(default=0.0, ge=-1.0, le=1.0)
    gainDb: float = Field(default=-6.0, ge=-60.0, le=6.0)

class GrooveTrack(BaseModel):
    voice: str = Field(description="Kit voice name")
    steps: int = Field(description="Steps per pattern")
    pulses: int = Field(description="Active beats in pattern")
    rotate: int = Field(default=0, description="Pattern rotation")

class GrooveConfig(BaseModel):
    tempoBpm: float = Field(default=120.0, ge=60.0, le=200.0)
    bars: int = Field(default=2, ge=1, le=8)
    kit: Dict[str, KitVoice]
    tracks: List[GrooveTrack]

class EnvelopeConfig(BaseModel):
    a: float = Field(default=5.0, description="Attack ms")
    d: float = Field(default=60.0, description="Decay ms")  
    s: float = Field(default=0.2, description="Sustain level")
    r: float = Field(default=80.0, description="Release ms")

class PatternStep(BaseModel):
    t: float = Field(description="Time offset in ms")
    semitone: int = Field(description="Semitone offset")
    durMs: float = Field(description="Duration in ms")

class EarconConfig(BaseModel):
    osc: str = Field(description="Oscillator type")
    env: EnvelopeConfig
    pattern: Optional[List[PatternStep]] = None
    chord: Optional[List[int]] = None
    arp: Optional[List[int]] = None
    dyad: Optional[List[int]] = None
    stepMs: Optional[float] = None
    durMs: float = Field(description="Total duration")

class PulseGridConfig(BaseModel):
    earcons: Dict[str, EarconConfig]
    register: Dict[str, str] = Field(default={"white": "C5", "black": "C3"})
    pan: Dict[str, float] = Field(default={"white": -0.3, "black": 0.3})
    gainDb: Dict[str, float] = Field(default={"white": -10, "black": -10})

class HaloConfig(BaseModel):
    mode: str = Field(default="threat")
    kernel: List[List[float]] = Field(default=[[0.25, 0.5, 0.25], [0.5, 1.0, 0.5], [0.25, 0.5, 0.25]])
    brightnessHz: Dict[str, float] = Field(default={"min": 800, "max": 4000})
    width: Dict[str, float] = Field(default={"min": 0.0, "max": 0.5})

class EventCueConfig(BaseModel):
    type: str
    durMs: float = Field(default=90.0)
    leadMs: Optional[float] = None
    gainDb: float = Field(default=-4.0)
    panBySide: Optional[Dict[str, float]] = None
    fromHzWhite: Optional[float] = None
    toHzWhite: Optional[float] = None  
    fromHzBlack: Optional[float] = None
    toHzBlack: Optional[float] = None

class EventsConfig(BaseModel):
    capture: EventCueConfig
    check: EventCueConfig

class AmbientConfig(BaseModel):
    mode: str = Field(default="triad")
    root: str = Field(default="C2")
    qualityByMaterial: Dict[str, str] = Field(default={"white": "major", "black": "minor"})
    brightnessHz: Dict[str, float] = Field(default={"white": 1200, "black": 800})
    gainDb: float = Field(default=-20.0)

class TraversalConfig(BaseModel):
    strategy: str = Field(default="spiralFromCenter")
    params: Dict[str, Any] = Field(default={"center": ["d4", "e4", "d5", "e5"], "orientation": "cw"})
    tickDurationMs: float = Field(default=300.0)

class ChangeRulesConfig(BaseModel):
    onMaterialSwing: Optional[Dict[str, Any]] = None
    onCheck: Optional[Dict[str, Any]] = None
    onCapture: Optional[Dict[str, Any]] = None
    onQuiet: Optional[Dict[str, Any]] = None

class DiagnosticsConfig(BaseModel):
    writeStemWavs: bool = Field(default=False)
    logSchedule: bool = Field(default=True)

class WavSoundConfig(BaseModel):
    version: str = Field(default="1.0")
    name: str
    audio: AudioConfig = Field(default_factory=AudioConfig)
    limits: LimitsConfig = Field(default_factory=LimitsConfig)
    groove: GrooveConfig
    pulseGrid: PulseGridConfig
    halo: HaloConfig = Field(default_factory=HaloConfig)
    events: EventsConfig
    ambient: AmbientConfig = Field(default_factory=AmbientConfig)
    traversal: TraversalConfig = Field(default_factory=TraversalConfig)
    changeRules: ChangeRulesConfig = Field(default_factory=ChangeRulesConfig)
    diagnostics: DiagnosticsConfig = Field(default_factory=DiagnosticsConfig)

class GenerateRequest(BaseModel):
    fen: str = Field(description="Chess position in FEN notation")
    config: WavSoundConfig
    previousFen: Optional[str] = Field(None, description="Previous position for change detection")

# === Sound Synthesis Functions ===

def db_to_lin(db: float) -> float:
    """Convert decibels to linear amplitude"""
    return 10 ** (db / 20.0)

def note_to_hz(note: str) -> float:
    """Convert note name like 'C4' to frequency in Hz"""
    names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
    if len(note) < 2:
        raise ValueError(f"Invalid note format: {note}")
    
    name = note[:-1]
    octave_str = note[-1]
    
    if name not in names:
        raise ValueError(f"Unknown note name: {name}")
    
    try:
        octave = int(octave_str)
    except ValueError:
        raise ValueError(f"Invalid octave: {octave_str}")
    
    n = names.index(name)
    midi = 12 * (octave + 1) + n
    return 440.0 * (2 ** ((midi - 69) / 12))

def env_adsr(total_ms: float, a: float = 5, d: float = 80, s: float = 0.2, r: float = 120) -> np.ndarray:
    """Generate ADSR envelope"""
    t = total_ms / 1000.0
    N = int(t * SR)
    if N <= 0:
        return np.array([])
    
    env = np.zeros(N, dtype=np.float32)
    aN = int(a / 1000 * SR)
    dN = int(d / 1000 * SR)
    rN = int(r / 1000 * SR)
    sN = max(0, N - aN - dN - rN)
    
    i = 0
    if aN > 0 and i < N:
        end_i = min(i + aN, N)
        env[i:end_i] = np.linspace(0, 1, end_i - i, False)
        i = end_i
    if dN > 0 and i < N:
        end_i = min(i + dN, N)
        env[i:end_i] = np.linspace(1, s, end_i - i, False)
        i = end_i
    if sN > 0 and i < N:
        end_i = min(i + sN, N)
        env[i:end_i] = s
        i = end_i
    if rN > 0 and i < N:
        end_i = min(i + rN, N)
        if end_i > i:
            env[i:end_i] = np.linspace(s, 0, end_i - i, False)
    
    return env

def osc(kind: str, hz: float, dur_ms: float, brightness: float = 0.0) -> np.ndarray:
    """Generate oscillator waveform"""
    t = np.arange(int(dur_ms / 1000 * SR)) / SR
    if len(t) == 0:
        return np.array([], dtype=np.float32)
    
    if kind == "sine":
        w = np.sin(2 * np.pi * hz * t)
    elif kind == "triangle":
        w = 2 * np.arcsin(np.sin(2 * np.pi * hz * t)) / np.pi
    elif kind == "square":
        w = np.sign(np.sin(2 * np.pi * hz * t))
    elif kind == "saw":
        w = 2 * (t * hz - np.floor(0.5 + t * hz))
    elif kind == "noise":
        w = np.random.uniform(-1, 1, len(t))
    else:
        w = np.sin(2 * np.pi * hz * t)
    
    # Brightness as simple high shelf
    if brightness > 0:
        alpha = min(0.99, brightness)
        diff = np.append([0], np.diff(w))
        w = (1 - alpha) * w + alpha * diff
    
    return w.astype(np.float32)

def pan_stereo(x: np.ndarray, pan: float) -> np.ndarray:
    """Apply stereo panning. pan in [-1,1]"""
    if len(x) == 0:
        return np.zeros((0, 2), dtype=np.float32)
    l = math.cos((pan + 1) * math.pi / 4)
    r = math.sin((pan + 1) * math.pi / 4)
    return np.stack([x * l, x * r], axis=1)

def place(buf: np.ndarray, start_sample: int, x: np.ndarray):
    """Mix audio into buffer at specified position"""
    if len(x) == 0 or start_sample >= buf.shape[0] or start_sample < 0:
        return
    
    end = start_sample + x.shape[0]
    if end > buf.shape[0]:
        end = buf.shape[0]
        x = x[:end - start_sample]
    
    if x.ndim == 1:
        x = pan_stereo(x, 0.0)  # Convert mono to stereo
    
    buf[start_sample:end] += x

def euclidean_pattern(steps: int, pulses: int, rotate: int = 0) -> List[int]:
    """Generate Euclidean rhythm pattern using Bjorklund algorithm"""
    if pulses == 0:
        pat = [0] * steps
    elif pulses >= steps:
        pat = [1] * steps
    else:
        counts = []
        remainders = []
        divisor = steps - pulses
        remainders.append(pulses)
        level = 0
        
        while True:
            counts.append(divisor // remainders[level])
            remainders.append(divisor % remainders[level])
            divisor = remainders[level]
            level += 1
            if remainders[level] <= 1:
                break
        counts.append(divisor)
        
        def build(level):
            if level == -1:
                return [0]
            if level == -2:
                return [1]
            res = []
            for i in range(counts[level]):
                res += build(level - 1)
            if remainders[level] != 0:
                res += build(level - 2)
            return res
        
        pat = build(level)
        while len(pat) < steps:
            pat += build(level - 1) if level > 0 else [0]
        pat = pat[:steps]
    
    if rotate:
        rotate = rotate % steps
        pat = pat[-rotate:] + pat[:-rotate]
    
    return pat

def convolve2d(mat: np.ndarray, k: np.ndarray) -> np.ndarray:
    """2D convolution for halo field computation"""
    h, w = mat.shape
    kh, kw = k.shape
    ph, pw = kh // 2, kw // 2
    out = np.zeros_like(mat, dtype=np.float32)
    
    for y in range(h):
        for x in range(w):
            s = 0.0
            for ky in range(kh):
                for kx in range(kw):
                    yy = min(h - 1, max(0, y + ky - ph))
                    xx = min(w - 1, max(0, x + kx - pw))
                    s += mat[yy, xx] * k[ky, kx]
            out[y, x] = s
    
    return out

def semitone_to_freq(base_hz: float, semi: int) -> float:
    """Convert semitone offset to frequency"""
    return base_hz * (2 ** (semi / 12.0))

def drum_voice(voice_type: str, hz: float, decay_ms: float) -> np.ndarray:
    """Generate drum voice waveform"""
    if voice_type == "sineClick":
        w = osc("sine", hz, decay_ms)
        env = env_adsr(decay_ms, a=1, d=decay_ms - 1, s=0.0, r=1)
    elif voice_type == "noiseSnap":
        w = osc("noise", hz, decay_ms)
        env = env_adsr(decay_ms, a=5, d=decay_ms * 0.3, s=0.1, r=decay_ms * 0.7)
    elif voice_type == "noiseTick":
        w = osc("noise", hz, decay_ms)
        env = env_adsr(decay_ms, a=1, d=decay_ms - 1, s=0.0, r=1)
    else:
        w = osc("sine", hz, decay_ms)
        env = env_adsr(decay_ms, a=5, d=decay_ms * 0.8, s=0.0, r=decay_ms * 0.2)
    
    return w * env

def write_wav_bytes(data: np.ndarray, sr: int = 48000, bit_depth: int = 16) -> bytes:
    """Write numpy array to WAV bytes"""
    # Clip to prevent distortion
    y = np.clip(data, -1.0, 1.0)
    
    # Convert to integer format
    if bit_depth == 16:
        y16 = (y * 32767.0).astype(np.int16)
        sample_width = 2
    else:  # 24-bit
        y24 = (y * 8388607.0).astype(np.int32)
        # Pack 24-bit samples
        y24_bytes = []
        for sample in y24.flatten():
            # Convert to 3-byte little-endian
            y24_bytes.extend([
                sample & 0xFF,
                (sample >> 8) & 0xFF, 
                (sample >> 16) & 0xFF
            ])
        y16 = np.array(y24_bytes, dtype=np.uint8)
        sample_width = 3
    
    # Create WAV in memory
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(data.shape[1] if data.ndim > 1 else 1)
        wf.setsampwidth(sample_width)
        wf.setframerate(sr)
        if bit_depth == 16:
            wf.writeframes(y16.tobytes())
        else:
            wf.writeframes(bytes(y16))
    
    return buf.getvalue()

# === Chess Analysis Functions ===

def fen_to_board_matrix(fen: str) -> np.ndarray:
    """Convert FEN to 8x8 numpy array with piece codes"""
    try:
        board = chess.Board(fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {e}")
    
    matrix = np.zeros((8, 8), dtype=np.int8)
    
    piece_values = {
        chess.PAWN: 1, chess.KNIGHT: 2, chess.BISHOP: 3,
        chess.ROOK: 4, chess.QUEEN: 5, chess.KING: 6
    }
    
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            row = 7 - (square // 8)  # Convert to array indexing
            col = square % 8
            value = piece_values[piece.piece_type]
            if not piece.color:  # Black pieces negative
                value = -value
            matrix[row, col] = value
    
    return matrix

def analyze_position(fen: str) -> Dict[str, Any]:
    """Analyze chess position for sound generation"""
    try:
        board = chess.Board(fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {e}")
    
    # Compute metrics
    legal_moves = list(board.legal_moves)
    captures = [m for m in legal_moves if board.is_capture(m)]
    
    # Center control (e4, d4, e5, d5)
    center_squares = [chess.E4, chess.D4, chess.E5, chess.D5]
    center_control = sum(1 for sq in center_squares 
                        if board.is_attacked_by(chess.WHITE, sq) or 
                           board.is_attacked_by(chess.BLACK, sq))
    
    # Material count
    material = {"white": 0, "black": 0}
    piece_values = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, 
                   chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
    
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            value = piece_values[piece.piece_type]
            if piece.color:
                material["white"] += value
            else:
                material["black"] += value
    
    return {
        "in_check": board.is_check(),
        "legal_moves": len(legal_moves),
        "captures_available": len(captures),
        "center_control": center_control,
        "material": material,
        "material_balance": material["white"] - material["black"],
        "turn": "white" if board.turn else "black"
    }

def get_spiral_traversal_order() -> List[Tuple[int, int]]:
    """Generate spiral traversal order from center"""
    order = []
    centers = [(3, 3), (4, 3), (3, 4), (4, 4)]  # d4, e4, d5, e5
    seen = set(centers)
    order.extend(centers)
    
    layers = 1
    while len(order) < 64:
        added = []
        for y in range(8):
            for x in range(8):
                if (y, x) in seen:
                    continue
                for cy, cx in centers:
                    if max(abs(y - cy), abs(x - cx)) == layers:
                        added.append((y, x))
                        seen.add((y, x))
                        break
        order.extend(added)
        layers += 1
    
    return order

# === Main Sound Generation Function ===

def generate_chess_wav(request: GenerateRequest) -> bytes:
    """Generate WAV file from chess position and sound config"""
    try:
        config = request.config
        fen = request.fen
        
        # Initialize audio buffer
        length_ms = config.audio.lengthMs
        N = int(SR * length_ms / 1000)
        stereo = np.zeros((N, 2), dtype=np.float32)
        
        # Analyze position
        board_matrix = fen_to_board_matrix(fen)
        analysis = analyze_position(fen)
        
        if config.diagnostics.logSchedule:
            logger.info(f"Generating WAV for position: {analysis}")
        
        # === Layer 1: Groove ===
        tempo = config.groove.tempoBpm
        beat_dur = 60.0 / tempo
        bar_beats = 4
        bars = config.groove.bars
        total_beats = bar_beats * bars
        loop_len_s = beat_dur * total_beats
        
        # Build drum patterns
        for track in config.groove.tracks:
            if track.voice not in config.groove.kit:
                continue
                
            voice_config = config.groove.kit[track.voice]
            pattern = euclidean_pattern(track.steps, track.pulses, track.rotate)
            step_s = loop_len_s / track.steps
            
            # Generate drum voice
            voice_wave = drum_voice(
                voice_config.type, 
                voice_config.toneHz, 
                voice_config.decayMs
            )
            voice_stereo = pan_stereo(
                voice_wave * db_to_lin(voice_config.gainDb), 
                voice_config.pan
            )
            
            # Place hits in timeline
            start_times = [i * step_s for i, hit in enumerate(pattern) if hit == 1]
            t0 = 0.0
            while t0 < length_ms / 1000:
                for st in start_times:
                    pos = int((t0 + st) * SR)
                    place(stereo, pos, voice_stereo)
                t0 += loop_len_s
        
        # === Layer 2: Halo Field ===
        presence = (board_matrix != 0).astype(np.float32)
        kernel = np.array(config.halo.kernel, dtype=np.float32)
        halo = convolve2d(presence, kernel)
        
        # Normalize halo
        if halo.max() > halo.min():
            halo = (halo - halo.min()) / (halo.max() - halo.min())
        
        # === Layer 3: Pulse Grid ===
        traversal_order = get_spiral_traversal_order()
        tick_ms = config.traversal.tickDurationMs
        onset_min, onset_max = config.limits.onsetOffsetMs
        ticks = int(length_ms / tick_ms)
        
        for ti in range(ticks):
            start_ms = ti * tick_ms
            cells_per_tick = 4
            start_idx = (ti * cells_per_tick) % 64
            cells_in_tick = traversal_order[start_idx:start_idx + cells_per_tick]
            
            active_cells = []
            for y, x in cells_in_tick:
                piece_code = int(board_matrix[y, x])
                if piece_code != 0:
                    active_cells.append((y, x, piece_code))
            
            # Limit concurrent voices
            active_cells = active_cells[:config.limits.maxConcurrentVoices]
            
            for idx, (y, x, piece_code) in enumerate(active_cells):
                # Determine piece type and color
                piece_type = abs(piece_code)
                color = "white" if piece_code > 0 else "black"
                
                piece_names = {1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king"}
                piece_name = piece_names.get(piece_type, "pawn")
                
                if piece_name not in config.pulseGrid.earcons:
                    continue
                
                earcon = config.pulseGrid.earcons[piece_name]
                base_hz = note_to_hz(config.pulseGrid.register[color])
                pan = config.pulseGrid.pan[color]
                gain_db = config.pulseGrid.gainDb[color]
                halo_value = halo[y, x]
                brightness = 0.1 + 0.8 * halo_value
                
                # Onset timing
                jitter = np.random.uniform(onset_min, onset_max)
                t_ms = start_ms + jitter
                pos = int(t_ms / 1000 * SR)
                
                # Generate earcon
                if earcon.pattern:
                    # Pattern-based earcon
                    for step in earcon.pattern:
                        step_pos = pos + int(step.t / 1000 * SR)
                        hz = semitone_to_freq(base_hz, step.semitone)
                        wave = osc(earcon.osc, hz, step.durMs, brightness=brightness)
                        env = env_adsr(step.durMs, **earcon.env.dict())
                        final_wave = wave * env * db_to_lin(gain_db)
                        place(stereo, step_pos, pan_stereo(final_wave, pan))
                
                elif earcon.chord:
                    # Chord-based earcon
                    for semitone in earcon.chord:
                        hz = semitone_to_freq(base_hz, semitone)
                        wave = osc(earcon.osc, hz, earcon.durMs, brightness=brightness)
                        env = env_adsr(earcon.durMs, **earcon.env.dict())
                        final_wave = wave * env * db_to_lin(gain_db) / len(earcon.chord)
                        place(stereo, pos, pan_stereo(final_wave, pan))
                
                elif earcon.arp and earcon.stepMs:
                    # Arpeggio-based earcon
                    for i, semitone in enumerate(earcon.arp):
                        step_pos = pos + int(i * earcon.stepMs / 1000 * SR)
                        hz = semitone_to_freq(base_hz, semitone)
                        step_dur = earcon.stepMs * 1.5  # Overlap for smoother arp
                        wave = osc(earcon.osc, hz, step_dur, brightness=brightness)
                        env = env_adsr(step_dur, **earcon.env.dict())
                        final_wave = wave * env * db_to_lin(gain_db)
                        place(stereo, step_pos, pan_stereo(final_wave, pan))
        
        # === Layer 4: Event Cues ===
        # Add capture and check sounds if applicable
        if analysis["in_check"]:
            # Add check cue
            check_config = config.events.check
            if check_config.type == "glide":
                color = analysis["turn"]
                if color == "white" and check_config.fromHzWhite and check_config.toHzWhite:
                    from_hz = check_config.fromHzWhite
                    to_hz = check_config.toHzWhite
                elif color == "black" and check_config.fromHzBlack and check_config.toHzBlack:
                    from_hz = check_config.fromHzBlack
                    to_hz = check_config.toHzBlack
                else:
                    from_hz, to_hz = 800, 1200
                
                pos = int(1.5 * SR)  # Place at 1.5 seconds
                N_glide = int(check_config.durMs / 1000 * SR)
                t = np.linspace(0, 1, N_glide, False)
                hz = from_hz * (to_hz / from_hz) ** t
                phase = np.cumsum(2 * np.pi * hz / SR).astype(np.float32)
                wave = np.sin(phase)
                env = env_adsr(check_config.durMs, a=5, d=check_config.durMs-5, s=0.0, r=1)
                final_wave = wave * env * db_to_lin(check_config.gainDb)
                pan_val = check_config.panBySide.get(color, 0.0) if check_config.panBySide else 0.0
                place(stereo, pos, pan_stereo(final_wave, pan_val))
        
        # Simulate capture event at 2.5s for demo
        if analysis["captures_available"] > 0:
            capture_config = config.events.capture
            if capture_config.type == "click":
                pos = int(2.5 * SR)
                wave = osc("noise", 8000, capture_config.durMs)
                env = env_adsr(capture_config.durMs, a=1, d=capture_config.durMs-1, s=0.0, r=1)
                final_wave = wave * env * db_to_lin(capture_config.gainDb)
                pan_val = capture_config.panBySide.get("white", 0.0) if capture_config.panBySide else 0.0
                place(stereo, pos, pan_stereo(final_wave, pan_val))
        
        # === Layer 5: Ambient Bed ===
        # Simple ambient drone based on material balance
        ambient_config = config.ambient
        root_hz = note_to_hz(ambient_config.root)
        material_balance = analysis["material_balance"]
        
        # Choose chord quality based on material advantage
        if material_balance > 1:
            chord_semitones = [0, 4, 7]  # Major triad
        elif material_balance < -1:
            chord_semitones = [0, 3, 7]  # Minor triad
        else:
            chord_semitones = [0, 3, 6, 10]  # Diminished 7th
        
        for semitone in chord_semitones:
            hz = semitone_to_freq(root_hz, semitone)
            wave = osc("sine", hz, length_ms, brightness=0.0)
            env = np.ones_like(wave) * db_to_lin(ambient_config.gainDb) / len(chord_semitones)
            final_wave = wave * env
            place(stereo, 0, pan_stereo(final_wave, 0.0))
        
        # === Final Processing ===
        # Apply headroom and limiting
        headroom_factor = db_to_lin(-config.audio.headroomDb)
        peak = np.max(np.abs(stereo))
        if peak > 0:
            stereo *= min(headroom_factor, MAX_AMPLITUDE / peak)
        
        # Convert to bytes
        return write_wav_bytes(stereo, SR, config.audio.bitDepth)
        
    except Exception as e:
        logger.error(f"Error generating WAV: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating WAV: {str(e)}")

# === API Endpoints ===

@app.get("/", response_class=HTMLResponse)
async def root():
    """API documentation endpoint"""
    return """
    <html>
        <head><title>Chess Sound WAV Generator</title></head>
        <body>
            <h1>Chess Sound WAV Generator API</h1>
            <h2>Endpoints:</h2>
            <ul>
                <li><code>POST /generate</code> - Generate WAV from FEN + config</li>
                <li><code>GET /health</code> - Health check</li>
                <li><code>GET /docs</code> - OpenAPI documentation</li>
            </ul>
            <h2>Example Usage:</h2>
            <pre>
curl -X POST "http://localhost:8001/generate" \\
     -H "Content-Type: application/json" \\
     -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "config": {...}}' \\
     --output chess_sound.wav
            </pre>
        </body>
    </html>
    """

@app.post("/generate")
async def generate_wav(request: GenerateRequest):
    """Generate WAV file from chess position and sound configuration"""
    wav_bytes = generate_chess_wav(request)
    
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"attachment; filename=chess_sound_{hash(request.fen) % 10000:04d}.wav"
        }
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "chess-sound-wav-generator", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")