
export interface AnonymousUser {
  uid: string;
  displayName: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  updatedAt?: any;
}

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
  MULTIPLAYER = 'MULTIPLAYER'
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

export interface GameSettings {
  startingFen: string;
  timeControl: number; // in minutes
  aiDifficulty: 'easy' | 'medium' | 'hard';
  enableSound?: boolean;
  aiType?: 'engine' | 'gemini';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}
