
import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Square } from 'chess.js';
import GameInterface from './components/GameInterface';
import Lobby from './components/Lobby';
import Profile from './components/Profile';
import Chat from './components/Chat';
import { GameMode, GameState, Color, MultiplayerGame, GameSettings, AnonymousUser } from './types';
import { Trophy, Users, Cpu, RotateCcw, Search, Globe, LogIn, LogOut, User as UserIcon, Share2, Check, Settings, Play, Maximize, Minimize, Loader2, UserPlus, Volume2, VolumeX, Brain, Zap } from 'lucide-react';
import { getAIMove } from './services/geminiService';
import { getBestMove } from './services/chessAiService';
import { db, auth } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { subscribeToGame, updateGameMove, joinGame } from './services/multiplayerService';
import { saveUserProfile } from './services/userService';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { soundService, ChessSound } from './services/soundService';

// Helper component to handle room parameter from URL
const RoomRedirect: React.FC<{ setMultiplayerGameId: (id: string) => void; setGameMode: (m: GameMode) => void }> = ({ setMultiplayerGameId, setGameMode }) => {
  const { roomId } = useParams<{ roomId: string }>();
  useEffect(() => {
    if (roomId) {
      setGameMode(GameMode.MULTIPLAYER);
      setMultiplayerGameId(roomId);
    }
  }, [roomId, setMultiplayerGameId, setGameMode]);
  return null;
};

