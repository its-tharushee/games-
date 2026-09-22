import React, { useState } from 'react';
import { Volume2, VolumeX, Wifi, WifiOff, Users, Info } from 'lucide-react';
import { sounds } from '../utils/sound';

interface HeaderProps {
  isConnected: boolean;
  gameMode: string;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, gameMode }) => {
  const [soundEnabled, setSoundEnabled] = useState(sounds.enabled);
  const [showInfo, setShowInfo] = useState(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    sounds.enabled = next;
    setSoundEnabled(next);
    if (next) sounds.playPop();
  };

  return (
    <header className="w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* App Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20 text-white font-black text-xl tracking-tight">
            ✕
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Tic Tac Toe
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                Multiplayer
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Real-time online & local board gaming
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {gameMode === 'online' && (
            <div
              id="ws-status-badge"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 animate-pulse'
              }`}
              title={isConnected ? 'Connected to game server' : 'Reconnecting to game server...'}
            >
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">Server Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Connecting...</span>
                </>
              )}
            </div>
          )}

          {/* Sound Toggle */}
          <button
            id="sound-toggle-btn"
            onClick={toggleSound}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            title={soundEnabled ? 'Sound is ON' : 'Sound is MUTED'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> : <VolumeX className="w-5 h-5 text-zinc-400" />}
          </button>

          {/* Rules / Help button */}
          <button
            id="rules-toggle-btn"
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="How to play"
            title="How to play"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Rules Info Modal/Dropdown */}
      {showInfo && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/90 px-4 py-3">
          <div className="max-w-4xl mx-auto text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-900 dark:text-zinc-200">How to Play Online:</p>
            <p>1. Enter your display name and click <strong>Create Game</strong> or <strong>Quick Match</strong>.</p>
            <p>2. Share the 6-character room code or invite link with a friend.</p>
            <p>3. Align 3 symbols in a row (horizontal, vertical, or diagonal) to win!</p>
            <p>4. Send fun instant emoji reactions and request rematches after rounds.</p>
          </div>
        </div>
      )}
    </header>
  );
};
