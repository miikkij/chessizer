# soundAGENTS_wave.md

Configuration system and offline rendering for chess soundscapes as standard WAV files

Status
Stable draft for implementation

Author
Valto assistant

Date
2025 09 14

## 1 Purpose

Create a second generator that renders complete soundscapes to WAV so the audio can play in any player without an engine. The generator reads JSON, builds a layered scene, and writes one stereo WAV per board state or per move sequence. This supports batch rendering, archiving, and sharing.

## 2 Concept overview

The offline renderer builds a mix from five layers. Each layer is optional and controlled by JSON.

1. Groove layer
   A repeatable rhythm that provides a pleasant base. The groove is built from Euclidean patterns and short percussive voices. The groove repeats across ticks and gives a stable frame. Evidence shows maximally even rhythms are natural to parse. 

2. Pulse grid
   One pulse per board cell inside the current traversal tick. Pulses encode piece type and color with short motifs. The grid supports onset offsets to keep separation clear.

3. Halo field
   A spatial and spectral bloom around important cells. The bloom is produced by a kernel that spreads influence to neighbouring cells. This can represent control or threat. The kernel is configurable.

4. Event cues
   Short high priority icons for captures and checks, with side specific timbre and pan. These sit above the groove and grid.

5. Ambient bed
   A low level drone that encodes slow metrics such as material balance and king safety by spectral brightness and chord choice.

The scene plays like a two to five second loop. When the board changes you reuse the loop but apply controlled variations so the change is obvious but still musical. Variations include fill ins, register shifts, and brightness lifts.

## 3 JSON configuration schema

Top level

```json
{
  "version": "1.0",
  "name": "waveGrooveSpiral",
  "audio": {},
  "limits": {},
  "groove": {},
  "pulseGrid": {},
  "halo": {},
  "events": {},
  "ambient": {},
  "traversal": {},
  "changeRules": {},
  "diagnostics": {}
}
```

### 3.1 Audio

```json
{
  "audio": {
    "sampleRate": 48000,
    "bitDepth": 16,
    "channels": 2,
    "lengthMs": 3000,
    "headroomDb": 6
  }
}
```

### 3.2 Limits

```json
{
  "limits": {
    "maxConcurrentVoices": 4,
    "onsetOffsetMs": [20, 50]
  }
}
```

### 3.3 Groove layer

A drum like base made of Euclidean patterns. Each track defines steps per bar and active beats. The kit contains synthetic voices created at render time. 

```json
{
  "groove": {
    "tempoBpm": 120,
    "bars": 2,
    "kit": {
      "kick": {"type": "sineClick", "toneHz": 60, "decayMs": 180, "pan": 0.0, "gainDb": -6},
      "snare": {"type": "noiseSnap", "toneHz": 180, "decayMs": 140, "pan": 0.0, "gainDb": -9},
      "hat": {"type": "noiseTick", "toneHz": 8000, "decayMs": 30, "pan": 0.0, "gainDb": -12}
    },
    "tracks": [
      {"voice": "kick",  "steps": 16, "pulses": 4, "rotate": 0},
      {"voice": "snare", "steps": 16, "pulses": 3, "rotate": 2},
      {"voice": "hat",   "steps": 16, "pulses": 9, "rotate": 0}
    ]
  }
}
```

### 3.4 Pulse grid

Short motifs per piece. Register encodes side. Each motif is a local event that lands inside the current tick. Multiple pulses in a tick are staggered by onset offsets.

```json
{
  "pulseGrid": {
    "earcons": {
      "pawn":   {"osc": "triangle", "env": {"a": 5, "d": 60, "s": 0.2, "r": 80},  "pattern": [{"t": 0, "semitone": 0, "durMs": 120}, {"t": 140, "semitone": 2, "durMs": 100}]},
      "knight": {"osc": "square",   "env": {"a": 5, "d": 80, "s": 0.2, "r": 120}, "pattern": [{"t": 0, "semitone": 0, "durMs": 90}, {"t": 120, "semitone": 3, "durMs": 90}, {"t": 240, "semitone": -1, "durMs": 90}]},
      "bishop": {"osc": "sine",     "env": {"a": 5, "d": 120,"s": 0.2, "r": 120}, "pattern": [{"t": 0, "semitone": 0, "durMs": 160}, {"t": 180, "semitone": 2, "durMs": 140}]},
      "rook":   {"osc": "saw",      "env": {"a": 5, "d": 100,"s": 0.2, "r": 140}, "chord":  [0, 7, 12], "durMs": 120},
      "queen":  {"osc": "saw",      "env": {"a": 5, "d": 120,"s": 0.2, "r": 180}, "arp":    [0, 4, 7, 12], "stepMs": 40, "durMs": 220},
      "king":   {"osc": "sine",     "env": {"a": 5, "d": 140,"s": 0.2, "r": 200}, "dyad":   [0, 7], "durMs": 180}
    },
    "register": {"white": "C5", "black": "C3"},
    "pan": {"white": -0.3, "black": 0.3},
    "gainDb": {"white": -10, "black": -10}
  }
}
```

