import { useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { pgnView, type PgnViewerApi } from '@mliebelt/pgn-viewer';
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

  const handlePositionChange = useCallback((fen: string, moveIndex: number) => {
    if (onPositionChange) {
      onPositionChange(fen, moveIndex);
    }
  }, [onPositionChange]);

  useLayoutEffect(() => {
    console.log('Initializing pgn-viewer with PGN:', gameDescription);

    // Wait for next tick to ensure DOM element is mounted
    const timer = setTimeout(() => {
      const element = document.getElementById(id);
      if (!element) {
        console.warn('DOM element not found for pgn-viewer:', id);
        return;
      }

      try {
        // Try different initialization approaches
        console.log('Attempting pgn-viewer initialization...');

        const viewer = pgnView(id, {
          pgn: gameDescription,
          timerTime: timerTime,
          locale: locale,
          showResult: showResult,
          boardSize: boardSize,
          showFen: showFen,
          pieceStyle: pieceStyle,
          theme: theme,
          // Force parsing of PGN immediately
          startPlay: false
        });

        viewerRef.current = viewer;

        // Give pgn-viewer some time to parse the PGN
        setTimeout(() => {
          console.log('pgn-viewer initialized successfully');
          console.log('Viewer object structure:', viewer);
          console.log('Viewer.base:', viewer.base);

          if (viewer.base) {
            console.log('Viewer.base.mypgn:', viewer.base.mypgn);
            console.log('Available methods on viewer.base:', Object.keys(viewer.base));

            // Try alternative ways to access the chess game
            if (viewer.base.chess) {
              console.log('Viewer.base.chess:', viewer.base.chess);
              console.log('Viewer.base.chess methods:', Object.keys(viewer.base.chess));
            }
          }

          // Try to trigger PGN parsing manually if needed
          if (viewer.base && typeof viewer.base.generateBoard === 'function') {
            console.log('Calling generateBoard to ensure PGN is parsed...');
            try {
              viewer.base.generateBoard();
              console.log('generateBoard called successfully');
              // Check again after generateBoard
              console.log('After generateBoard - mypgn:', viewer.base.mypgn);
            } catch (err) {
              console.warn('Error calling generateBoard:', err);
            }
          }
        }, 100);

        // Extract initial position with more debugging
        if (handlePositionChange && viewer.base && viewer.base.mypgn) {
          try {
            console.log('Attempting to get initial position...');
            const position = viewer.base.mypgn.getMove(0);
            console.log('getMove(0) result:', position);
            if (position && position.fen) {
              console.log('PGNViewer: Initial position FEN:', position.fen);
              handlePositionChange(position.fen, 0);
            } else {
              console.warn('No FEN found in position:', position);

              // Try alternative methods to get current position
              if (viewer.base.mypgn.fen) {
                console.log('Using viewer.base.mypgn.fen:', viewer.base.mypgn.fen);
                handlePositionChange(viewer.base.mypgn.fen(), 0);
              } else if (viewer.base.mypgn.getCurrentFen) {
                console.log('Using getCurrentFen method');
                handlePositionChange(viewer.base.mypgn.getCurrentFen(), 0);
              } else {
                // Fallback to starting position FEN
                const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
                console.log('Fallback to starting position FEN');
                handlePositionChange(startingFen, 0);
              }
            }
          } catch (error) {
            console.error('Error extracting initial position:', error);
            // Fallback to starting position FEN
            const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
            console.log('Error fallback to starting position FEN');
            handlePositionChange(startingFen, 0);
          }
        } else {
          console.warn('Missing dependencies for position extraction:', {
            hasHandler: !!handlePositionChange,
            hasBase: !!(viewer.base),
            hasPgn: !!(viewer.base?.mypgn)
          });
        }

        // Set up position change listener for navigation
        if (viewer.base && viewer.base.mypgn && handlePositionChange) {
          let lastMoveIndex = 0;
          let lastFen = '';

          // Override the pgn-viewer's move navigation to trigger our callback
          const originalGotoMove = viewer.base.mypgn.gotoMove;
          if (originalGotoMove) {
            viewer.base.mypgn.gotoMove = function (moveIndex: number) {
              const result = originalGotoMove.call(this, moveIndex);
              try {
                const currentMove = this.getMove(moveIndex);
                if (currentMove && currentMove.fen) {
                  console.log(`PGNViewer: Moved to position ${moveIndex}, FEN:`, currentMove.fen);
                  handlePositionChange(currentMove.fen, moveIndex);
                  lastMoveIndex = moveIndex;
                  lastFen = currentMove.fen;
                }
              } catch (error) {
                console.warn('Error getting current position after move:', error);
              }
              return result;
            };
          }

          // Also set up polling as backup to detect position changes
          const pollInterval = setInterval(() => {
            try {
              const currentMoveIndex = viewer.base.mypgn.currentMove || 0;
              const currentMove = viewer.base.mypgn.getMove(currentMoveIndex);
              if (currentMove && currentMove.fen &&
                (currentMoveIndex !== lastMoveIndex || currentMove.fen !== lastFen)) {
                console.log(`PGNViewer: Position changed via polling to ${currentMoveIndex}, FEN:`, currentMove.fen);
                handlePositionChange(currentMove.fen, currentMoveIndex);
                lastMoveIndex = currentMoveIndex;
                lastFen = currentMove.fen;
              }
            } catch {
              // Ignore polling errors
            }
          }, 500); // Poll every 500ms

          // Store interval for cleanup
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (viewer as any).pollInterval = pollInterval;
        }

      } catch (error) {
        console.error('Error initializing pgn-viewer:', error);
      }
    }, 0);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (viewerRef.current) {
        // Clear polling interval if it exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pollInterval = (viewerRef.current as any).pollInterval;
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        // Clear the viewer reference but don't manipulate DOM directly
        // React will handle DOM cleanup
        viewerRef.current = null;
      }
    };
  }, [id, gameDescription, timerTime, locale, showResult, boardSize, showFen, pieceStyle, theme, handlePositionChange]);

  return (
    <div
      id={id}
      className="pgn-viewer-container"
    />
  );
}

export default PGNViewerWrapper;