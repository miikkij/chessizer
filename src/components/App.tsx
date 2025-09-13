import { useState, useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import { generateTimeline, getStartPosition, decodeBoardString, type CompactBoardState, type Piece } from "../chess/compact";

// Simple Web Audio API based sound engine
class SimpleSoundEngine {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentBoard = '';
  private tickIntervalMs = 1000;

  async initialize() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  setBoardState(boardString: string) {
    this.currentBoard = boardString;
  }

  setTickInterval(intervalMs: number) {
    this.tickIntervalMs = intervalMs;
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    this.tickInterval = setInterval(() => {
      this.processTick();
    }, this.tickIntervalMs);

    console.log('Sound engine started');
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log('Sound engine stopped');
  }

  private processTick() {
    if (!this.currentBoard || !this.audioContext) return;

    try {
      const pieces = decodeBoardString(this.currentBoard);
      this.playPosition(pieces);
    } catch (error) {
      console.error('Error processing tick:', error);
    }
  }

  private playPosition(pieces: Piece[]) {
    if (!this.audioContext) return;

    // Map piece types to frequencies (simplified harmonic layers preset)
    const pitchMap = {
      'pawn': 261.63,    // C4
      'knight': 329.63,  // E4
      'bishop': 392.00,  // G4
      'rook': 440.00,    // A4
      'queen': 493.88,   // B4
      'king': 220.00     // A3
    };

    // Play up to 8 pieces simultaneously
    pieces.slice(0, 8).forEach((piece, index) => {
      const basePitch = pitchMap[piece.type];
      if (basePitch) {
        const octaveShift = piece.side === 'white' ? 1 : -1;
        const frequency = basePitch * Math.pow(2, octaveShift);

        setTimeout(() => {
          this.playTone(frequency, 0.4);
        }, index * 50);
      }
    });
  }

  private playTone(frequency: number, duration: number = 0.4) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  dispose() {
    this.stop();
  }
}

// Chess board component with Unicode pieces
function ChessBoard({ position }: { position: string }) {
  const pieces = useMemo(() => {
    // Ensure we have a valid position string
    if (!position || position.length !== 256) {
      console.warn('Invalid position string, using fallback');
      return Array(8).fill(null).map(() => Array(8).fill(''));
    }

    try {
      const board = [];

      // Decode 256-hex string: traverse a8 to h8, then a7 to h7, etc.
      for (let rank = 7; rank >= 0; rank--) {
        const row = [];
        for (let file = 0; file < 8; file++) {
          const squareIndex = ((7 - rank) * 8 + file) * 4; // 4 hex chars per square

          // Ensure we don't go out of bounds
          if (squareIndex + 2 > position.length) {
            row.push('');
            continue;
          }

          const pieceCode = parseInt(position.slice(squareIndex, squareIndex + 2), 16);

          let pieceSymbol = '';
          if (pieceCode !== 0 && !isNaN(pieceCode)) {
            const isWhite = (pieceCode & 0xF0) === 0x10;
            const pieceType = pieceCode & 0x0F;

            // Unicode chess pieces
            const blackPieces = ['', '♟', '♞', '♝', '♜', '♛', '♚'];
            const whitePieces = ['', '♙', '♘', '♗', '♖', '♕', '♔'];

            if (pieceType >= 1 && pieceType <= 6) {
              pieceSymbol = isWhite ? whitePieces[pieceType] : blackPieces[pieceType];
            }
          }

          row.push(pieceSymbol);
        }
        board.push(row);
      }
      return board;
    } catch (error) {
      console.error('Error decoding board:', error);
      return Array(8).fill(null).map(() => Array(8).fill(''));
    }
  }, [position]);

  return (
    <div className="inline-block border-4 border-gray-800">
      <div className="grid grid-cols-8">
        {pieces.map((row, rank) =>
          row?.map((piece, file) => (
            <div
              key={`${rank}-${file}`}
              className={`
                w-12 h-12 flex items-center justify-center text-2xl font-bold
                ${(rank + file) % 2 === 0 ? 'bg-amber-100' : 'bg-amber-700'}
              `}
            >
              {piece || ''}
            </div>
          )) || []
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [soundEngine] = useState(() => new SimpleSoundEngine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeline, setTimeline] = useState<CompactBoardState[]>([]);
  const [currentMove, setCurrentMove] = useState(0);
  const [tickInterval, setTickInterval] = useState(1000);
  const [selectedPreset, setSelectedPreset] = useState('harmonic_layers');

  // Initialize with starting position
  useEffect(() => {
    const startPosition = getStartPosition();
    setTimeline([{
      boardString: startPosition,
      sideToMove: 'w',
      castling: 'KQkq',
      enPassant: null,
      halfmove: 0,
      fullmove: 1
    }]);
  }, []);

  // Initialize sound engine
  useEffect(() => {
    soundEngine.initialize().catch(console.error);
    return () => soundEngine.dispose();
  }, [soundEngine]);

  // Update sound engine when board or tick interval changes
  useEffect(() => {
    const currentPosition = timeline[currentMove];
    if (currentPosition) {
      soundEngine.setBoardState(currentPosition.boardString);
    }
  }, [soundEngine, timeline, currentMove]);

  useEffect(() => {
    soundEngine.setTickInterval(tickInterval);
  }, [soundEngine, tickInterval]);

  const handlePlayPause = async () => {
    if (isPlaying) {
      soundEngine.stop();
      setIsPlaying(false);
    } else {
      await soundEngine.initialize();
      soundEngine.play();
      setIsPlaying(true);
    }
  };

  const handlePGNImport = () => {
    const pgn = prompt("Enter PGN game notation:");
    if (pgn && pgn.trim()) {
      try {
        const newTimeline = generateTimeline(pgn);
        if (newTimeline.length > 0) {
          setTimeline(newTimeline);
          setCurrentMove(0);
          console.log(`Loaded game with ${newTimeline.length} positions`);
        } else {
          alert("Failed to parse PGN. Please check the format.");
        }
      } catch (error) {
        console.error('PGN import error:', error);
        alert("Error importing PGN: " + (error as Error).message);
      }
    }
  };

  const handleLoadSampleGame = () => {
    // Famous game: Bobby Fischer vs. Donald Byrne (1956)
    const samplePGN = `[Event "Third Rosenwald Trophy"]
[Site "New York, NY USA"]
[Date "1956.10.17"]
[EventDate "1956.10.07"]
[Round "8"]
[Result "0-1"]
[White "Donald Byrne"]
[Black "Robert James Fischer"]

1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6 8.e4 Nbd7 9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5 Na4 12.Qa3 Nxc3 13.bxc3 Nxe4 14.Bxe7 Qb6 15.Bc4 Nxc3 16.Bc5 Rfe8+ 17.Kf1 Be6 18.Bxb6 Bxc4+ 19.Kg1 Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+ 22.Kf1 Nc3+ 23.Kg1 axb6 24.Qb4 Ra4 25.Qxb6 Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1 29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3 Ne4 32.Qb8 b5 33.h4 h6 34.Ne5 Kg7 35.Kg1 Bc5+ 36.Kf1 Ng3+ 37.Ke1 Bb4+ 38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2# 0-1`;

    const newTimeline = generateTimeline(samplePGN);
    if (newTimeline.length > 0) {
      setTimeline(newTimeline);
      setCurrentMove(0);
      console.log(`Loaded Fischer vs Byrne game with ${newTimeline.length} positions`);
    }
  };

  const handlePrevMove = () => {
    if (currentMove > 0) {
      setCurrentMove(currentMove - 1);
    }
  };

  const handleNextMove = () => {
    if (currentMove < timeline.length - 1) {
      setCurrentMove(currentMove + 1);
    }
  };

  const handleAutoPlay = () => {
    if (timeline.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentMove(prev => {
        if (prev >= timeline.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, tickInterval);
  };

  const currentPosition = timeline[currentMove];
  const pieces = currentPosition ? decodeBoardString(currentPosition.boardString) : [];
  const materialBalance = pieces
    .filter(piece => piece && piece.type && piece.side) // Filter out invalid pieces
    .reduce((balance, piece) => {
      const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
      const value = values[piece.type] || 0;
      return balance + (piece.side === 'white' ? value : -value);
    }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎵 Chessboard Sound Web App
          </h1>
          <p className="text-gray-600">
            Experience chess positions through harmonic sound visualization
          </p>
        </div>

        {/* Control Bar */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3 items-center">
              <Button onClick={handlePGNImport} className="bg-blue-600 hover:bg-blue-700">
                📁 Load PGN
              </Button>
              <Button onClick={handleLoadSampleGame} className="border">
                🎯 Load Sample Game
              </Button>
              <select
                className="px-3 py-2 border rounded-lg"
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
              >
                <option value="harmonic_layers">🎼 Harmonic Layers</option>
                <option value="rhythm_focus">🥁 Rhythm Focus</option>
                <option value="ambient_clouds">☁️ Ambient Clouds</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Tick: {tickInterval}ms</span>
                <input
                  type="range"
                  min="250"
                  max="3000"
                  step="250"
                  value={tickInterval}
                  onChange={(e) => setTickInterval(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <Button
                onClick={handlePlayPause}
                className={isPlaying ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              >
                {isPlaying ? "⏸️ Pause" : "▶️ Play"}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chess Board */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Chess Board</h2>
                <p className="text-gray-600">Move {currentMove} of {timeline.length - 1}</p>
              </div>

              <div className="flex justify-center mb-6">
                <ChessBoard position={currentPosition?.boardString || getStartPosition()} />
              </div>

              {/* Move Controls */}
              <div className="flex justify-center gap-3">
                <Button onClick={handlePrevMove} disabled={currentMove === 0} className="border">
                  ⏮️ Previous
                </Button>
                <Button onClick={handleAutoPlay} className="border">
                  ⏯️ Auto Play
                </Button>
                <Button onClick={handleNextMove} disabled={currentMove >= timeline.length - 1} className="border">
                  Next ⏭️
                </Button>
              </div>

              {/* Timeline */}
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: timeline.length > 1 ? `${(currentMove / (timeline.length - 1)) * 100}%` : '0%'
                    }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max={timeline.length - 1}
                  value={currentMove}
                  onChange={(e) => setCurrentMove(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="space-y-6">
            {/* Game Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800">📊 Game Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Moves:</span>
                  <span className="font-semibold">{timeline.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Move:</span>
                  <span className="font-semibold">{currentMove}</span>
                </div>
                <div className="flex justify-between">
                  <span>Side to Move:</span>
                  <span className="font-semibold">
                    {currentPosition?.sideToMove === 'w' ? 'White ⚪' : 'Black ⚫'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Material Balance:</span>
                  <span className={`font-semibold ${materialBalance > 0 ? 'text-blue-600' : materialBalance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {materialBalance > 0 ? `+${materialBalance}` : materialBalance}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Pieces on Board:</span>
                  <span className="font-semibold">{pieces.length}</span>
                </div>
              </div>
            </div>

            {/* Sound Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800">🎵 Sound Engine</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-semibold ${isPlaying ? 'text-green-600' : 'text-gray-600'}`}>
                    {isPlaying ? '🟢 Playing' : '⏸️ Stopped'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Preset:</span>
                  <span className="font-semibold capitalize">{selectedPreset.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tick Rate:</span>
                  <span className="font-semibold">{1000 / tickInterval} Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Voices:</span>
                  <span className="font-semibold">{Math.min(pieces.length, 8)}</span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800">📋 Instructions</h3>
              <ul className="text-sm space-y-2 text-gray-600">
                <li>• <strong>Load PGN:</strong> Import chess games in standard notation</li>
                <li>• <strong>Navigation:</strong> Use Previous/Next or timeline scrubber</li>
                <li>• <strong>Sound:</strong> Each piece type has its own frequency</li>
                <li>• <strong>Octaves:</strong> White pieces play higher, black pieces lower</li>
                <li>• <strong>Auto Play:</strong> Automatically advance through moves</li>
                <li>• <strong>Tick Rate:</strong> Adjust playback speed (250ms - 3000ms)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
