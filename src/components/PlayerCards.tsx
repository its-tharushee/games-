import React from 'react';
import { PlayerSymbol, RoomPlayer } from '../types';
import { Wifi, WifiOff, Crown } from 'lucide-react';

interface PlayerCardsProps {
  playerX?: RoomPlayer;
  playerO?: RoomPlayer;
  currentTurn: PlayerSymbol;
  mySymbol?: PlayerSymbol | 'spectator' | null;
  round: number;
  drawCount: number;
  status: string;
}

export const PlayerCards: React.FC<PlayerCardsProps> = ({
  playerX,
  playerO,
  currentTurn,
  mySymbol,
  round,
  drawCount,
  status,
}) => {
  const isXTurn = currentTurn === 'X' && status === 'in_progress';
  const isOTurn = currentTurn === 'O' && status === 'in_progress';

  return (
    <div className="w-full max-w-md mx-auto grid grid-cols-7 gap-2 items-center my-4">
      {/* Player X Card */}
      <div
        id="player-card-x"
        className={`col-span-3 p-3 rounded-2xl transition-all border ${
          isXTurn
            ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-400/20 shadow-sm'
            : 'bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
              ✕
            </span>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[85px] sm:max-w-[110px]">
              {playerX ? playerX.name : 'Waiting...'}
            </span>
          </div>
          {mySymbol === 'X' && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              YOU
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {playerX?.score ?? 0}
          </span>
          <div className="flex items-center gap-1">
            {playerX && (
              playerX.connected ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-zinc-400" title="Disconnected" />
              )
            )}
            {isXTurn && (
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">
                Turn
              </span>
            )}
          </div>
        </div>
      </div>

      {/* VS / Middle Stats */}
      <div className="col-span-1 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
          VS
        </span>
        <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
          <div>R{round}</div>
          {drawCount > 0 && <div className="text-zinc-400">Draws: {drawCount}</div>}
        </div>
      </div>

      {/* Player O Card */}
      <div
        id="player-card-o"
        className={`col-span-3 p-3 rounded-2xl transition-all border ${
          isOTurn
            ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20 shadow-sm'
            : 'bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-lg bg-rose-500 text-white font-black text-xs flex items-center justify-center">
              ○
            </span>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[85px] sm:max-w-[110px]">
              {playerO ? playerO.name : 'Waiting...'}
            </span>
          </div>
          {mySymbol === 'O' && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
              YOU
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
            {playerO?.score ?? 0}
          </span>
          <div className="flex items-center gap-1">
            {playerO && (
              playerO.connected ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-zinc-400" title="Disconnected" />
              )
            )}
            {isOTurn && (
              <span className="text-[11px] font-bold text-rose-500 dark:text-rose-400 animate-pulse">
                Turn
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
