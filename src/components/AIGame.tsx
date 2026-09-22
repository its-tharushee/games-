import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Bot, RotateCcw, User, Sparkles } from 'lucide-react';
import { Board, PlayerSymbol, AIDifficulty } from '../types';
import { BoardTile } from './BoardTile';
import { checkWinner, isBoardFull, getAIMove } from '../utils/ai';
import { sounds } from '../utils/sound';

export const AIGame: React.FC = () => {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [humanSymbol, setHumanSymbol] = useState<PlayerSymbol>('X');
  const aiSymbol: PlayerSymbol = humanSymbol === 'X' ? 'O' : 'X';
  const [currentTurn, setCurrentTurn] = useState<PlayerSymbol>('X');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('smart');
  const [winner, setWinner] = useState<PlayerSymbol | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null);
  const [scores, setScores] = useState({ human: 0, ai: 0, draws: 0 });
  const [round, setRound] = useState(1);

  const isGameOver = Boolean(winner || isDraw);
  const isHumanTurn = currentTurn === humanSymbol && !isGameOver && !isAiThinking;

  // AI Turn Logic with realistic human-like slight thinking delay
  useEffect(() => {
    if (currentTurn === aiSymbol && !isGameOver) {
      setIsAiThinking(true);
      const timer = setTimeout(() => {
        const move = getAIMove(board, aiSymbol, difficulty);
        if (move !== -1) {
          if (aiSymbol === 'X') {
            sounds.playMoveX();
          } else {
            sounds.playMoveO();
          }

          const newBoard = [...board];
          newBoard[move] = aiSymbol;
          setBoard(newBoard);
          setLastMoveIndex(move);

          const winCheck = checkWinner(newBoard);
          if (winCheck.winner) {
            setWinner(winCheck.winner);
            setWinningLine(winCheck.winningLine);
            setScores((prev) => ({ ...prev, ai: prev.ai + 1 }));
            sounds.playDraw(); // AI won, softer chord
          } else if (isBoardFull(newBoard)) {
            setIsDraw(true);
            setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
            sounds.playDraw();
          } else {
            setCurrentTurn(humanSymbol);
          }
        }
        setIsAiThinking(false);
      }, 450);

      return () => clearTimeout(timer);
    }
  }, [currentTurn, aiSymbol, humanSymbol, board, isGameOver, difficulty]);

  const handleTileClick = (index: number) => {
    if (!isHumanTurn || board[index]) return;

    if (humanSymbol === 'X') {
      sounds.playMoveX();
    } else {
      sounds.playMoveO();
    }

    const newBoard = [...board];
    newBoard[index] = humanSymbol;
    setBoard(newBoard);
    setLastMoveIndex(index);

    const winCheck = checkWinner(newBoard);
    if (winCheck.winner) {
      setWinner(winCheck.winner);
      setWinningLine(winCheck.winningLine);
      setScores((prev) => ({ ...prev, human: prev.human + 1 }));
      sounds.playWin();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else if (isBoardFull(newBoard)) {
      setIsDraw(true);
      setScores((prev) => ({ ...prev, draws: prev.draws + 1 }));
      sounds.playDraw();
    } else {
      setCurrentTurn(aiSymbol);
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
    setCurrentTurn('X');
  };

  const handleResetMatch = () => {
    sounds.playPop();
    setScores({ human: 0, ai: 0, draws: 0 });
    setRound(1);
    handleNextRound();
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* AI Difficulty Selector */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 shadow-sm">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
            AI Difficulty:
          </span>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => { setDifficulty('casual'); sounds.playPop(); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              difficulty === 'casual'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Casual
          </button>
          <button
            type="button"
            onClick={() => { setDifficulty('smart'); sounds.playPop(); }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              difficulty === 'smart'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Smart (Minimax)
          </button>
        </div>
      </div>

      {/* Scores Header */}
      <div className="w-full max-w-md mx-auto grid grid-cols-7 gap-2 items-center">
        {/* Human Player */}
        <div
          className={`col-span-3 p-3 rounded-2xl transition-all border ${
            isHumanTurn
              ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-400/20 shadow-sm'
              : 'bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                {humanSymbol}
              </span>
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                You
              </span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              YOU
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {scores.human}
            </span>
            {isHumanTurn && (
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

        {/* AI Opponent */}
        <div
          className={`col-span-3 p-3 rounded-2xl transition-all border ${
            currentTurn === aiSymbol && !isGameOver
              ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-500 ring-2 ring-rose-400/20 shadow-sm'
              : 'bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-lg bg-rose-500 text-white font-black text-xs flex items-center justify-center">
                {aiSymbol}
              </span>
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Bot AI
              </span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
              AI
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {scores.ai}
            </span>
            {currentTurn === aiSymbol && !isGameOver && (
              <span className="text-[11px] font-bold text-rose-500 dark:text-rose-400 animate-pulse">
                {isAiThinking ? 'Thinking...' : 'Turn'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Turn or Win Message */}
      <div className="text-center py-1">
        {!isGameOver ? (
          <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {isAiThinking ? (
              <span className="text-indigo-600 dark:text-indigo-400">Bot is calculating next move...</span>
            ) : isHumanTurn ? (
              <span className="text-zinc-900 dark:text-zinc-100">Your Turn! Click an empty tile.</span>
            ) : null}
          </div>
        ) : winner === humanSymbol ? (
          <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
            🎉 Excellent! You defeated the Bot in round {round}!
          </div>
        ) : winner === aiSymbol ? (
          <div className="text-base font-extrabold text-rose-500">
            Bot won this round! Try again.
          </div>
        ) : (
          <div className="text-base font-extrabold text-zinc-700 dark:text-zinc-300">
            Stalemate! Game ended in a draw.
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
                previewSymbol={isHumanTurn ? humanSymbol : null}
                disabled={!isHumanTurn || cell !== null}
                onClick={handleTileClick}
              />
            );
          })}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          id="ai-new-round-btn"
          type="button"
          onClick={handleNextRound}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          {isGameOver ? 'Next Round' : 'Restart Board'}
        </button>

        <button
          id="ai-reset-scores-btn"
          type="button"
          onClick={handleResetMatch}
          className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-sm transition-colors cursor-pointer"
        >
          Reset Match
        </button>
      </div>
    </div>
  );
};
