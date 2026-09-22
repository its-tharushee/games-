import React from 'react';
import { FloatingReaction } from '../hooks/useMultiplayerSocket';
import { sounds } from '../utils/sound';

interface ReactionsBarProps {
  reactions: FloatingReaction[];
  onSendReaction: (emoji: string) => void;
  disabled?: boolean;
}

const EMOJIS = ['🔥', '👏', '😎', '😱', '🤔', '🏆', '💥', '🤝'];

export const ReactionsBar: React.FC<ReactionsBarProps> = ({
  reactions,
  onSendReaction,
  disabled = false,
}) => {
  const handleEmojiClick = (emoji: string) => {
    if (disabled) return;
    sounds.playReaction();
    onSendReaction(emoji);
  };

  return (
    <div className="relative w-full">
      {/* Floating Reaction Bubbles */}
      <div className="absolute -top-16 left-0 right-0 pointer-events-none flex justify-center items-center h-16 overflow-visible z-20">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute animate-bounce flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/90 text-white shadow-xl backdrop-blur-sm border border-zinc-700/60 transition-all text-sm font-medium"
            style={{
              animationDuration: '1.8s',
            }}
          >
            <span className="text-xl">{r.emoji}</span>
            <span className="text-xs text-zinc-300">{r.fromName}</span>
          </div>
        ))}
      </div>

      {/* Reaction Buttons */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 p-2 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 backdrop-blur-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-1 hidden sm:inline">
          React:
        </span>
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            id={`reaction-btn-${emoji}`}
            type="button"
            disabled={disabled}
            onClick={() => handleEmojiClick(emoji)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-white dark:hover:bg-zinc-700 flex items-center justify-center text-lg sm:text-xl transition-transform hover:scale-125 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 focus:outline-none"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
