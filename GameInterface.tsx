
import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { GameState, GameMode, Color, MultiplayerGame, GameSettings, AnonymousUser } from '../types';
import { getAIMove } from '../services/geminiService';
import { Clock, Maximize, Minimize, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameInterfaceProps {
  game: Chess;
  gameState: GameState;
  makeMove: (move: { from: string; to: string; promotion?: string }) => boolean;
  gameMode: GameMode;
  user?: AnonymousUser | null;
  multiplayerData?: MultiplayerGame | null;
  settings: GameSettings;
  isFullscreen?: boolean;
  toggleFullscreen?: () => void;
  isAiThinking: boolean;
}

const PIECES: Record<string, string> = {
  wP: 'https://www.chess.com/chess-themes/pieces/neo/150/wp.png',
  wN: 'https://www.chess.com/chess-themes/pieces/neo/150/wn.png',
  wB: 'https://www.chess.com/chess-themes/pieces/neo/150/wb.png',
  wR: 'https://www.chess.com/chess-themes/pieces/neo/150/wr.png',
  wQ: 'https://www.chess.com/chess-themes/pieces/neo/150/wq.png',
  wK: 'https://www.chess.com/chess-themes/pieces/neo/150/wk.png',
  bP: 'https://www.chess.com/chess-themes/pieces/neo/150/bp.png',
  bN: 'https://www.chess.com/chess-themes/pieces/neo/150/bn.png',
  bB: 'https://www.chess.com/chess-themes/pieces/neo/150/bb.png',
  bR: 'https://www.chess.com/chess-themes/pieces/neo/150/br.png',
  bQ: 'https://www.chess.com/chess-themes/pieces/neo/150/bq.png',
  bK: 'https://www.chess.com/chess-themes/pieces/neo/150/bk.png',
};

const GameInterface: React.FC<GameInterfaceProps> = ({ 
  game, 
  gameState, 
  makeMove, 
  gameMode,
  user,
  multiplayerData,
  settings,
  isFullscreen,
  toggleFullscreen,
  isAiThinking
}) => {
  const [manualFlip, setManualFlip] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [whiteTime, setWhiteTime] = useState(settings.timeControl * 60);
  const [blackTime, setBlackTime] = useState(settings.timeControl * 60);

  // Timer logic
  useEffect(() => {
    if (gameState.isGameOver) return;
    
    const timer = setInterval(() => {
      if (gameState.turn === 'w') {
        setWhiteTime(t => Math.max(0, t - 1));
      } else {
        setBlackTime(t => Math.max(0, t - 1));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.turn, gameState.isGameOver]);

  // Reset timers when settings change (new game)
  useEffect(() => {
    setWhiteTime(settings.timeControl * 60);
    setBlackTime(settings.timeControl * 60);
  }, [settings.timeControl, gameState.fen === settings.startingFen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isPlayerTurn = () => {
    if (gameMode === GameMode.MULTIPLAYER) {
      if (!user || !multiplayerData) return false;
      const playerColor = multiplayerData.players.w === user.uid ? 'w' : 'b';
      return gameState.turn === playerColor;
    }
    if (gameMode === GameMode.VS_AI) {
      return gameState.turn === 'w';
    }
    return true;
  };

  const onSquareClick = (square: string) => {
    if (gameState.isGameOver) {
      console.log("[Board Click] Game is over");
      return;
    }
    if (isAiThinking) {
      console.log("[Board Click] AI is thinking");
      return;
    }
    if (!isPlayerTurn()) {
      console.log("[Board Click] Not player's turn", { turn: gameState.turn, gameMode });
      return;
    }

    console.log(`[Board Click] Clicked on ${square}`);

    // Check if we are selecting a move to
    if (selectedSquare && possibleMoves.includes(square)) {
      console.log(`[Board Click] Attempting move from ${selectedSquare} to ${square}`);
      const move = makeMove({
        from: selectedSquare,
        to: square,
        promotion: 'q', // default auto-promote to queen
      });
      if (move) {
        console.log("[Board Click] Move successful");
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      } else {
        console.warn("[Board Click] Move failed");
      }
    }

    // Otherwise, select a piece
    const piece = game.get(square as Square);
    if (piece && piece.color === game.turn()) {
      console.log(`[Board Click] Selected piece at ${square}: ${piece.type}`);
      setSelectedSquare(square);
      const moves = game.moves({ square: square as Square, verbose: true });
      setPossibleMoves(moves.map(m => m.to));
      console.log(`[Board Click] Possible moves: ${moves.map(m => m.to).join(', ')}`);
    } else {
      console.log("[Board Click] Selection cleared");
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  const renderBoard = () => {
    const board = [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

    const lastMove = gameState.history[gameState.history.length - 1];

    for (const rank of ranks) {
      for (const file of files) {
        const square = `${file}${rank}`;
        const isDark = (rank + files.indexOf(file)) % 2 === 0;
        const piece = game.get(square as Square);
        const isSelected = selectedSquare === square;
        const isPossible = possibleMoves.includes(square);
        const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);

        board.push(
          <motion.div 
            layout
            key={square}
            id={`square-${square}`}
            onClick={() => onSquareClick(square)}
            className={`
              square
              ${isDark ? 'square-dark' : 'square-light'}
              ${isSelected ? 'square-selected' : ''}
              ${isLastMove ? 'square-last-move' : ''}
              ${isPossible && isPlayerTurn() ? 'cursor-pointer hover:bg-opacity-80' : 'cursor-default'}
            `}
          >
            {/* Counter-rotation wrapper for all contents to keep them upright */}
            <div className={`w-full h-full relative transition-transform duration-500 flex items-center justify-center ${manualFlip ? 'rotate-180' : ''}`}>
              {/* Square labels */}
              {file === 'a' && (
                <span className="coord-label top-1 left-1">
                  {rank}
                </span>
              )}
              {rank === 1 && (
                <span className="coord-label bottom-1 right-1 uppercase">
                  {file}
                </span>
              )}

              {/* Extra labels for Local PvP (top player perspective) */}
              {gameMode === GameMode.LOCAL_PVP && (
                <>
                  {file === 'h' && (
                    <span className="coord-label bottom-1 right-1 rotate-180 opacity-60">
                      {rank}
                    </span>
                  )}
                  {rank === 8 && (
                    <span className="coord-label top-1 left-1 uppercase rotate-180 opacity-60">
                      {file}
                    </span>
                  )}
                </>
              )}
              
              {/* Highlight for possible moves */}
              {isPossible && isPlayerTurn() && (
                piece ? (
                  <div className="capture-hint"></div>
                ) : (
                  <div className="move-hint"></div>
                )
              )}

              {/* Pieces */}
              <AnimatePresence mode="popLayout">
                {piece && (
                  <motion.img 
                    // Logic: 
                    // 1. In Local PvP: White always upright (0), Black always inverted (180) for tabletop play.
                    // 2. In other modes: Current turn upright (0), opponent inverted (180).
                    initial={false}
                    animate={{ 
                      opacity: 1, 
                      scale: 1, 
                      rotate: gameMode === GameMode.LOCAL_PVP 
                        ? (piece.color === 'w' ? 0 : 180)
                        : (gameState.turn === 'w' ? 0 : 180)
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ 
                      rotate: { duration: 0.3, ease: "easeInOut" },
                      opacity: { duration: 0.2 },
                      scale: { duration: 0.2 }
                    }}
                    key={`${piece.color}${piece.type}-${square}`}
                    id={`piece-${piece.color}-${piece.type}-${square}`}
                    src={PIECES[`${piece.color}${piece.type.toUpperCase()}`]} 
                    alt={`${piece.color} ${piece.type}`}
                    className={`chess-piece ${isSelected ? 'selected' : ''}`}
                    referrerPolicy="no-referrer"
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      }
    }
    return board;
  };

  const getPlayerLabel = (color: Color) => {
    if (gameMode === GameMode.MULTIPLAYER) {
      if (multiplayerData?.players[color] === user?.uid) return 'You';
      return multiplayerData?.players[color] ? 'Opponent' : 'Waiting...';
    }
    if (gameMode === GameMode.VS_AI) {
      return color === 'w' ? 'You' : 'Gemini AI';
    }
    return color === 'w' ? 'White Player' : 'Black Player';
  };

  return (
    <div className={`w-full relative mx-auto transition-all duration-500 ${isFullscreen ? 'max-w-4xl scale-110' : 'max-w-[540px]'}`}>
      <div className="mb-6 flex justify-between items-center bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 shadow-xl">
        <div className="flex items-center gap-4">
           <div className={`w-3.5 h-3.5 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 ${gameState.turn === 'w' ? 'bg-white ring-white/20' : 'bg-slate-700 ring-transparent'}`}></div>
           <div className="flex flex-col">
             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{gameState.turn === 'w' ? 'Current Turn' : 'Waiting'}</span>
             <span className="text-lg font-serif font-bold text-slate-100">{getPlayerLabel('w')}</span>
             <div className={`flex items-center gap-2 text-sm font-mono mt-0.5 ${whiteTime < 30 ? 'text-red-500 animate-pulse' : 'text-amber-500/80'}`}>
               <Clock size={14} /> {formatTime(whiteTime)}
             </div>
           </div>
        </div>
        
        <div className="px-4 py-2 bg-slate-800/80 rounded-lg border border-slate-700/50 flex flex-col items-center justify-center relative group">
            {gameState.inCheck ? (
                <span className="text-red-500 font-black text-xs tracking-tighter animate-bounce px-2 py-0.5 bg-red-500/10 rounded">CHECK</span>
            ) : (
                <span className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.2em]">Match</span>
            )}
            
            {toggleFullscreen && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setManualFlip(!manualFlip)}
                  className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/50 hover:bg-slate-700 text-amber-500 transition-colors"
                  title="Flip Board"
                  id="flip-board-btn"
                >
                  <RefreshCw size={18} className={manualFlip ? 'rotate-180 transition-transform' : ''} />
                </button>
                <button 
                  onClick={toggleFullscreen}
                  className="p-2 bg-slate-800/80 rounded-lg border border-slate-700/50 hover:bg-slate-700 text-amber-500 transition-colors"
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  id="fullscreen-toggle-btn"
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            )}
        </div>

        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end text-right">
             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{gameState.turn === 'b' ? 'Current Turn' : 'Waiting'}</span>
             <span className="text-lg font-serif font-bold text-slate-100">{getPlayerLabel('b')}</span>
             <div className={`flex items-center gap-2 text-sm font-mono mt-0.5 ${blackTime < 30 ? 'text-red-500 animate-pulse' : 'text-amber-500/80'}`}>
               {formatTime(blackTime)} <Clock size={14} />
             </div>
           </div>
           <div className={`w-3.5 h-3.5 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 ${gameState.turn === 'b' ? 'bg-amber-500 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-700 ring-transparent'}`}></div>
        </div>
      </div>

      <div className={`board-container p-2 sm:p-4 transition-transform duration-500 ${manualFlip ? 'rotate-180' : ''}`}>
        <div className="chess-board-grid w-full rounded-sm">
          {renderBoard()}
        </div>
      </div>

      {isAiThinking && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 backdrop-blur-xl px-8 py-4 rounded-2xl border border-amber-500/30 flex items-center gap-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-50">
          <div className="w-6 h-6 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="flex flex-col">
            <span className="text-amber-500 font-black text-sm tracking-[0.2em] uppercase">Gemini AI</span>
            <span className="text-slate-400 text-xs font-medium">Analyzing Position...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameInterface;
