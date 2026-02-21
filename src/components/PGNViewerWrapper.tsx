import { useLayoutEffect, useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { pgnView, type PgnViewerApi } from '@mliebelt/pgn-viewer';
import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';

// BUG-012 FIX: Gate all debug logging behind dev mode
const DEV = import.meta.env.DEV;

interface PGNViewerWrapperProps {
  pgn: string;
  onPositionChange?: (fen: string, moveIndex: number) => void;
  // Optional: allow parent to control current move index
  externalIndex?: number;
  // BUG-004 FIX: Acknowledgement callback - parent clears externalIndex when we confirm processing
  onExternalIndexProcessed?: () => void;
  // Report the total number of positions (including start)
  onGameLengthChange?: (length: number) => void;
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
  externalIndex,
  onExternalIndexProcessed,
  onGameLengthChange,
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
  const lastSentRef = useRef<number>(-1)
  const currentIndexRef = useRef<number>(0)
  const programmaticChangeRef = useRef<number>(0)

  const handlePositionChange = useCallback((fen: string, moveIndex: number) => {
    if (onPositionChange) {
      onPositionChange(fen, moveIndex);
    }
  }, [onPositionChange]);

  // Parse the PGN and build move history using chess.js
  const gameData = useMemo(() => {
    const chess = new Chess();
    const moves: { fen: string; san: string }[] = [];

    if (DEV) console.log('PGNViewer: Parsing PGN:', gameDescription);

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
      if (DEV) console.log('PGNViewer: Extracted move text:', moveText);

      if (moveText && moveText !== '*') {
        // Remove move numbers and split by spaces
        // BUG-014 FIX: Only remove move numbers (e.g. "1." "12." "1...") not digits inside move notation like R1e1
        const tokens = moveText.replace(/\d+\.{1,3}/g, '').split(/\s+/).filter(token =>
          token && token !== '*' && !token.match(/^(1-0|0-1|1\/2-1\/2)$/)
        );

        if (DEV) console.log('PGNViewer: Parsed tokens:', tokens);

        for (const token of tokens) {
          try {
            const move = chess.move(token);
            if (move) {
              moves.push({ fen: chess.fen(), san: move.san });
              if (DEV) console.log(`PGNViewer: Applied move ${token} -> ${move.san}, FEN: ${chess.fen()}`);
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

    if (DEV) console.log('PGNViewer: Parsed', moves.length, 'positions');
    return moves;
  }, [gameDescription]);

  // Notify parent of length
  useEffect(() => {
    onGameLengthChange?.(gameData.length)
  }, [gameData.length, onGameLengthChange])

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
      // Only notify if index actually changed to avoid feedback loops
      if (currentMoveIndex !== lastSentRef.current) {
        if (DEV) console.log('PGNViewer: Position changed to', currentMoveIndex, position.fen);
        if (DEV) console.log('PGNViewer: Game has', gameData.length, 'positions total');
        lastSentRef.current = currentMoveIndex
        handlePositionChange(position.fen, currentMoveIndex);
      }
    } else {
      if (DEV) console.log('PGNViewer: Invalid position data', {
        gameDataLength: gameData.length,
        currentMoveIndex,
        validIndex: currentMoveIndex < gameData.length
      });
    }
  }, [currentMoveIndex, gameData, handlePositionChange]);

  // BUG-004 FIX: Apply external index from parent with acknowledgement pattern
  // Instead of relying on a timeout in App.tsx to clear externalIndex (which raced
  // with the 200ms poll and 300ms programmatic guard), we now call
  // onExternalIndexProcessed() after we've applied the change. This guarantees
  // the parent only clears the value after it's been consumed.
  useEffect(() => {
    if (typeof externalIndex !== 'number') return
    let idx = Math.floor(externalIndex)
    if (!Number.isFinite(idx)) return
    if (idx < 0) idx = 0
    if (idx >= gameData.length) idx = gameData.length - 1
    if (idx !== currentMoveIndex) {
      setCurrentMoveIndex(idx)
      // Best-effort reflect in embedded viewer by "clicking" the move element
      const element = document.getElementById(id)
      if (element) {
        const nodes = element.querySelectorAll('.move, [data-move], [data-index], [data-ply]')
        const target = nodes[idx] as HTMLElement | undefined
        if (target) {
          // Mark that we triggered a programmatic change so the delegate click handler
          // won't treat this as a user-initiated change and start a feedback loop.
          programmaticChangeRef.current = Date.now()
          target.click?.()
        }
      }
    }
    // Acknowledge processing so parent clears externalIndex
    onExternalIndexProcessed?.()
  }, [externalIndex, gameData.length, currentMoveIndex, id, onExternalIndexProcessed])

  useLayoutEffect(() => {
    if (DEV) console.log('Initializing pgn-viewer with PGN:', gameDescription);
    if (DEV) console.log('Parsed game data:', gameData.length, 'positions');

    // Wait for next tick to ensure DOM element is mounted
    const timer = setTimeout(() => {
      const element = document.getElementById(id);
      if (!element) {
        console.warn('DOM element not found for pgn-viewer:', id);
        return;
      }

      try {
        if (DEV) console.log('Creating pgn-viewer...');

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
        if (DEV) console.log('pgn-viewer created successfully');

        // Delegated click handler: after viewer processes click, read currentMove
        const delegateClick = (evt: Event) => {
          // Debug: surface that we saw a click inside the viewer
          const tag = (evt.target as HTMLElement)?.tagName?.toLowerCase()
          if (DEV) console.log('PGNViewer: delegate click', tag)
          // Let the viewer handle the click first, then read its new state in a microtask
          window.setTimeout(() => {
            // If we triggered a programmatic click recently, ignore this delegate event
            const sinceProgrammatic = Date.now() - programmaticChangeRef.current
            if (programmaticChangeRef.current && sinceProgrammatic < 300) {
              if (DEV) console.log('PGNViewer: ignoring delegate due to recent programmatic change', sinceProgrammatic)
              return
            }
            const base = viewerRef.current?.base as { currentMove?: number; mypgn?: unknown } | undefined
            if (DEV) console.log('PGNViewer: viewerRef.base snapshot', base)
            let cm = base?.currentMove

            // Helpful diagnostics: inspect moves container and attributes
            try {
              const container = (viewerRef.current as unknown as { _container?: HTMLElement })?._container
              if (container) {
                const nodes = container.querySelectorAll('.move, [data-move], [data-index], [data-ply]')
                if (DEV) console.log('PGNViewer: move nodes count (delegate):', nodes?.length)
                if (nodes && nodes.length > 0) {
                  // Log first few node class lists for debugging
                  for (let i = 0; i < Math.min(6, nodes.length); i++) {
                    try {
                      const el = nodes[i] as HTMLElement
                      const names = el.getAttributeNames?.() ?? []
                      const attrs = names.map(n => [n, el.getAttribute(n)])
                      if (DEV) console.log('PGNViewer: move node', i, el.className, attrs)
                    } catch {
                      /* ignore individual node logging errors */
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('PGNViewer: diagnostic collection failed', err)
            }

            // Fallback: if viewer doesn't expose currentMove, try to infer from DOM
            if (typeof cm !== 'number') {
              try {
                const container = (viewerRef.current as unknown as { _container?: HTMLElement })?._container
                const nodes = container?.querySelectorAll('.move, [data-move], [data-index], [data-ply]')
                if (nodes && nodes.length > 0) {
                  // Try to find an element that looks selected/current
                  const sel = container?.querySelector('.move.current, .move.selected, .move.active, [aria-current="true"], [data-current="true"]') as HTMLElement | null
                  if (sel) {
                    const idx = Array.prototype.indexOf.call(nodes, sel)
                    if (idx >= 0 && idx < gameData.length) cm = idx
                  }
                }
              } catch (err) {
                console.warn('PGNViewer: DOM fallback failed', err)
              }
            }

            // Additional robust fallback: read the viewer's internal chess fen (if exposed)
            try {
              // Defensive: use a single cast to any for runtime-only inspection of viewer internals
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const v: any = viewerRef.current
              const chessObj = v?.base?.chess
              if (chessObj && typeof chessObj.fen === 'function') {
                const fen = chessObj.fen()
                if (DEV) console.log('PGNViewer: fen from viewer', fen)
                const idx = gameData.findIndex(p => p.fen === fen)
                if (idx >= 0 && idx < gameData.length && idx !== currentMoveIndex) {
                  if (DEV) console.log('PGNViewer: delegate resolved index from fen', idx, 'current:', currentMoveIndex)
                  // Update the internal index - this will trigger position change notification
                  setCurrentMoveIndex(idx)
                }
              }
            } catch (err) {
              console.warn('PGNViewer: fen fallback failed', err)
            }
          }, 0)
        }
        element.addEventListener('click', delegateClick, true);

        // Store for cleanup
        ; (viewer as unknown as { _container?: HTMLElement })._container = element;
        ; (viewer as unknown as { _delegateClick?: (e: Event) => void })._delegateClick = delegateClick;

      } catch (error) {
        console.error('Error initializing pgn-viewer:', error);
      }
    }, 0);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (viewerRef.current) {
        const ref = viewerRef.current as unknown as { _container?: HTMLElement; _delegateClick?: (e: Event) => void };
        if (ref._container && ref._delegateClick) {
          ref._container.removeEventListener('click', ref._delegateClick, true);
        }
        viewerRef.current = null;
      }
    };
    // Important: Do NOT depend on currentMoveIndex or gameData here, or the viewer will
    // re-initialize on every move, causing an update loop. Only reinit when PGN or
    // visual options change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gameDescription, timerTime, locale, showResult, boardSize, showFen, pieceStyle, theme]);

  // Fallback sync: poll viewer's currentMove to keep our index aligned, independent of DOM class names
  useEffect(() => {
    // Keep a mutable ref to the latest index so the interval closure doesn't get stale
    currentIndexRef.current = currentMoveIndex

    const interval = window.setInterval(() => {
      try {
        const base = viewerRef.current?.base as { currentMove?: number } | undefined
        let cm = base?.currentMove

        // DOM fallback if viewer doesn't expose currentMove
        if (typeof cm !== 'number') {
          const element = document.getElementById(id)
          const nodes = element?.querySelectorAll('.move, [data-move], [data-index], [data-ply]')
          if (nodes && nodes.length > 0) {
            const sel = element?.querySelector('.move.current, .move.selected, .move.active, [aria-current="true"], [data-current="true"]') as HTMLElement | null
            if (sel) {
              const idx = Array.prototype.indexOf.call(nodes, sel)
              if (idx >= 0 && idx < gameData.length) cm = idx
            }
          }
        }

        if (typeof cm === 'number') {
          let idx = cm
          if (!Number.isFinite(idx)) return
          if (idx < 0) idx = 0
          if (idx >= gameData.length) idx = gameData.length - 1
          // Ignore updates immediately after a programmatic change to avoid feedback
          const sinceProgrammatic = Date.now() - programmaticChangeRef.current
          if (programmaticChangeRef.current && sinceProgrammatic < 300) {
            // skip
            // console.log('PGNViewer: poll skipping due to recent programmatic change', sinceProgrammatic)
          } else if (idx !== currentIndexRef.current) {
            if (DEV) console.log('PGNViewer: poll detected index change', idx)
            setCurrentMoveIndex(idx)
            currentIndexRef.current = idx
          }
        }
      } catch (err) {
        console.warn('PGNViewer: polling error', err)
      }
    }, 200)
    return () => window.clearInterval(interval)
  }, [id, gameData.length, currentMoveIndex])

  // When PGN changes, reset index so initial FEN is emitted
  useEffect(() => {
    setCurrentMoveIndex(0)
  }, [pgn])

  // Drop global keyboard fallback to avoid clashes with the viewer's own key handling

  return (
    <div
      id={id}
      className="pgn-viewer-container"
    />
  );
}

export default PGNViewerWrapper;