const App: React.FC = () => {
  const [user, setUser] = useState<AnonymousUser | null>(null);
  const [isSettingUpName, setIsSettingUpName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [game, setGame] = useState(new Chess());
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.VS_AI);
  const [multiplayerGameId, setMultiplayerGameId] = useState<string | null>(null);
  const [multiplayerData, setMultiplayerData] = useState<MultiplayerGame | null>(null);
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    startingFen: 'start',
    timeControl: 10,
    aiDifficulty: 'medium',
    enableSound: true,
    aiType: 'engine'
  });
  const [gameState, setGameState] = useState<GameState>({
    fen: game.fen(),
    history: [],
    isGameOver: false,
    winner: null,
    turn: 'w',
    inCheck: false
  });

  useEffect(() => {
    // 1. Listen for Firebase Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const savedName = localStorage.getItem('player_name');
      
      if (firebaseUser) {
        if (savedName) {
          setUser({ uid: firebaseUser.uid, displayName: savedName });
          setIsSettingUpName(false);
          // Ensure Firestore has the latest name
          saveUserProfile(firebaseUser.uid, savedName);
        } else {
          setUser({ uid: firebaseUser.uid, displayName: '' });
          setIsSettingUpName(true);
        }
      } else {
        // 2. If not signed in, sign in anonymously
        signInAnonymously(auth).catch(err => {
          console.error("[Auth Error]", err);
        });
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleSetupName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;
    if (!auth.currentUser) return;
    
    const displayName = tempName.trim();
    localStorage.setItem('player_name', displayName);
    setUser({ uid: auth.currentUser.uid, displayName });
    
    // Sync to Firestore
    await saveUserProfile(auth.currentUser.uid, displayName);
    
    setIsSettingUpName(false);
  };

  // Handle deep link room joining and state sync with URL
  useEffect(() => {
    const handleRoomJoin = async () => {
      const match = location.pathname.match(/\/room\/([a-zA-Z0-9_\-]+)/);
      const gameIdFromUrl = match ? match[1] : null;
      
      if (gameIdFromUrl) {
        if (gameIdFromUrl !== multiplayerGameId) {
          setRoomError(null);
          setGameMode(GameMode.MULTIPLAYER);
          setMultiplayerGameId(gameIdFromUrl);
        }

        // Only attempt backend join if we have a user
        if (user) {
          setIsJoiningRoom(true);
          try {
            const success = await joinGame(gameIdFromUrl, user.uid);
            if (!success) {
              setRoomError("This room might be full, expired, or doesn't exist.");
              setMultiplayerGameId(null);
            }
          } catch (err) {
            console.error("[Room Join Error]", err);
            setRoomError("Connection failed. Please check your network.");
          } finally {
            setIsJoiningRoom(false);
          }
        }
      } else if (location.pathname === '/' && multiplayerGameId) {
        // If we navigated away from room to root, clear multiplayer state
        setMultiplayerGameId(null);
        setMultiplayerData(null);
      }
    };
    handleRoomJoin();
  }, [location.pathname, user, multiplayerGameId]);

  useEffect(() => {
    if (gameMode === GameMode.MULTIPLAYER && multiplayerGameId) {
      const unsubscribe = subscribeToGame(multiplayerGameId, (data) => {
        setMultiplayerData(data);
        if (data.fen !== game.fen()) {
          const newGame = new Chess(data.fen);
          // Detect move for sound from history diff
          const oldHistoryCount = game.history().length;
          const newHistory = newGame.history({ verbose: true });
          
          setGame(newGame);
          
          if (newHistory.length > oldHistoryCount) {
            const lastMove = newHistory[newHistory.length - 1];
            // We use the new game object state (check/mate) to play the sound
            if (newGame.isCheckmate()) {
              soundService.play(ChessSound.CHECKMATE);
            } else if (newGame.isCheck()) {
              soundService.play(ChessSound.CHECK);
            } else if (lastMove.captured || lastMove.flags.includes('e')) {
              soundService.play(ChessSound.CAPTURE);
            } else {
              soundService.play(ChessSound.MOVE);
            }
          }

          setGameState({
            fen: data.fen,
            history: newHistory,
            isGameOver: newGame.isGameOver(),
            winner: data.winner as Color | 'draw' | null,
            turn: newGame.turn(),
            inCheck: newGame.isCheck()
          });
        }
      }, user?.uid || undefined);
      return () => unsubscribe();
    }
  }, [gameMode, multiplayerGameId, user?.uid]);

  useEffect(() => {
    soundService.setEnabled(gameSettings.enableSound !== false);
  }, [gameSettings.enableSound]);

  const playMoveSound = useCallback((moveResult: any) => {
    if (game.isCheckmate()) {
      soundService.play(ChessSound.CHECKMATE);
    } else if (game.isCheck()) {
      soundService.play(ChessSound.CHECK);
    } else if (moveResult && (moveResult.captured || moveResult.flags.includes('e'))) {
      soundService.play(ChessSound.CAPTURE);
    } else {
      soundService.play(ChessSound.MOVE);
    }
  }, [game]);

  const updateGameState = useCallback(() => {
    const newFen = game.fen();
    const newHistory = game.history({ verbose: true });
    const isGameOver = game.isGameOver();
    const winner = game.isCheckmate() ? (game.turn() === 'w' ? 'b' : 'w') : game.isDraw() ? 'draw' : null;
    const turn = game.turn();
    const inCheck = game.isCheck();

    console.log(`[GameState Update] Turn: ${turn}, FEN: ${newFen}, GameOver: ${isGameOver}`);

    setGameState({
      fen: newFen,
      history: newHistory,
      isGameOver,
      winner,
      turn,
      inCheck
    });

    if (gameMode === GameMode.MULTIPLAYER && multiplayerGameId) {
      updateGameMove(
        multiplayerGameId, 
        newFen, 
        newHistory.map(m => m.san || ''), 
        turn, 
        winner,
        user?.uid
      );
    }
  }, [game, gameMode, multiplayerGameId, user?.uid]);

  const makeMove = (move: string | { from: string; to: string; promotion?: string }) => {
    if (gameMode === GameMode.VS_AI && game.turn() === 'b' && !isAiThinking) {
      console.warn("Player tried to move during AI turn");
      return false;
    }

    if (gameMode === GameMode.MULTIPLAYER) {
      if (!user || !multiplayerData) return false;
      const playerColor = multiplayerData.players.w === user.uid ? 'w' : 'b';
      if (game.turn() !== playerColor) return false;
    }

    try {
      console.log(`[Move Attempt] ${typeof move === 'string' ? move : `${move.from}->${move.to}`}`);
      const result = game.move(move);
      if (result) {
        playMoveSound(result);
        updateGameState();
        return true;
      }
    } catch (e) {
      console.error("[Move Error]", e);
      return false;
    }
    return false;
  };

  // AI Move Handling
  useEffect(() => {
    if (gameMode === GameMode.VS_AI && gameState.turn === 'b' && !gameState.isGameOver && !isAiThinking) {
      const triggerAi = async () => {
        setIsAiThinking(true);
        console.log("[AI] Thinking started...");
        
        try {
          // Small delay for natural feel
          await new Promise(r => setTimeout(r, 1000));
          
          let moveSan = "";
          if (gameSettings.aiType === 'gemini') {
            moveSan = await getAIMove(game.fen(), gameSettings.aiDifficulty);
            console.log(`[AI] Gemini suggested move: ${moveSan}`);
          } else {
            // Use custom engine
            moveSan = getBestMove(game, gameSettings.aiDifficulty);
            console.log(`[AI] Engine suggested move: ${moveSan}`);
          }
          
          if (moveSan) {
            const result = game.move(moveSan);
            if (result) {
              playMoveSound(result);
              console.log("[AI] Move executed successfully");
            } else {
              throw new Error("AI suggested invalid move: " + moveSan);
            }
          } else {
            throw new Error("AI failed to provide a move");
          }
        } catch (err) {
          console.error("[AI] Error:", err);
          // Fallback: random move
          const moves = game.moves();
          if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            const result = game.move(randomMove);
            if (result) playMoveSound(result);
            console.log(`[AI] Fallback random move executed: ${randomMove}`);
          }
        } finally {
          setIsAiThinking(false);
          updateGameState();
        }
      };
      
      triggerAi();
    }
  }, [gameState.turn, gameMode, gameState.isGameOver, game, gameSettings.aiDifficulty, isAiThinking, updateGameState]);

  const handleUndo = () => {
    if (gameMode === GameMode.MULTIPLAYER || isAiThinking) return;

    if (gameMode === GameMode.VS_AI) {
      // If it is currently AI's turn to move, we only need to undo once (our move)
      // Otherwise, the AI has already moved, so we undo twice (AI move + our move)
      if (game.turn() === 'b') {
        game.undo();
      } else {
        game.undo();
        game.undo();
      }
    } else {
      game.undo();
    }
    updateGameState();
  };

  const resetGame = (settings?: GameSettings) => {
    const activeSettings = settings || gameSettings;
    const newGame = new Chess(activeSettings.startingFen === 'start' ? undefined : activeSettings.startingFen);
    
    soundService.play(ChessSound.GAME_START);

    setGame(newGame);
    setGameState({
      fen: newGame.fen(),
      history: [],
      isGameOver: false,
      winner: null,
      turn: 'w',
      inCheck: false
    });
    setMultiplayerGameId(null);
    setMultiplayerData(null);
    setIsConfiguring(false);
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const handleJoinMultiplayer = async (gameId: string) => {
    if (!gameId) return;
    navigate(`/room/${gameId}`);
  };

  const copyInviteLink = async () => {
    if (!multiplayerGameId) return;
    const url = `${window.location.origin}/room/${multiplayerGameId}`;
    
    // Use native share if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Chess game!',
          text: 'I am waiting for you in Checkmate Arena. Let\'s play!',
          url: url
        });
        return;
      } catch (err) {
        // Fallback to clipboard if share cancelled
        console.log('Native share failed or cancelled');
      }
    }

    navigator.clipboard.writeText(url);
    setShowShareTooltip(true);
    setTimeout(() => setShowShareTooltip(false), 2000);
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col items-center bg-slate-950 text-slate-100 transition-all duration-500 ${isFullscreen ? 'p-0' : 'p-4 md:p-8'}`}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomRedirect setMultiplayerGameId={setMultiplayerGameId} setGameMode={setGameMode} />} />
        <Route path="*" element={null} />
      </Routes>
      {isJoiningRoom && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
          <h2 className="text-2xl font-bold">Connecting...</h2>
          <p className="text-slate-400">Joining professional room</p>
        </div>
      )}

      {roomError && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-lg p-6">
          <div className="bg-slate-900 border border-red-500/30 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <LogOut className="text-red-500 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Room Error</h2>
            <p className="text-slate-400 mb-8">{roomError}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setRoomError(null); setMultiplayerGameId(null); navigate('/'); }}
                className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold transition-all"
              >
                Return to Lobby
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-amber-600 hover:bg-amber-500 py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-600/20"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {multiplayerGameId && !multiplayerData && gameMode === GameMode.MULTIPLAYER && user && !roomError && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-slate-950">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
          <p className="text-slate-400">Loading match data...</p>
        </div>
      )}
      {!isFullscreen && (
        <header className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4 animate-in fade-in slide-in-from-top-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-amber-500">Checkmate Arena</h1>
            <p className="text-slate-400 text-sm">Elevate your game</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button 
              onClick={() => { setGameMode(GameMode.VS_AI); resetGame(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${gameMode === GameMode.VS_AI ? 'bg-amber-600 text-white' : 'hover:bg-slate-800'}`}
            >
              <Cpu size={18} /> <span className="hidden sm:inline">vs Chesko</span>
            </button>
            <button 
              onClick={() => { setGameMode(GameMode.LOCAL_PVP); resetGame(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${gameMode === GameMode.LOCAL_PVP ? 'bg-amber-600 text-white' : 'hover:bg-slate-800'}`}
            >
              <Users size={18} /> <span className="hidden sm:inline">Local PvP</span>
            </button>
            <button 
              onClick={() => { setGameMode(GameMode.MULTIPLAYER); resetGame(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${gameMode === GameMode.MULTIPLAYER ? 'bg-amber-600 text-white' : 'hover:bg-slate-800'}`}
            >
              <Globe size={18} /> <span className="hidden sm:inline">Multiplayer</span>
            </button>

            <div className="w-px bg-slate-800 mx-1 hidden sm:block"></div>

            <button 
              onClick={toggleFullscreen}
              className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-all"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>

            <div className="w-px bg-slate-800 mx-1 hidden sm:block"></div>

            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-800 ml-1">
                <button 
                  onClick={() => navigate('/profile')}
                  className="flex flex-col items-end hidden sm:flex text-right hover:text-amber-500 transition-colors"
                >
                  <span className="text-xs font-bold leading-none">{user.displayName}</span>
                  <span className="text-[10px] text-slate-500 leading-none mt-1">Anonymous Player</span>
                </button>
                <button 
                  onClick={() => navigate('/profile')}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 shadow-lg hover:border-amber-500/50 hover:text-amber-500 transition-all"
                >
                  <UserIcon size={14} />
                </button>
                <button 
                  onClick={() => setIsSettingUpName(true)}
                  className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-all"
                  title="Change Name Quick"
                >
                  <Settings size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsSettingUpName(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md transition-all hover:bg-amber-600/20 text-amber-500"
              >
                <UserIcon size={18} />
                <span className="hidden sm:inline">Set Profile</span>
              </button>
            )}
          </div>
        </header>
      )}

      {isSettingUpName && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
          <form 
            onSubmit={handleSetupName}
            className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 bg-amber-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserPlus className="text-amber-500 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-center">Your Profile</h2>
            <p className="text-slate-400 mb-6 text-center text-sm">Enter a display name to join the Checkmate Arena.</p>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Display Name</label>
              <input 
                autoFocus
                type="text" 
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="e.g. Grandmaster Chess"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 transition-all text-slate-100"
                maxLength={20}
                required
              />
            </div>
            
            <button 
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-500 py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-600/20"
            >
              Start Playing
            </button>
          </form>
        </div>
      )}

      <main className={`w-full transition-all duration-500 ${isFullscreen ? 'max-w-none h-screen flex flex-col items-center justify-center bg-slate-950' : 'max-w-6xl'}`}>
        {isFullscreen && (
          <button 
            onClick={toggleFullscreen}
            className="fixed top-6 right-6 p-4 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-400 hover:text-red-400 z-[100] transition-all hover:scale-110 shadow-2xl"
            title="Exit Fullscreen"
          >
            <Minimize size={24} />
          </button>
        )}
        {gameMode === GameMode.MULTIPLAYER && !multiplayerGameId ? (
          <Lobby user={user} onJoinGame={handleJoinMultiplayer} settings={gameSettings} />
        ) : gameMode === GameMode.MULTIPLAYER && multiplayerGameId && !user ? (
          <div className="w-full max-w-md mx-auto bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center shadow-2xl">
            <Loader2 size={64} className="mx-auto text-amber-500 mb-6 animate-spin opacity-50" />
            <h2 className="text-2xl font-bold mb-4">Initializing Session</h2>
            <p className="text-slate-400 mb-8">Preparing your professional anonymous identity...</p>
          </div>
        ) : location.pathname === '/profile' ? (
          <Profile user={user} onUpdateName={(name) => setUser(prev => prev ? { ...prev, displayName: name } : null)} />
        ) : (
            <div className={isFullscreen ? "w-full max-w-5xl flex items-center justify-center" : "w-full max-w-3xl mx-auto flex flex-col items-center"}>
              <div className="w-full flex flex-col items-center">
                <GameInterface 
                  game={game} 
                  gameState={gameState} 
                  makeMove={makeMove} 
                  gameMode={gameMode}
                  user={user}
                  multiplayerData={multiplayerData}
                  settings={gameSettings}
                  isFullscreen={isFullscreen}
                  toggleFullscreen={toggleFullscreen}
                  isAiThinking={isAiThinking}
                />
                
                {!isFullscreen && (
                  <div className="mt-6 flex flex-col gap-4 w-full">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button 
                        onClick={() => setIsConfiguring(true)}
                        className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl border border-slate-700 transition-colors"
                      >
                        <Settings size={18} /> <span className="hidden sm:inline">Settings</span>
                      </button>
                      
                      {gameMode === GameMode.MULTIPLAYER ? (
                        <>
                          <button 
                            onClick={() => resetGame()}
                            className="flex items-center justify-center gap-2 bg-red-900/10 hover:bg-red-900/20 text-red-400 py-3 rounded-xl border border-red-900/20 transition-colors font-bold"
                          >
                            <RotateCcw size={18} /> <span className="hidden sm:inline">Lobby</span>
                          </button>
                          <button 
                            onClick={copyInviteLink}
                            className="flex items-center justify-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 py-3 rounded-xl border border-amber-500/30 transition-all relative overflow-hidden group col-span-2"
                          >
                            {showShareTooltip ? <Check size={18} /> : <Share2 size={18} />}
                            <span>{showShareTooltip ? "Copied!" : "Copy Invite Link"}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => resetGame()}
                            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl border border-slate-700 transition-colors"
                          >
                            <RotateCcw size={18} /> <span className="hidden sm:inline">Reset</span>
                          </button>
                          <button 
                            onClick={handleUndo}
                            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl border border-slate-700 transition-colors"
                            disabled={gameState.history.length === 0 || isAiThinking}
                          >
                            Undo
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
        )}
        
        {gameMode === GameMode.MULTIPLAYER && multiplayerGameId && user && (
          <Chat gameId={multiplayerGameId} user={user} />
        )}
      </main>

      {gameState.isGameOver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-amber-500/30 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
            <Trophy className="mx-auto text-amber-500 mb-4" size={64} />
            <h2 className="text-3xl font-bold mb-2">
              {gameState.winner === 'draw' ? "It's a Draw!" : `${gameState.winner === 'w' ? 'White' : 'Black'} Wins!`}
            </h2>
            <p className="text-slate-400 mb-6">Excellent game. Ready for another match?</p>
            <button 
              onClick={() => setIsConfiguring(true)}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-all"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {isConfiguring && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
                <Settings size={24} /> Game Settings
              </h2>
              <button 
                onClick={() => setIsConfiguring(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    {gameSettings.enableSound ? <Volume2 size={18} className="text-amber-500" /> : <VolumeX size={18} className="text-slate-500" />}
                    Sound Effects
                  </h3>
                  <p className="text-xs text-slate-500">Subtle alerts for moves and captures</p>
                </div>
                <button 
                  onClick={() => setGameSettings(s => ({ ...s, enableSound: !s.enableSound }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${gameSettings.enableSound ? 'bg-amber-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${gameSettings.enableSound ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Chesko Model</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setGameSettings(s => ({ ...s, aiType: 'engine' }))}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${gameSettings.aiType === 'engine' ? 'bg-amber-600/20 border-amber-500 text-amber-500 shadow-lg shadow-amber-500/10' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                    <Zap size={16} /> Pro Engine
                  </button>
                  <button 
                    onClick={() => setGameSettings(s => ({ ...s, aiType: 'gemini' }))}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${gameSettings.aiType === 'gemini' ? 'bg-amber-600/20 border-amber-500 text-amber-500 shadow-lg shadow-amber-500/10' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                    <Brain size={16} /> Gemini Brain
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map(diff => (
                    <button
                      key={diff}
                      onClick={() => setGameSettings(s => ({ ...s, aiDifficulty: diff }))}
                      className={`py-2 rounded-lg border transition-all capitalize ${gameSettings.aiDifficulty === diff ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Time Control (Minutes)</label>
                <input 
                  type="range" 
                  min="1" 
                  max="60" 
                  value={gameSettings.timeControl}
                  onChange={(e) => setGameSettings(s => ({ ...s, timeControl: parseInt(e.target.value) }))}
                  className="w-full accent-amber-500 bg-slate-800 rounded-lg h-2"
                />
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>1m</span>
                  <span className="text-amber-500 font-bold">{gameSettings.timeControl} minutes</span>
                  <span>60m</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Starting Position (FEN)</label>
                <input 
                  type="text"
                  value={gameSettings.startingFen}
                  onChange={(e) => setGameSettings(s => ({ ...s, startingFen: e.target.value }))}
                  placeholder="Leave as 'start' for default"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <button 
                onClick={() => resetGame()}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
              >
                <Play size={20} /> Start New Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
