
export type Color = 'w' | 'b';
export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceSymbol;
  color: Color;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
  piece?: string;
  san?: string;
}

export interface GameState {
  fen: string;
  history: Move[];
  isGameOver: boolean;
  winner: Color | 'draw' | null;
  turn: Color;
  inCheck: boolean;
}

export enum GameMode {
  VS_AI = 'VS_AI',
  LOCAL_PVP = 'LOCAL_PVP',
  MULTIPLAYER = 'MULTIPLAYER',
  ANALYSIS = 'ANALYSIS'
}

export interface MultiplayerGame {
  id: string;
  fen: string;
  history: string[];
  players: {
    w?: string;
    b?: string;
  };
  status: 'waiting' | 'active' | 'finished';
  turn: Color;
  winner: string | 'draw' | null;
  lastMoveAt: any;
}

export interface AIAnalysis {
  bestMove: string;
  evaluation: string;
  explanation: string;
  suggestions: string[];
}

export interface GameSettings {
  startingFen: string;
  timeControl: number; // in minutes
  aiDifficulty: 'easy' | 'medium' | 'hard';
}