### 3.5 Halo field

A convolution kernel that spreads presence or threat to neighbours. The halo modulates brightness and stereo width for pulses in affected cells.

```json
{
  "halo": {
    "mode": "threat",
    "kernel": [[0.25, 0.5, 0.25], [0.5, 1.0, 0.5], [0.25, 0.5, 0.25]],
    "brightnessHz": {"min": 800, "max": 4000},
    "width": {"min": 0.0, "max": 0.5}
  }
}
```

### 3.6 Event cues

```json
{
  "events": {
    "capture": {"type": "click", "durMs": 90, "leadMs": 30, "gainDb": -4, "panBySide": {"white": -0.3, "black": 0.3}},
    "check":   {"type": "glide", "fromHzWhite": 1100, "toHzWhite": 1800, "fromHzBlack": 400, "toHzBlack": 260, "durMs": 200, "gainDb": -6}
  }
}
```

### 3.7 Ambient bed

```json
{
  "ambient": {
    "mode": "triad",
    "root": "C2",
    "qualityByMaterial": {"white": "major", "black": "minor"},
    "brightnessHz": {"white": 1200, "black": 800},
    "gainDb": -20
  }
}
```

### 3.8 Traversal

```json
{
  "traversal": {
    "strategy": "spiralFromCenter",
    "params": {"center": ["d4", "e4", "d5", "e5"], "orientation": "cw"},
    "tickDurationMs": 300
  }
}
```

### 3.9 Change rules across moves

Rules that alter the groove or layer mix when the board changes so the listener notices the change without a jolt.

```json
{
  "changeRules": {
    "onMaterialSwing": {"points": 1, "action": "addHatFill"},
    "onCheck": {"action": "raiseBrightness", "amount": 0.2},
    "onCapture": {"action": "kickFill"},
    "onQuiet": {"action": "reduceHalo", "amount": 0.2}
  }
}
```

### 3.10 Diagnostics

```json
{
  "diagnostics": {"writeStemWavs": false, "logSchedule": true}
}
```

## 4 Execution order

1. Parse board from FEN or use a structure that lists pieces by cell.
2. Compute features for each cell. Include side, piece type, and a binary threat flag. Threat can be computed from attack maps.
3. Convolve the threat map with the halo kernel to get the halo field.
4. Build the groove for the full clip length.
5. For each traversal tick do
   - Pick cells to render
   - Select up to the max voice count by priority
   - Stagger onsets by the configured offset range
   - Render earcons for the selected cells with pan and brightness that depend on side and halo
   - Render any capture and check icons with the configured lead
6. Mix layers with headroom and write the WAV.

## 5 Reference Python implementation

The code below renders a short stereo WAV with the layers above. It uses only NumPy and the standard wave module. Replace the mock board with your data.

