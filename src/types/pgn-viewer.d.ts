declare module '@mliebelt/pgn-viewer' {
  export interface PgnViewerConfiguration {
    pgn?: string;
    boardSize?: string;
    pieceStyle?: string;
    theme?: string;
    showFen?: boolean;
    showResult?: boolean;
    timerTime?: string;
    locale?: string;
    headers?: boolean;
    orientation?: 'white' | 'black';
    showCoords?: boolean;
    layout?: 'top' | 'bottom' | 'left' | 'right';
    width?: string;
    movesWidth?: string;
    movesHeight?: string;
    [key: string]: any;
  }

  export interface PgnViewerApi {
    base: {
      mypgn: {
        getMove: (index: number) => any;
        getTags: () => any;
        [key: string]: any;
      };
      currentMove?: number;
      [key: string]: any;
    };
    board: any;
  }

  export function pgnView(boardId: string, configuration: PgnViewerConfiguration): PgnViewerApi;
  export function pgnBoard(boardId: string, configuration: PgnViewerConfiguration): PgnViewerApi;
  export function pgnEdit(boardId: string, configuration: PgnViewerConfiguration): PgnViewerApi;
  export function pgnPrint(boardId: string, configuration: PgnViewerConfiguration): PgnViewerApi;
  export function pgnPuzzle(boardId: string, configuration: PgnViewerConfiguration): PgnViewerApi;
}