import { useLayoutEffect, useRef, useCallback, useMemo, useState } from 'react';
import { pgnView, type PgnViewerApi } from '@mliebelt/pgn-viewer';
import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';

interface PGNViewerWrapperProps {
  pgn: string;
  onPositionChange?: (fen: string, moveIndex: number) => void;
  boardSize?: string;
  pieceStyle?: string;
  theme?: string;
  showFen?: boolean;
  showResult?: boolean;
  timerTime?: string;
  locale?: string;
}

export function PGNViewerWrapper({
  pgn,
  onPositionChange,
  boardSize = '400',
  pieceStyle = 'merida',
  theme = 'brown',
  showFen = false,  // Hide the built-in FEN display to avoid overlap
  showResult = true,
  timerTime = '1',
  locale = 'en'
}: PGNViewerWrapperProps) {
  const gameDescription = pgn || '[Event "Empty"]\n[Site "Chessizer"]\n[Result "*"]\n\n*';
  const id = useMemo(() => 'board-' + uuidv4(), []); // Stable ID across re-renders
  const viewerRef = useRef<PgnViewerApi | null>(null);
  const chessRef = useRef<Chess>(new Chess());
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);

  const handlePositionChange = useCallback((fen: string, moveIndex: number) => {
    if (onPositionChange) {
      onPositionChange(fen, moveIndex);
    }
  }, [onPositionChange]);

  // Parse the PGN and build move history using chess.js
  const gameData = useMemo(() => {
    const chess = new Chess();
    const moves: { fen: string; san: string }[] = [];

    console.log('PGNViewer: Parsing PGN:', gameDescription);

    // Add starting position
    moves.push({ fen: chess.fen(), san: '' });

    try {
      // Simple PGN parsing - extract moves between headers and result
      let gameContent = gameDescription;

      // Remove headers (lines starting with [)
      gameContent = gameContent.replace(/\[[^\]]*\]/g, '');

      // Remove result markers
      gameContent = gameContent.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/g, '');

      // Extract move text and split into individual moves
      const moveText = gameContent.trim();
      console.log('PGNViewer: Extracted move text:', moveText);

      if (moveText && moveText !== '*') {
        // Remove move numbers and split by spaces
        const tokens = moveText.replace(/\d+\./g, '').split(/\s+/).filter(token =>
          token && token !== '*' && !token.match(/^(1-0|0-1|1\/2-1\/2)$/)
        );

        console.log('PGNViewer: Parsed tokens:', tokens);

        for (const token of tokens) {
          try {
            const move = chess.move(token);
            if (move) {
              moves.push({ fen: chess.fen(), san: move.san });
              console.log(`PGNViewer: Applied move ${token} -> ${move.san}, FEN: ${chess.fen()}`);
            }
          } catch (err) {
            console.warn('Invalid move:', token, err);
            break;
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing PGN:', error);
    }

    console.log('PGNViewer: Parsed', moves.length, 'positions');
    return moves;
  }, [gameDescription]);

  // Update the chess reference when game data changes
  useLayoutEffect(() => {
    chessRef.current = new Chess();
    // Replay moves to current position
    for (let i = 0; i < Math.min(currentMoveIndex + 1, gameData.length); i++) {
      if (i > 0 && gameData[i].san) {
        try {
          chessRef.current.move(gameData[i].san);
        } catch (err) {
          console.warn('Error replaying move:', gameData[i].san, err);
          break;
        }
      }
    }
  }, [gameData, currentMoveIndex]);

  // Send position changes to parent
  useLayoutEffect(() => {
    if (gameData.length > 0 && currentMoveIndex < gameData.length) {
      const position = gameData[currentMoveIndex];
      console.log('PGNViewer: Position changed to', currentMoveIndex, position.fen);
      console.log('PGNViewer: Game has', gameData.length, 'positions total');
      handlePositionChange(position.fen, currentMoveIndex);
    } else {
      console.log('PGNViewer: Invalid position data', {
        gameDataLength: gameData.length,
        currentMoveIndex,
        validIndex: currentMoveIndex < gameData.length
      });
    }
  }, [currentMoveIndex, gameData, handlePositionChange]);

  useLayoutEffect(() => {
    console.log('Initializing pgn-viewer with PGN:', gameDescription);
    console.log('Parsed game data:', gameData.length, 'positions');

    // Wait for next tick to ensure DOM element is mounted
    const timer = setTimeout(() => {
      const element = document.getElementById(id);
      if (!element) {
        console.warn('DOM element not found for pgn-viewer:', id);
        return;
      }

      try {
        console.log('Creating pgn-viewer...');

        const viewer = pgnView(id, {
          pgn: gameDescription,
          timerTime: timerTime,
          locale: locale,
          showResult: showResult,
          boardSize: boardSize,
          showFen: showFen,
          pieceStyle: pieceStyle,
          theme: theme,
          startPlay: false
        });

        viewerRef.current = viewer;
        console.log('pgn-viewer created successfully');

        // Set up a mutation observer to watch for DOM changes
        // This will detect when the user navigates through moves
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            // Look for changes in the move list or board state
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
              // Extract current move from DOM
              const moveElement = element.querySelector('.current-move, .move.current, [data-move].current');
              if (moveElement) {
                const moveAttr = moveElement.getAttribute('data-move') ||
                  moveElement.getAttribute('data-index') ||
                  moveElement.textContent;

                if (moveAttr) {
                  const moveIdx = parseInt(moveAttr) || 0;
                  if (moveIdx !== currentMoveIndex && moveIdx < gameData.length) {
                    console.log('DOM detected move change to:', moveIdx);
                    setCurrentMoveIndex(moveIdx);
                  }
                }
              }

              // Alternative: look for highlighted moves in the move list
              const moveElements = element.querySelectorAll('[data-move], .move');
              moveElements.forEach((el, idx) => {
                if (el.classList.contains('current') || el.classList.contains('active')) {
                  if (idx !== currentMoveIndex && idx < gameData.length) {
                    console.log('DOM detected active move at index:', idx);
                    setCurrentMoveIndex(idx);
                  }
                }
              });
            }
          });
        });

        // Start observing
        observer.observe(element, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'data-move', 'data-index']
        });

        // Also set up click event listeners on move elements
        setTimeout(() => {
          const moveElements = element.querySelectorAll('.move, [data-move]');
          moveElements.forEach((el, idx) => {
            el.addEventListener('click', () => {
              console.log('Click detected on move:', idx);
              if (idx < gameData.length) {
                setTimeout(() => setCurrentMoveIndex(idx), 50);
              }
            });
          });
        }, 500);

        // Store observer for cleanup
        (viewer as { observer?: MutationObserver }).observer = observer;

      } catch (error) {
        console.error('Error initializing pgn-viewer:', error);
      }
    }, 0);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (viewerRef.current) {
        // Stop observing
        const observer = (viewerRef.current as { observer?: MutationObserver }).observer;
        if (observer) {
          observer.disconnect();
        }
        viewerRef.current = null;
      }
    };
  }, [id, gameDescription, timerTime, locale, showResult, boardSize, showFen, pieceStyle, theme, gameData, currentMoveIndex]);

  return (
    <div
      id={id}
      className="pgn-viewer-container"
    />
  );
}

export default PGNViewerWrapper;