import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Copy, Check, Share2, LogOut, RotateCcw, Users, AlertCircle, Sparkles, Bot } from 'lucide-react';
import { PlayerSymbol, RoomState } from '../types';
import { BoardTile } from './BoardTile';
import { PlayerCards } from './PlayerCards';
import { ReactionsBar } from './ReactionsBar';
import { FloatingReaction } from '../hooks/useMultiplayerSocket';
import { sounds } from '../utils/sound';
import { safeCopyToClipboard } from '../utils/safeStorage';

interface OnlineGameProps {
  room: RoomState;
  mySymbol: PlayerSymbol | 'spectator' | null;
  playerId: string;
  reactions: FloatingReaction[];
  notification: string | null;
  onMakeMove: (index: number) => void;
  onRequestRematch: () => void;
  onSendReaction: (emoji: string) => void;
  onLeaveRoom: () => void;
  onAddBot?: () => void;
}

export const OnlineGame: React.FC<OnlineGameProps> = ({
  room,
  mySymbol,
  playerId,
  reactions,
  notification,
  onMakeMove,
  onRequestRematch,
  onSendReaction,
  onLeaveRoom,
  onAddBot,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [waitingNotice, setWaitingNotice] = useState(false);

  // Play sounds on game state transitions
  useEffect(() => {
    if (room.status === 'won') {
      sounds.playWin();
      if (mySymbol === room.winner || mySymbol === 'spectator') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    } else if (room.status === 'draw') {
      sounds.playDraw();
    }
  }, [room.status, room.winner, mySymbol]);

  // Play sound on move made
  useEffect(() => {
    if (room.lastMoveIndex !== null && room.lastMoveIndex !== undefined) {
      const placedSymbol = room.board[room.lastMoveIndex];
      if (placedSymbol === 'X') {
        sounds.playMoveX();
      } else if (placedSymbol === 'O') {
        sounds.playMoveO();
      }
    }
  }, [room.lastMoveIndex, room.board]);

  const copyRoomCode = async () => {
    sounds.playPop();
    const ok = await safeCopyToClipboard(room.code);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyInviteLink = async () => {
    sounds.playPop();
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    const ok = await safeCopyToClipboard(url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleTileClick = (index: number) => {
    if (room.status === 'waiting') {
      setWaitingNotice(true);
      sounds.playPop();
      setTimeout(() => setWaitingNotice(false), 3500);
      return;
    }
    if (isMyTurn && room.board[index] === null) {
      onMakeMove(index);
    }
  };

  const isMyTurn =
    room.status === 'in_progress' &&
    mySymbol !== 'spectator' &&
    mySymbol !== null &&
    room.currentTurn === mySymbol;

  const isGameOver = room.status === 'won' || room.status === 'draw';
  const hasRematchRequested = room.rematchRequestedBy === playerId;
  const opponentRequestedRematch = room.rematchRequestedBy && room.rematchRequestedBy !== playerId;

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Top Match Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 shadow-sm">
        {/* Room Code & Copy */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <span>Room:</span>
            <span className="text-indigo-600 dark:text-indigo-400 tracking-wider">{room.code}</span>
          </div>

          <button
            id="copy-code-btn"
            type="button"
            onClick={copyRoomCode}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors focus:outline-none cursor-pointer"
            title="Copy room code"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            id="copy-link-btn"
            type="button"
            onClick={copyInviteLink}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors focus:outline-none cursor-pointer"
            title="Copy invite link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Right side info & Leave */}
        <div className="flex items-center gap-2">
          {room.spectatorsCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-900">
              <Users className="w-3.5 h-3.5" />
              <span>{room.spectatorsCount} watching</span>
            </div>
          )}

          <button
            id="leave-room-btn"
            type="button"
            onClick={onLeaveRoom}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Opponent notification banner if any */}
      {notification && (
        <div
          id="room-notification-banner"
          className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 text-xs font-medium animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Waiting for Opponent Banner */}
      {room.status === 'waiting' && (
        <div className="p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 text-center space-y-3">
          <div className="inline-flex p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Waiting for Player 2 to join...
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs mx-auto mt-0.5">
              Share code <strong className="font-mono text-indigo-600 dark:text-indigo-400">{room.code}</strong> with a friend, or start immediately with AI!
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              id="share-invite-link-btn"
              type="button"
              onClick={copyInviteLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              {copiedLink ? 'Link Copied!' : 'Copy Invite Link'}
            </button>

            {onAddBot && (
              <button
                id="add-bot-room-btn"
                type="button"
                onClick={onAddBot}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                Play vs Bot Now
              </button>
            )}
          </div>

          {waitingNotice && (
            <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 animate-pulse bg-indigo-100/70 dark:bg-indigo-900/50 py-1.5 px-3 rounded-lg max-w-sm mx-auto">
              Match hasn't started yet! Click "Play vs Bot Now" above to play immediately, or share your invite link.
            </div>
          )}
        </div>
      )}

      {/* Player Score Cards */}
      <PlayerCards
        playerX={room.players.X}
        playerO={room.players.O}
        currentTurn={room.currentTurn}
        mySymbol={mySymbol}
        round={room.round}
        drawCount={room.drawCount}
        status={room.status}
      />

      {/* Status Alert: Whose turn or Winner */}
      <div className="text-center py-1">
        {room.status === 'in_progress' && (
          <div className="text-sm font-bold tracking-tight">
            {mySymbol === 'spectator' ? (
              <span className="text-zinc-600 dark:text-zinc-400">
                Watching: Player {room.currentTurn}'s turn
              </span>
            ) : isMyTurn ? (
              <span className="text-indigo-600 dark:text-indigo-400 animate-pulse">
                Your Turn ({mySymbol})! Click any empty square.
              </span>
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400">
                Opponent's Turn ({room.currentTurn})...
              </span>
            )}
          </div>
        )}

        {room.status === 'won' && (
          <div className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
            {room.winner === mySymbol ? (
              <span className="text-emerald-600 dark:text-emerald-400">🎉 Victory! You won this round!</span>
            ) : mySymbol === 'spectator' ? (
              <span>Player {room.winner} wins round {room.round}!</span>
            ) : (
              <span className="text-rose-500">Player {room.winner} wins round {room.round}.</span>
            )}
          </div>
        )}

        {room.status === 'draw' && (
          <div className="text-base font-extrabold text-zinc-700 dark:text-zinc-300">
            It's a Draw! Well played.
          </div>
        )}
      </div>

      {/* 3x3 Game Board Container */}
      <div className="p-3 sm:p-4 rounded-3xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 shadow-sm relative">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 aspect-square max-w-sm mx-auto">
          {room.board.map((cell, index) => {
            const isWinningTile = room.winningLine ? room.winningLine.includes(index) : false;
            const isLast = room.lastMoveIndex === index;
            const preview = isMyTurn ? (mySymbol as PlayerSymbol) : null;
            const isClickable = (room.status === 'waiting') || (isMyTurn && cell === null);

            return (
              <BoardTile
                key={index}
                index={index}
                value={cell}
                isWinningTile={isWinningTile}
                isLastMove={isLast}
                previewSymbol={preview}
                disabled={!isClickable}
                onClick={handleTileClick}
              />
            );
          })}
        </div>
      </div>

      {/* Game Over Actions (Rematch) */}
      {isGameOver && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 shadow-sm text-center space-y-3">
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {opponentRequestedRematch ? (
              <span className="text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">
                Opponent requested a rematch! Ready?
              </span>
            ) : hasRematchRequested ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                Rematch request sent. Waiting for opponent...
              </span>
            ) : (
              <span>Ready for another round?</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              id="rematch-btn"
              type="button"
              disabled={hasRematchRequested}
              onClick={onRequestRematch}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer ${
                opponentRequestedRematch
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce'
                  : hasRematchRequested
                  ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              {opponentRequestedRematch ? 'Accept Rematch' : hasRematchRequested ? 'Requested...' : 'Play Again'}
            </button>

            <button
              id="game-over-leave-btn"
              type="button"
              onClick={onLeaveRoom}
              className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-700/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-sm transition-colors cursor-pointer"
            >
              Leave Room
            </button>
          </div>
        </div>
      )}

      {/* Floating Reactions Bar */}
      <ReactionsBar
        reactions={reactions}
        onSendReaction={onSendReaction}
        disabled={false}
      />
    </div>
  );
};
