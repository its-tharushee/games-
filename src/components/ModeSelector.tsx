import React from 'react';
import { Globe, Users2, Bot } from 'lucide-react';
import { GameMode } from '../types';
import { sounds } from '../utils/sound';

interface ModeSelectorProps {
  currentMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  inActiveOnlineGame: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  inActiveOnlineGame,
}) => {
  const modes: { id: GameMode; label: string; icon: React.ReactNode }[] = [
    {
      id: 'online',
      label: 'Online Multiplayer',
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: 'local',
      label: 'Pass & Play (Local)',
      icon: <Users2 className="w-4 h-4" />,
    },
    {
      id: 'ai',
      label: 'Vs Computer',
      icon: <Bot className="w-4 h-4" />,
    },
  ];

  const handleSelect = (mode: GameMode) => {
    if (inActiveOnlineGame && mode !== 'online') {
      const confirmLeave = window.confirm(
        'Switching modes will leave your current online game room. Are you sure?'
      );
      if (!confirmLeave) return;
    }
    sounds.playPop();
    onSelectMode(mode);
  };

  return (
    <div className="flex items-center justify-center p-1.5 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 max-w-md mx-auto mb-6">
      {modes.map((m) => {
        const isActive = currentMode === m.id;
        return (
          <button
            key={m.id}
            id={`mode-tab-${m.id}`}
            type="button"
            onClick={() => handleSelect(m.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer select-none ${
              isActive
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            {m.icon}
            <span className="truncate">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
};
