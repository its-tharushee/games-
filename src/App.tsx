import React, { useState, useEffect } from 'react';
import { useMultiplayerSocket } from './hooks/useMultiplayerSocket';
import { Header } from './components/Header';
import { ModeSelector } from './components/ModeSelector';
import { OnlineLobby } from './components/OnlineLobby';
import { OnlineGame } from './components/OnlineGame';
import { LocalGame } from './components/LocalGame';
import { AIGame } from './components/AIGame';
import { GameMode } from './types';

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('online');

  const {
    isConnected,
    roomState,
    mySymbol,
    playerId,
    errorMessage,
    clearError,
    notification,
    reactions,
    createRoom,
    joinRoom,
    quickMatch,
    addBot,
    makeMove,
    requestRematch,
    sendReaction,
    leaveRoom,
  } = useMultiplayerSocket();

  // If a room parameter is detected in the URL on launch, ensure online mode is selected
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) {
      setGameMode('online');
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Sticky Top Navigation */}
      <Header isConnected={isConnected} gameMode={gameMode} />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 flex flex-col items-center">
        {/* Mode Selector Tabs */}
        <ModeSelector
          currentMode={gameMode}
          onSelectMode={(mode) => setGameMode(mode)}
          inActiveOnlineGame={Boolean(roomState)}
        />

        {/* Dynamic Mode Content */}
        <div className="w-full flex justify-center">
          {gameMode === 'online' && (
            roomState ? (
              <OnlineGame
                room={roomState}
                mySymbol={mySymbol}
                playerId={playerId}
                reactions={reactions}
                notification={notification}
                onMakeMove={makeMove}
                onRequestRematch={requestRematch}
                onSendReaction={sendReaction}
                onLeaveRoom={leaveRoom}
                onAddBot={addBot}
              />
            ) : (
              <OnlineLobby
                onCreateRoom={createRoom}
                onJoinRoom={joinRoom}
                onQuickMatch={quickMatch}
                isConnected={isConnected}
                errorMessage={errorMessage}
                clearError={clearError}
              />
            )
          )}

          {gameMode === 'local' && <LocalGame />}

          {gameMode === 'ai' && <AIGame />}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 dark:border-zinc-800/80 py-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
        Multiplayer Tic Tac Toe &middot; Real-time WebSocket room synchronization
      </footer>
    </div>
  );
}
