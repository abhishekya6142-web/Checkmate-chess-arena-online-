
import React, { useState, useEffect } from 'react';
import { MultiplayerGame, GameSettings, AnonymousUser } from '../types';
import { getAvailableGames, createGame, joinGame } from '../services/multiplayerService';
import { Plus, Play, RefreshCw, User as UserIcon } from 'lucide-react';

interface LobbyProps {
  onJoinGame: (gameId: string) => void;
  user: AnonymousUser | null;
  settings: GameSettings;
}

const Lobby: React.FC<LobbyProps> = ({ onJoinGame, user, settings }) => {
  const [games, setGames] = useState<MultiplayerGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchGames = async () => {
    setLoading(true);
    const availableGames = await getAvailableGames(user?.uid);
    setGames(availableGames);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchGames();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleCreateGame = async () => {
    if (!user) return;
    setCreating(true);
    const gameId = await createGame(user.uid, settings.startingFen === 'start' ? undefined : settings.startingFen);
    if (gameId) {
      onJoinGame(gameId);
    }
    setCreating(false);
  };

  const handleJoinGame = async (gameId: string) => {
    if (!user) return;
    const success = await joinGame(gameId, user.uid);
    if (success) {
      onJoinGame(gameId);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 border-2 border-amber-500/50 shadow-lg">
            <UserIcon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-amber-500">Multiplayer Lobby</h2>
            <p className="text-slate-400 text-sm">Welcome back, <span className="text-slate-200 font-medium">{user?.displayName || 'Grandmaster'}</span></p>
          </div>
        </div>
        <button 
          onClick={fetchGames}
          disabled={loading}
          className={`p-3 rounded-xl transition-all border ${loading ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:text-amber-500 hover:border-amber-500/30 hover:bg-slate-800'}`}
          title="Refresh games"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : 'transition-transform hover:rotate-180 duration-500'} />
        </button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 mb-8">
          <button 
            onClick={handleCreateGame}
            disabled={creating}
            className="flex items-center justify-center gap-3 bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {creating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Creating Game...
              </>
            ) : (
              <>
                <Plus size={24} className="group-hover:rotate-90 transition-transform" />
                Create New Game
              </>
            )}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Available Games
              {!loading && games.length > 0 && (
                <span className="bg-amber-600/20 text-amber-500 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  {games.length}
                </span>
              )}
            </h3>
            {!loading && (
              <span className="text-[10px] text-slate-600 uppercase tracking-tighter">
                Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/20 rounded-2xl border border-dashed border-slate-800">
              <Play size={48} className="mx-auto text-slate-700 mb-4" />
              <p className="text-slate-500">No games waiting for players.</p>
              <p className="text-slate-600 text-sm">Be the first to create one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {games.map(game => (
                <div 
                  key={game.id}
                  className="flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-amber-500">
                      <UserIcon size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-200">Game #{game.id.slice(-4)}</p>
                      <p className="text-xs text-slate-500">Waiting for opponent...</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleJoinGame(game.id)}
                    className="px-6 py-2 bg-slate-700 hover:bg-amber-600 text-white rounded-lg font-bold transition-all group-hover:scale-105"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Lobby;