```python
import numpy as np
import math
import wave
from typing import Dict, Tuple, List

SR = 48000

def db_to_lin(db):
    return 10 ** (db / 20.0)

def note_to_hz(note):
    # Supports simple names like C3 C#4 D5
    names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
    n = names.index(note[:-1])
    octave = int(note[-1])
    midi = 12*(octave+1)+n
    return 440.0 * (2 ** ((midi-69)/12))

def env_adsr(total_ms, a=5, d=80, s=0.2, r=120):
    t = total_ms / 1000.0
    N = int(t*SR)
    env = np.zeros(N, dtype=np.float32)
    aN = int(a/1000*SR)
    dN = int(d/1000*SR)
    rN = int(r/1000*SR)
    sN = max(0, N - aN - dN - rN)
    i = 0
    if aN>0:
        env[:aN] = np.linspace(0,1,aN,False)
        i += aN
    if dN>0:
        env[i:i+dN] = np.linspace(1,s,dN,False)
        i += dN
    if sN>0:
        env[i:i+sN] = s
        i += sN
    if rN>0:
        env[i:i+rN] = np.linspace(s,0,max(1,rN),False)[:rN]
    return env

def osc(kind, hz, dur_ms, brightness=0.0):
    t = np.arange(int(dur_ms/1000*SR))/SR
    if kind == "sine":
        w = np.sin(2*np.pi*hz*t)
    elif kind == "triangle":
        w = 2*np.arcsin(np.sin(2*np.pi*hz*t))/np.pi
    elif kind == "square":
        w = np.sign(np.sin(2*np.pi*hz*t))
    elif kind == "saw":
        w = 2*(t*hz - np.floor(0.5 + t*hz))
    elif kind == "noise":
        w = np.random.uniform(-1,1,len(t))
    else:
        w = np.sin(2*np.pi*hz*t)
    # brightness as simple high shelf
    if brightness>0:
        alpha = min(0.99, brightness)
        w = (1-alpha)*w + alpha*np.append([0], np.diff(w))
    return w.astype(np.float32)

def pan_stereo(x, pan):
    # pan in [-1,1]
    l = math.cos((pan+1)*math.pi/4)
    r = math.sin((pan+1)*math.pi/4)
    return np.stack([x*l, x*r], axis=1)

def place(buf, start_sample, x):
    end = start_sample + x.shape[0]
    if end>buf.shape[0]:
        end = buf.shape[0]
        x = x[:end-start_sample]
    buf[start_sample:end,:] += x

def write_wav(path, data, sr=48000):
    # clip to [-1,1]
    y = np.clip(data, -1.0, 1.0)
    # 16 bit PCM
    y16 = (y * 32767.0).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(y16.tobytes())

def euclidean_pattern(steps, pulses, rotate=0):
    # Bjorklund algorithm
    if pulses==0:
        pat = [0]*steps
    elif pulses>=steps:
        pat = [1]*steps
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
                res += build(level-1)
            if remainders[level] != 0:
                res += build(level-2)
            return res
        pat = build(level)
        while len(pat) < steps:
            pat += build(level-1)
        pat = pat[:steps]
    if rotate:
        rotate = rotate % steps
        pat = pat[-rotate:] + pat[:-rotate]
    return pat
```

## 6 Demo recipe

The demo below creates a six second stereo WAV that mixes a gentle groove, a pulse grid for a few mock pieces, a halo field that widens and brightens near occupied cells, and two event cues. Replace the mock board with your data and drive the traversal from your move list.

