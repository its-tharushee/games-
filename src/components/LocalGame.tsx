import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Award } from 'lucide-react';
import { Board, PlayerSymbol } from '../types';
import { BoardTile } from './BoardTile';
import { checkWinner, isBoardFull } from '../utils/ai';
import { sounds } from '../utils/sound';

export const LocalGame: React.FC = () => {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<PlayerSymbol>('X');
  const [winner, setWinner] = useState<PlayerSymbol | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null);
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });
  const [round, setRound] = useState(1);

  const handleTileClick = (index: number) => {
    if (board[index] || winner || isDraw) return;

    if (currentTurn === 'X') {
      sounds.playMoveX();
    } else {
      sounds.playMoveO();
    }

    const newBoard = [...board];
    newBoard[index] = currentTurn;
    setBoard(newBoard);
    setLastMoveIndex(index);

    const winCheck = checkWinner(newBoard);
    if (winCheck.winner) {
      setWinner(winCheck.winner);
      setWinningLine(winCheck.winningLine);
      setScores((prev) => ({ ...prev, [winCheck.winner!]: prev[winCheck.winner!] + 1 }));
      sounds.playWin();
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } else if (isBoardFull(newBoard)) {
      setIsDraw(true);
      setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
      sounds.playDraw();
    } else {
      setCurrentTurn((prev) => (prev === 'X' ? 'O' : 'X'));
    }
  };

  const handleNextRound = () => {
    sounds.playPop();
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setIsDraw(false);
    setLastMoveIndex(null);
    setRound((r) => r + 1);
    // Alternate starting symbol
    setCurrentTurn(round % 2 === 1 ? 'O' : 'X');
  };

  const handleResetScores = () => {
    sounds.playPop();
    setScores({ X: 0, O: 0, draws: 0 });
    setRound(1);
    handleNextRound();
  };

  const isGameOver = Boolean(winner || isDraw);

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Player Score Bar */}
      <div className="w-full max-w-md mx-auto grid grid-cols-7 gap-2 items-center">
        {/* Player X */}
        <div
          className={`col-span-3 p-3 rounded-2xl transition-all border ${
            currentTurn === 'X' && !isGameOver
              ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-400/20 shadow-sm'
              : 'bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                ✕
              </span>
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Player 1 (X)
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {scores.X}
            </span>
            {currentTurn === 'X' && !isGameOver && (
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">
                Turn
              </span>
            )}
          </div>
        </div>

        {/* VS stats */}
        <div className="col-span-1 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            VS
          </span>
          <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
            <div>R{round}</div>
            {scores.draws > 0 && <div className="text-zinc-400">Draws: {scores.draws}</div>}
          </div>
        </div>

        {/* Player O */}
        <div
          className={`col-span-3 p-3 rounded-2xl transition-all border ${
            currentTurn === 'O' && !isGameOver
              ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20 shadow-sm'
              : 'bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-lg bg-rose-500 text-white font-black text-xs flex items-center justify-center">
                ○
              </span>
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Player 2 (O)
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {scores.O}
            </span>
            {currentTurn === 'O' && !isGameOver && (
              <span className="text-[11px] font-bold text-rose-500 dark:text-rose-400 animate-pulse">
                Turn
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Turn or Win Announcement */}
      <div className="text-center py-1">
        {!isGameOver ? (
          <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            Player {currentTurn}'s Turn — tap any empty tile
          </div>
        ) : winner ? (
          <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
            🎉 Player {winner} Wins Round {round}!
          </div>
        ) : (
          <div className="text-base font-extrabold text-zinc-700 dark:text-zinc-300">
            Game is a Draw!
          </div>
        )}
      </div>

      {/* 3x3 Game Board */}
      <div className="p-3 sm:p-4 rounded-3xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 aspect-square max-w-sm mx-auto">
          {board.map((cell, index) => {
            const isWinningTile = winningLine ? winningLine.includes(index) : false;
            return (
              <BoardTile
                key={index}
                index={index}
                value={cell}
                isWinningTile={isWinningTile}
                isLastMove={lastMoveIndex === index}
                previewSymbol={!isGameOver ? currentTurn : null}
                disabled={isGameOver || cell !== null}
                onClick={handleTileClick}
              />
            );
          })}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          id="local-new-round-btn"
          type="button"
          onClick={handleNextRound}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          {isGameOver ? 'Next Round' : 'Restart Board'}
        </button>

        <button
          id="local-reset-scores-btn"
          type="button"
          onClick={handleResetScores}
          className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-sm transition-colors cursor-pointer"
        >
          Reset Match
        </button>
      </div>
    </div>
  );
};
