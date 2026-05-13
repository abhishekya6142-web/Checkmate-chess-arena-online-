import { Chess, Move } from 'chess.js';

// Piece values
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (PST) - from White's perspective
// Tables incentivize pieces to be in more active squares
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_MID_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

const TABLES: Record<string, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_MID_PST
};

/**
 * Evaluates the board position.
 * Returns a positive score if the position is better for white, 
 * negative if better for black.
 */
const evaluateBoard = (game: Chess): number => {
  let totalEvaluation = 0;
  const board = game.board();

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece) {
        const val = PIECE_VALUES[piece.type];
        const pst = TABLES[piece.type];
        
        // Flip table for black
        const pstValue = piece.color === 'w' 
          ? pst[i][j] 
          : pst[7 - i][j];

        totalEvaluation += (piece.color === 'w' ? 1 : -1) * (val + pstValue);
      }
    }
  }

  return totalEvaluation;
};

/**
 * Quiescence search to avoid the horizon effect.
 * Only looks at captures to find a "quiet" position for evaluation.
 */
const quiesce = (
  game: Chess,
  alpha: number,
  beta: number
): number => {
  const standPat = -evaluateBoard(game);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;

  const moves = game.moves({ verbose: true }).filter(m => m.captured);

  for (const move of moves) {
    game.move(move);
    const score = -quiesce(game, -beta, -alpha);
    game.undo();

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
};

/**
 * Minimax algorithm with Alpha-Beta pruning
 */
const minimax = (
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean
): number => {
  if (depth === 0) {
    return quiesce(game, alpha, beta);
  }

  const moves = game.moves();

  if (isMaximizingPlayer) {
    let bestEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      bestEval = Math.max(bestEval, minimax(game, depth - 1, alpha, beta, !isMaximizingPlayer));
      game.undo();
      alpha = Math.max(alpha, bestEval);
      if (beta <= alpha) break;
    }
    return bestEval;
  } else {
    let bestEval = Infinity;
    for (const move of moves) {
      game.move(move);
      bestEval = Math.min(bestEval, minimax(game, depth - 1, alpha, beta, !isMaximizingPlayer));
      game.undo();
      beta = Math.min(beta, bestEval);
      if (beta <= alpha) break;
    }
    return bestEval;
  }
};

/**
 * Find the best move for the AI
 */
export const getBestMove = (game: Chess, difficulty: 'easy' | 'medium' | 'hard'): string => {
  const depth = difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1;
  const moves = game.moves();
  
  if (moves.length === 0) return "";

  // Basic move ordering: captures and checks first to improve pruning
  const sortedMoves = moves.sort((a, b) => {
    const isCapA = a.includes('x') ? 1 : 0;
    const isCapB = b.includes('x') ? 1 : 0;
    const isCheckA = a.includes('+') || a.includes('#') ? 1 : 0;
    const isCheckB = b.includes('+') || b.includes('#') ? 1 : 0;
    return (isCapB + isCheckB) - (isCapA + isCheckA);
  });

  let bestMove = "";
  let bestValue = -Infinity;

  for (const move of sortedMoves) {
    game.move(move);
    const boardValue = minimax(game, depth - 1, -Infinity, Infinity, false);
    game.undo();

    if (boardValue > bestValue) {
      bestValue = boardValue;
      bestMove = move;
    }
  }

  return bestMove;
};