```python
import numpy as np

SR = 48000
length_ms = 6000  # 6 seconds
N = int(SR*length_ms/1000)
stereo = np.zeros((N,2), dtype=np.float32)

tempo = 120
beat_dur = 60.0/tempo
bar_beats = 4
bars = 2
total_beats = bar_beats*bars
bar_len_s = beat_dur*bar_beats
loop_len_s = beat_dur*total_beats

# Groove layer
kit = {
    "kick": {"type": "sineClick", "hz": 60, "decay": 180, "gain": db_to_lin(-6), "pan": 0.0},
    "snare": {"type": "noiseSnap", "hz": 180, "decay": 140, "gain": db_to_lin(-9), "pan": 0.0},
    "hat": {"type": "noiseTick", "hz": 8000, "decay": 30, "gain": db_to_lin(-12), "pan": 0.0},
}

tracks = [
    {"voice": "kick", "steps": 16, "pulses": 4, "rotate": 0},
    {"voice": "snare","steps": 16, "pulses": 3, "rotate": 2},
    {"voice": "hat",  "steps": 16, "pulses": 9, "rotate": 0},
]

for t in tracks:
    pat = euclidean_pattern(t["steps"], t["pulses"], t["rotate"])
    step_s = loop_len_s / t["steps"]
    v = kit[t["voice"]]
    wave_cache = drum_voice(v["type"], v["hz"], v["decay"])
    w = pan_stereo(wave_cache * v["gain"], v["pan"])
    start_times = [i*step_s for i,hit in enumerate(pat) if hit==1]
    t0 = 0.0
    while t0 < length_ms/1000:
        for st in start_times:
            pos = int((t0+st)*SR)
            place(stereo, pos, w)
        t0 += loop_len_s

# Mock board 8x8
board = np.zeros((8,8), dtype=np.int8)
board[4,4] = 2   # white queen at e4
board[6,3] = 1   # white pawn
board[2,5] = -5  # black rook
board[5,5] = -1  # black pawn

kernel = np.array([[0.25,0.5,0.25],[0.5,1.0,0.5],[0.25,0.5,0.25]], dtype=np.float32)

def convolve2d(mat, k):
    h,w = mat.shape
    kh,kw = k.shape
    ph, pw = kh//2, kw//2
    out = np.zeros_like(mat, dtype=np.float32)
    for y in range(h):
        for x in range(w):
            s = 0.0
            for ky in range(kh):
                for kx in range(kw):
                    yy = min(h-1,max(0,y+ky-ph))
                    xx = min(w-1,max(0,x+kx-pw))
                    s += mat[yy,xx]*k[ky,kx]
            out[y,x] = s
    return out

presence = (board != 0).astype(np.float32)
halo = convolve2d(presence, kernel)
halo = (halo - halo.min()) / max(1e-6, (halo.max()-halo.min()+1e-6))

def semitone_to_freq(base_hz, semi):
    return base_hz * (2 ** (semi/12.0))

def earcon_piece(code):
    if code == 1:
        return [("triangle", 0, 120, (5,60,0.2,80)) , ("triangle", 2, 100, (5,60,0.2,80))]
    if code == 2:
        return [("saw", 0, 220, (5,120,0.2,180), "arp", [0,4,7,12])]
    if code == 5 or code == -5:
        return [("saw", 0, 120, (5,100,0.2,140), "chord", [0,7,12])]
    if code == -1:
        return [("triangle", 0, 120, (5,60,0.2,80)) , ("triangle", 2, 100, (5,60,0.2,80))]
    return []

register_white = note_to_hz("C5")
register_black = note_to_hz("C3")

# Build spiral order
order = []
centers = [(3,3),(4,3),(3,4),(4,4)]
seen = set(centers)
order.extend(centers)
layers = 1
while len(order) < 64:
    added = []
    for y in range(8):
        for x in range(8):
            if (y,x) in seen: 
                continue
            for cy,cx in centers:
                if max(abs(y-cy), abs(x-cx)) == layers:
                    added.append((y,x))
                    seen.add((y,x))
                    break
    order.extend(added)
    layers += 1

tick_ms = 300
onset_min, onset_max = 20, 50
ticks = int((length_ms) / tick_ms)

for ti in range(ticks):
    start_ms = ti*tick_ms
    cells_in_tick = order[(ti*4)%64:((ti*4)%64)+4]
    for idx,(y,x) in enumerate(cells_in_tick):
        code = int(board[y,x])
        if code == 0:
            continue
        h = halo[y,x]
        color = "white" if code>0 else "black"
        base = register_white if color=="white" else register_black
        pan = -0.3 if color=="white" else 0.3
        brightness = 0.1 + 0.8*h
        jitter = np.random.uniform(onset_min, onset_max)
        t_ms = start_ms + jitter
        pos = int(t_ms/1000*SR)
        motif = earcon_piece(code)
        if not motif:
            continue
        for step in motif:
            kind = step[0]
            semi = step[1]
            dur = step[2]
            a,d,s,r = step[3]
            hz = semitone_to_freq(base, semi)
            xw = osc(kind, hz, dur, brightness=brightness)
            env = env_adsr(dur, a=a, d=d, s=s, r=r)
            wav = xw*env*db_to_lin(-10)
            place(stereo, pos, pan_stereo(wav, pan))

# Event cues
def click_icon(duration_ms=90, gain_db=-4, pan=0.0):
    x = osc("noise", 8000, duration_ms)
    e = env_adsr(duration_ms, a=1, d=duration_ms-1, s=0.0, r=1)
    wv = x*e*db_to_lin(gain_db)
    return pan_stereo(wv, pan)

def glide_icon(from_hz, to_hz, dur_ms, gain_db=-6, pan=0.0):
    N = int(dur_ms/1000*SR)
    t = np.linspace(0,1,N,False)
    hz = from_hz*(to_hz/from_hz)**t
    phase = np.cumsum(2*np.pi*hz/SR).astype(np.float32)
    w = np.sin(phase)
    e = env_adsr(dur_ms, a=5, d=dur_ms-5, s=0.0, r=1)
    wv = w*e*db_to_lin(gain_db)
    return pan_stereo(wv, pan)

place(stereo, int(2.0*SR), click_icon(90, -4, -0.3))
place(stereo, int(3.5*SR), glide_icon(1100, 1800, 200, -6, -0.3))

peak = np.max(np.abs(stereo))
if peak>0:
    stereo *= 0.9/peak

write_wav("out.wav", stereo, SR)
```

## 7 Notes for production

1. Use python chess to compute attack maps and checks. Fall back to simple neighbour kernels only for demos.
2. Keep the mix at least six decibels below full scale before limiting.
3. Store stems when you need to debug a layer.
4. Batch render full games by updating the board per move and reusing the groove with light variation.
5. For stereo playback on headphones prefer modest pan values so the image feels stable.

## 8 References that informed this design

1. The vOICe maps images to sound using time for the horizontal axis and frequency for the vertical axis. This supports mental mapping by scan. 
2. Earcons and auditory icons improve speed of recognition when designed with rhythm, register, and timbre differences. 
3. Euclidean rhythms are maximally even and widely used as stable ostinatos, which helps build pleasant and distinct grooves. 
4. Auditory scene analysis explains stream segregation by onset asynchrony and spectral separation. 

Use these principles to keep the scene clear and informative.
