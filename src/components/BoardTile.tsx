import React from 'react';
import { PlayerSymbol } from '../types';

interface BoardTileProps {
  index: number;
  value: PlayerSymbol | null;
  isWinningTile: boolean;
  isLastMove: boolean;
  previewSymbol: PlayerSymbol | null;
  disabled: boolean;
  onClick: (index: number) => void;
}

export const BoardTile: React.FC<BoardTileProps> = ({
  index,
  value,
  isWinningTile,
  isLastMove,
  previewSymbol,
  disabled,
  onClick,
}) => {
  const handleClick = () => {
    if (!disabled && value === null) {
      onClick(index);
    }
  };

  return (
    <button
      id={`board-tile-${index}`}
      type="button"
      onClick={handleClick}
      disabled={disabled || value !== null}
      aria-label={`Tile ${index + 1}: ${value || 'empty'}`}
      className={`group relative aspect-square w-full rounded-2xl flex items-center justify-center transition-all duration-200 select-none
        ${
          isWinningTile
            ? value === 'X'
              ? 'bg-indigo-100 dark:bg-indigo-950/80 border-2 border-indigo-500 shadow-md shadow-indigo-500/20'
              : 'bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-500 shadow-md shadow-rose-500/20'
            : 'bg-white dark:bg-zinc-800/90 border border-zinc-200/90 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-sm'
        }
        ${
          !disabled && value === null
            ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
            : 'cursor-default'
        }
        ${isLastMove && !isWinningTile ? 'ring-2 ring-indigo-400/40 dark:ring-indigo-500/40' : ''}
      `}
    >
      {/* Existing Value */}
      {value === 'X' && (
        <svg
          className={`w-12 h-12 sm:w-16 sm:h-16 text-indigo-600 dark:text-indigo-400 drop-shadow-sm transition-transform duration-200 ${
            isWinningTile ? 'scale-110' : 'scale-100'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}

      {value === 'O' && (
        <svg
          className={`w-12 h-12 sm:w-16 sm:h-16 text-rose-500 dark:text-rose-400 drop-shadow-sm transition-transform duration-200 ${
            isWinningTile ? 'scale-110' : 'scale-100'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      )}

      {/* Ghost hover preview when it's your turn */}
      {value === null && !disabled && previewSymbol && (
        <div className="opacity-0 group-hover:opacity-30 transition-opacity duration-150 pointer-events-none">
          {previewSymbol === 'X' ? (
            <svg
              className="w-10 h-10 sm:w-14 sm:h-14 text-indigo-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              className="w-10 h-10 sm:w-14 sm:h-14 text-rose-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="8.5" />
            </svg>
          )}
        </div>
      )}

      {/* Last move badge dot */}
      {isLastMove && !isWinningTile && (
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
      )}
    </button>
  );
};
