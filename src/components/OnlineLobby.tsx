import React, { useState, useEffect } from 'react';
import { Play, Plus, RefreshCw, KeyRound, Dices, Copy, Check, Users, Sparkles } from 'lucide-react';
import { PublicRoomInfo } from '../types';
import { sounds } from '../utils/sound';

interface OnlineLobbyProps {
  onCreateRoom: (playerName: string, isPublic: boolean) => void;
  onJoinRoom: (code: string, playerName: string) => void;
  onQuickMatch: (playerName: string) => void;
  isConnected: boolean;
  errorMessage: string | null;
  clearError: () => void;
}

const FUN_NAMES = [
  'NeonFalcon', 'CosmicPanda', 'SwiftFox', 'ShadowWolf',
  'ThunderHawk', 'ApexTiger', 'PixelKnight', 'TurboOtter',
  'CyberViper', 'AstroNova', 'BlazeBadger', 'MysticOwl'
];

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({
  onCreateRoom,
  onJoinRoom,
  onQuickMatch,
  isConnected,
  errorMessage,
  clearError,
}) => {
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('ttt_player_name') || FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)];
  });
  const [joinCode, setJoinCode] = useState('');
  const [publicRooms, setPublicRooms] = useState<PublicRoomInfo[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isPublicGame, setIsPublicGame] = useState(true);

  // Check URL query parameters for ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setJoinCode(roomParam.toUpperCase());
    }
  }, []);

  const randomizeName = () => {
    sounds.playPop();
    const newName = FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)];
    setPlayerName(newName);
    localStorage.setItem('ttt_player_name', newName);
  };

  const fetchPublicRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const res = await fetch('/api/public-rooms');
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Failed to fetch public rooms', e);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchPublicRooms();
    const interval = setInterval(fetchPublicRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 18);
    setPlayerName(val);
    localStorage.setItem('ttt_player_name', val);
  };

  const handleQuickMatch = () => {
    if (!playerName.trim()) return;
    sounds.playPop();
    onQuickMatch(playerName.trim());
  };

  const handleCreate = () => {
    if (!playerName.trim()) return;
    sounds.playPop();
    onCreateRoom(playerName.trim(), isPublicGame);
  };

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinCode.trim() || !playerName.trim()) return;
    sounds.playPop();
    onJoinRoom(joinCode.trim().toUpperCase(), playerName.trim());
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Error Alert if any */}
      {errorMessage && (
        <div
          id="lobby-error-alert"
          className="flex items-center justify-between p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-sm"
        >
          <span>{errorMessage}</span>
          <button
            onClick={clearError}
            className="text-xs font-bold underline ml-3 cursor-pointer hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Player Profile & Name Setup */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 shadow-sm">
        <label htmlFor="player-name-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Your Player Display Name
        </label>
        <div className="flex items-center gap-2">
          <input
            id="player-name-input"
            type="text"
            value={playerName}
            onChange={handleNameChange}
            placeholder="Enter your name..."
            maxLength={18}
            className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <button
            id="random-name-btn"
            type="button"
            onClick={randomizeName}
            className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-700/80 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="Randomize Nickname"
          >
            <Dices className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Quick Match Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              Instant Matchmaking
            </div>
            <h3 className="text-xl font-bold mb-1">Quick Match</h3>
            <p className="text-xs text-indigo-100/90 leading-relaxed mb-4">
              Instantly jump into an active game or open a public match for incoming players.
            </p>
          </div>
          <button
            id="quick-match-btn"
            type="button"
            disabled={!isConnected}
            onClick={handleQuickMatch}
            className="w-full py-3 px-4 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            Find Opponent
          </button>
        </div>

        {/* Create Custom Room Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">
              Custom Lobby
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Create Room
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3">
              Generate a unique 6-character room code to invite a friend with an instant link.
            </p>

            <label className="flex items-center gap-2 mb-4 cursor-pointer text-xs text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={isPublicGame}
                onChange={(e) => setIsPublicGame(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700"
              />
              <span>List in public lobby directory</span>
            </label>
          </div>

          <button
            id="create-room-btn"
            type="button"
            disabled={!isConnected}
            onClick={handleCreate}
            className="w-full py-3 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Create Game Room
          </button>
        </div>
      </div>

      {/* Join with Room Code Form */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 shadow-sm">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Join With Room Code
        </h4>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            id="join-room-code-input"
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="e.g. ABC123"
            maxLength={8}
            className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono font-bold tracking-widest text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            id="join-room-btn"
            type="submit"
            disabled={!joinCode.trim() || !isConnected}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-40 cursor-pointer"
          >
            Join
          </button>
        </form>
      </div>

      {/* Public Rooms Directory */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-500" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Open Public Rooms
            </h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold">
              {publicRooms.length}
            </span>
          </div>
          <button
            id="refresh-rooms-btn"
            type="button"
            onClick={fetchPublicRooms}
            disabled={isLoadingRooms}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            title="Refresh room list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingRooms ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

        {publicRooms.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No public rooms waiting right now. Create one and others will join!
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {publicRooms.map((room) => (
              <div
                key={room.code}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
              >
                <div>
                  <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    {room.hostName}'s Game
                  </div>
                  <div className="text-[11px] font-mono text-zinc-400">
                    Room Code: <span className="font-bold text-indigo-600 dark:text-indigo-400">{room.code}</span>
                  </div>
                </div>
                <button
                  id={`join-public-room-${room.code}`}
                  type="button"
                  onClick={() => onJoinRoom(room.code, playerName)}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800/80 transition-colors cursor-pointer"
                >
                  Join Match
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
