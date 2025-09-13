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
        const viewer = pgnView(id, {
          pgn: gameDescription,
          timerTime: timerTime,
          locale: locale,
          // Removed startPlay - let pgn-viewer use default behavior
          showResult: showResult,
          boardSize: boardSize,
          showFen: showFen,
          pieceStyle: pieceStyle,
          theme: theme
        });

        viewerRef.current = viewer;
        console.log('pgn-viewer initialized successfully');

        // Extract initial position
        if (handlePositionChange && viewer.base && viewer.base.mypgn) {
          try {
            const position = viewer.base.mypgn.getMove(0);
            if (position && position.fen) {
              handlePositionChange(position.fen, 0);
            }
          } catch (error) {
            console.warn('Error extracting initial position:', error);
          }
        }

      } catch (error) {
        console.error('Error initializing pgn-viewer:', error);
      }
    }, 0);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (viewerRef.current) {
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