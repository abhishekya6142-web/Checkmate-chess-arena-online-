
import React, { useState, useEffect } from 'react';
import { AnonymousUser, UserProfile } from './types';
import { getUserProfile, saveUserProfile } from './userService';
import { User, Shield, Info, Edit2, Check, Clock, Trophy, History, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface ProfileProps {
  user: AnonymousUser | null;
  onUpdateName: (name: string) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdateName }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setLoading(true);
      const data = await getUserProfile(user.uid);
      if (data) {
        setProfile(data);
        setNewName(data.displayName);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user || !newName.trim()) return;
    setSaving(true);
    try {
      await saveUserProfile(user.uid, newName.trim());
      setProfile(prev => prev ? { ...prev, displayName: newName.trim() } : null);
      onUpdateName(newName.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
        <h2 className="text-2xl font-bold">Initializing profile...</h2>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-8 group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Arena
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 border-2 border-slate-700 shadow-xl mx-auto mb-6 relative">
              <User size={40} />
              <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <input 
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 focus:outline-none focus:border-amber-500 text-center"
                  maxLength={20}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={saving || !newName.trim()}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 p-2 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-slate-400 transition-all font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-slate-100">{profile?.displayName || user.displayName}</h2>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-slate-500 hover:text-amber-500 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-amber-500/70 font-mono tracking-widest uppercase">ID: {user.uid.slice(0, 12)}...</p>
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-slate-800 space-y-4 text-left">
              <div className="flex items-center gap-3 text-slate-400">
                <Shield size={16} className="text-amber-500" />
                <span className="text-xs font-medium">Anonymous Identity</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400">
                <Clock size={16} className="text-amber-500" />
                <span className="text-xs font-medium">Member since today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
              <Trophy className="text-amber-500 mb-2" size={20} />
              <div className="text-2xl font-bold">0</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Wins</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
              <History className="text-blue-500 mb-2" size={20} />
              <div className="text-2xl font-bold">0</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Played</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl col-span-2 sm:col-span-1">
              <Info className="text-purple-500 mb-2" size={20} />
              <div className="text-2xl font-bold">0%</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Win Rate</div>
            </div>
          </div>

          {/* Profile Sections */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-800 bg-slate-950/20">
              <h3 className="font-bold flex items-center gap-2">Experience & Level</h3>
            </div>
            <div className="p-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-400">Level 1 - Novice</span>
                <span className="text-xs font-mono text-amber-500">0 / 100 XP</span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-8">
                <div className="w-0 h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-1000"></div>
              </div>

              <div className="space-y-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Achievements</h4>
                <div className="flex flex-wrap gap-4 opacity-30 grayscale pointer-events-none">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center p-2">
                      <Trophy size={20} />
                    </div>
                  ))}
                  <p className="text-xs text-slate-600 mt-2 italic">Earn achievements by playing games and defeating the AI coach.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-800 bg-slate-950/20">
              <h3 className="font-bold flex items-center gap-2">Recent Match History</h3>
            </div>
            <div className="p-12 text-center">
              <History size={48} className="text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 italic">No matches played yet. Start a game to see your history!</p>
              <button 
                onClick={() => navigate('/')}
                className="mt-6 px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-600/20"
              >
                Play Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
