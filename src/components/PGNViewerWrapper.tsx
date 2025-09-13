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
  theme = 'green',
  showFen = true,
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
    console.log('Target element ID:', id);

    const element = document.getElementById(id);
    console.log('Found target element:', element);
    console.log('Element innerHTML before:', element?.innerHTML);

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
      console.log('pgn-viewer initialized successfully:', viewer);

      // Log DOM state after initialization
      const elementAfter = document.getElementById(id);
      console.log('Element innerHTML after:', elementAfter?.innerHTML);
      console.log('Element children count:', elementAfter?.children.length);

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

    // Cleanup function
    return () => {
      if (viewerRef.current) {
        // pgn-viewer doesn't have explicit cleanup
        const element = document.getElementById(id);
        if (element) {
          element.innerHTML = '';
        }
      }
    };
  }, [id, gameDescription, timerTime, locale, showResult, boardSize, showFen, pieceStyle, theme, handlePositionChange]);

  return (
    <div
      id={id}
      className="pgn-viewer-container"
      style={{
        minHeight: '500px',
        minWidth: '500px',
        border: '2px solid red',
        padding: '10px',
        backgroundColor: '#f0f0f0'
      }}
    >
      <div>Loading chess board... (ID: {id})</div>
    </div>
  );
}

export default PGNViewerWrapper;