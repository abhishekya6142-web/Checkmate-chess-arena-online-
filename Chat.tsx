
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, AnonymousUser } from '../types';
import { sendChatMessage, subscribeToChatMessages } from '../services/multiplayerService';
import { Send, MessageSquare } from 'lucide-react';

interface ChatProps {
  gameId: string;
  user: AnonymousUser;
}

const Chat: React.FC<ChatProps> = ({ gameId, user }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToChatMessages(gameId, (msgs) => {
      setMessages(msgs);
    }, user.uid);
    return () => unsubscribe();
  }, [gameId, user.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await sendChatMessage(gameId, user.uid, user.displayName, newMessage.trim());
    setNewMessage('');
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 h-[450px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-amber-500 flex items-center gap-2">
              <MessageSquare size={18} /> Game Chat
            </h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div 
            ref={scrollRef}
            className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/20"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-sm text-center p-6">
                <p>No messages yet.</p>
                <p className="mt-1">Be respectful and have fun!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                      {msg.senderId === user.uid ? 'You' : msg.senderName}
                    </span>
                  </div>
                  <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] ${
                    msg.senderId === user.uid 
                      ? 'bg-amber-600 text-white rounded-tr-none' 
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-500 text-slate-100 transition-all"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:hover:bg-amber-600 p-2 rounded-xl text-white transition-all shadow-lg shadow-amber-600/20"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border-2 ${
          isOpen 
            ? 'bg-slate-800 border-slate-700 text-amber-500' 
            : 'bg-amber-600 border-amber-500 text-white animate-bounce-slow'
        }`}
      >
        <MessageSquare size={24} />
        {messages.length > 0 && !isOpen && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold">
            {messages.length > 9 ? '9+' : messages.length}
          </div>
        )}
      </button>

      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Chat;
