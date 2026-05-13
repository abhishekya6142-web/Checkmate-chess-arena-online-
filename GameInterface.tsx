
import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { GameState, GameMode, Color, MultiplayerGame, GameSettings, AnonymousUser, UserProfile } from '../types';
import { getAIMove } from '../services/geminiService';
import { getUserProfile } from '../services/userService';
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

const TimeDisplay: React.FC<{ seconds: number; active: boolean; label: string; isBlack?: boolean }> = ({ seconds, active, label, isBlack }) => {
  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col ${isBlack ? 'items-end text-right' : 'items-start'}`}>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{active ? 'Current Turn' : 'Waiting'}</span>
      <span className="text-lg font-serif font-bold text-slate-100">{label}</span>
      <div className={`flex items-center gap-2 text-sm font-mono mt-0.5 ${seconds < 30 ? 'text-red-500 animate-pulse' : 'text-amber-500/80'}`}>
        {!isBlack && <Clock size={14} />} 
        {formatTime(seconds)} 
        {isBlack && <Clock size={14} />}
      </div>
    </div>
  );
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
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [whiteTime, setWhiteTime] = useState(settings.timeControl * 60);
  const [blackTime, setBlackTime] = useState(settings.timeControl * 60);
  const [playerNames, setPlayerNames] = useState<{w?: string, b?: string}>({});

  // Fetch player names in multiplayer
  useEffect(() => {
    if (gameMode === GameMode.MULTIPLAYER && multiplayerData) {
      const fetchNames = async () => {
        const names: {w?: string, b?: string} = {};
        
        if (multiplayerData.players.w) {
          if (multiplayerData.players.w === user?.uid) {
            names.w = user.displayName;
          } else {
            const profile = await getUserProfile(multiplayerData.players.w);
            if (profile) names.w = profile.displayName;
          }
        }
        
        if (multiplayerData.players.b) {
          if (multiplayerData.players.b === user?.uid) {
            names.b = user.displayName;
          } else {
            const profile = await getUserProfile(multiplayerData.players.b);
            if (profile) names.b = profile.displayName;
          }
        }
        
        setPlayerNames(names);
      };
      
      fetchNames();
    }
  }, [gameMode, multiplayerData, user?.uid, user?.displayName]);

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

  const boardSquares = React.useMemo(() => {
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
        const isInCheck = gameState.inCheck && piece?.type === 'k' && piece?.color === gameState.turn;

        board.push(
          <div 
            key={square}
            id={`square-${square}`}
            onClick={() => onSquareClick(square)}
            className={`
              square flex items-center justify-center relative
              ${isDark ? 'square-dark' : 'square-light'}
              ${isSelected ? 'square-selected' : ''}
              ${isLastMove ? 'square-last-move' : ''}
              ${isInCheck ? 'square-in-check animate-pulse scale-105 z-10 rounded-sm' : ''}
              ${isPossible && isPlayerTurn() ? 'cursor-pointer hover:bg-opacity-80' : 'cursor-default'}
            `}
          >
            {/* Square labels */}
            {file === 'a' && <span className="coord-label top-1 left-1">{rank}</span>}
            {rank === 1 && <span className="coord-label bottom-1 right-1 uppercase">{file}</span>}

            {/* Extra labels for Local PvP */}
            {gameMode === GameMode.LOCAL_PVP && (
              <>
                {file === 'h' && <span className="coord-label bottom-1 right-1 rotate-180 opacity-60">{rank}</span>}
                {rank === 8 && <span className="coord-label top-1 left-1 uppercase rotate-180 opacity-60">{file}</span>}
              </>
            )}
            
            {/* Highlight for possible moves */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              {isPossible && isPlayerTurn() && (
                piece ? <div className="capture-hint"></div> : <div className="move-hint"></div>
              )}
            </div>

            {/* Pieces */}
            <AnimatePresence mode="popLayout">
              {piece && (
                <motion.img 
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: 1, 
                      scale: isSelected ? 1.15 : 1,
                      y: isSelected ? -8 : 0, 
                      rotate: gameMode === GameMode.LOCAL_PVP 
                        ? (gameState.turn === 'w' ? 0 : 180)
                        : 0
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ 
                      layout: { type: "spring", stiffness: 300, damping: 25 },
                      rotate: { duration: 0.3, ease: "easeInOut" },
                      opacity: { duration: 0.2 },
                      scale: { duration: 0.2 },
                      y: { type: "spring", stiffness: 300, damping: 20 }
                    }}
                    // We use piece props for key to help Framer Motion track identity
                    key={`${piece.color}${piece.type}-${square}`} 
                    id={`piece-${piece.color}-${piece.type}-${square}`}
                    src={PIECES[`${piece.color}${piece.type.toUpperCase()}`]} 
                    alt={`${piece.color} ${piece.type}`}
                    className={`chess-piece ${isSelected ? 'selected' : ''} m-auto z-20`}
                    referrerPolicy="no-referrer"
                />
              )}
            </AnimatePresence>
          </div>
        );
      }
    }
    return board;
  }, [game, gameState.history, selectedSquare, possibleMoves, gameMode, gameState.turn]);

  const getPlayerLabel = (color: Color) => {
    if (gameMode === GameMode.MULTIPLAYER) {
      if (playerNames[color]) return playerNames[color];
      if (multiplayerData?.players[color] === user?.uid) return user?.displayName || 'You';
      return multiplayerData?.players[color] ? 'Loading name...' : 'Waiting...';
    }
    if (gameMode === GameMode.VS_AI) {
      return color === 'w' ? 'You' : 'Chesko';
    }
    return color === 'w' ? 'White Player' : 'Black Player';
  };

  return (
    <div className={`w-full relative mx-auto transition-all duration-500 ${isFullscreen ? 'max-w-4xl scale-110' : 'max-w-[540px]'}`}>
      <div className="mb-6 flex justify-between items-center bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-700/50 shadow-xl">
        <div className="flex items-center gap-4">
           <div className={`w-3.5 h-3.5 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 ${gameState.turn === 'w' ? 'bg-white ring-white/20' : 'bg-slate-700 ring-transparent'}`}></div>
           <TimeDisplay seconds={whiteTime} active={gameState.turn === 'w'} label={getPlayerLabel('w')} />
        </div>
        
        <div className="px-4 py-2 bg-slate-800/80 rounded-lg border border-slate-700/50 flex flex-col items-center justify-center relative group">
            {gameState.inCheck ? (
                <span className="text-red-500 font-black text-xs tracking-tighter animate-bounce px-2 py-0.5 bg-red-500/10 rounded">CHECK</span>
            ) : (
                <span className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.2em]">Match</span>
            )}
            
            {toggleFullscreen && (
              <button 
                onClick={toggleFullscreen}
                className="mt-2 p-1.5 hover:bg-slate-700 text-slate-400 hover:text-amber-500 transition-colors rounded-md"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            )}
        </div>

        <div className="flex items-center gap-4">
           <TimeDisplay seconds={blackTime} active={gameState.turn === 'b'} label={getPlayerLabel('b')} isBlack />
           <div className={`w-3.5 h-3.5 rounded-full ring-2 ring-offset-2 ring-offset-slate-900 ${gameState.turn === 'b' ? 'bg-amber-500 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-700 ring-transparent'}`}></div>
        </div>
      </div>

      {/* AI Analyzing Bar moved outside and above the board */}
      <div className="h-10 flex items-center justify-center -mb-2 relative z-50">
        <AnimatePresence>
          {isAiThinking && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-none"
            >
              <div className="bg-slate-900 border border-amber-500/40 px-6 py-2 rounded-xl flex items-center gap-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] backdrop-blur-md">
                <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="flex items-center gap-3">
                  <span className="text-amber-500 font-black text-[9px] tracking-[0.2em] uppercase whitespace-nowrap">Chesko</span>
                  <div className="w-px h-3 bg-slate-800"></div>
                  <span className="text-slate-300 text-[10px] font-bold whitespace-nowrap animate-pulse lowercase tracking-wide">Analyzing Position...</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="board-container p-2 sm:p-4 relative">
        <div className="chess-board-grid w-full rounded-sm">
          {boardSquares}
        </div>
      </div>
    </div>
  );
};

export default GameInterface;
