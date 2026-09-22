import { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerSymbol, RoomState, ServerMessage } from '../types';
import { safeStorage } from '../utils/safeStorage';

export interface FloatingReaction {
  id: string;
  fromName: string;
  fromSymbol: PlayerSymbol | 'spectator';
  emoji: string;
}

function generateInitialPlayerId(): string {
  const existing = safeStorage.getItem('ttt_player_id');
  if (existing) return existing;
  const newId = 'p_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  safeStorage.setItem('ttt_player_id', newId);
  return newId;
}

export function useMultiplayerSocket() {
  const [isConnected, setIsConnected] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [mySymbol, setMySymbol] = useState<PlayerSymbol | 'spectator' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [playerId, setPlayerId] = useState<string>(generateInitialPlayerId);

  const wsRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string>(playerId);
  const seenReactionsRef = useRef<Set<string>>(new Set());

  // Keep ref synchronized with state
  useEffect(() => {
    playerIdRef.current = playerId;
    safeStorage.setItem('ttt_player_id', playerId);
  }, [playerId]);

  // Health check on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false));
  }, []);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        // If there is an active room, notify the socket
        const activeRoom = safeStorage.getSessionItem('ttt_active_room');
        const activeName = safeStorage.getItem('ttt_player_name') || 'Player';
        if (activeRoom) {
          socket.send(JSON.stringify({
            type: 'join_room',
            code: activeRoom,
            playerName: activeName,
            playerId: playerIdRef.current,
          }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          switch (msg.type) {
            case 'room_state':
              setRoomState(msg.room);
              setMySymbol(msg.yourSymbol);
              setErrorMessage(null);
              safeStorage.setSessionItem('ttt_active_room', msg.room.code);
              break;
            case 'reaction':
              if (!seenReactionsRef.current.has(msg.id)) {
                seenReactionsRef.current.add(msg.id);
                setReactions((prev) => [...prev.slice(-4), {
                  id: msg.id,
                  fromName: msg.fromName,
                  fromSymbol: msg.fromSymbol,
                  emoji: msg.emoji,
                }]);
                setTimeout(() => {
                  setReactions((prev) => prev.filter((r) => r.id !== msg.id));
                }, 2500);
              }
              break;
            case 'error':
              setErrorMessage(msg.message);
              break;
            case 'opponent_disconnected':
              setNotification(msg.message);
              setTimeout(() => setNotification(null), 4000);
              break;
            case 'opponent_reconnected':
              setNotification(msg.message);
              setTimeout(() => setNotification(null), 3000);
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      socket.onclose = () => {
        setTimeout(connectWs, 3000);
      };

      socket.onerror = () => {
        // Fallback to HTTP gracefully
      };
    } catch {
      // WebSocket not available in this context
    }
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs]);

  // Polling loop for active room state (guarantees real-time sync in any iframe)
  useEffect(() => {
    if (!roomState?.code) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${roomState.code}`);
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            setRoomState(data.room);
          }
          if (Array.isArray(data.reactions)) {
            data.reactions.forEach((r: { id: string; fromName: string; fromSymbol: PlayerSymbol | 'spectator'; emoji: string }) => {
              if (!seenReactionsRef.current.has(r.id)) {
                seenReactionsRef.current.add(r.id);
                setReactions((prev) => [...prev.slice(-4), r]);
                setTimeout(() => {
                  setReactions((prev) => prev.filter((item) => item.id !== r.id));
                }, 2500);
              }
            });
          }
        }
      } catch (err) {
        console.warn('Room sync poll error', err);
      }
    }, 700);

    return () => clearInterval(pollInterval);
  }, [roomState?.code]);

  // Actions
  const createRoom = async (playerName: string, isPublic: boolean = false) => {
    setIsConnecting(true);
    setErrorMessage(null);
    safeStorage.setItem('ttt_player_name', playerName);

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName,
          playerId: playerIdRef.current,
          isPublic,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.yourPlayerId && data.yourPlayerId !== playerIdRef.current) {
          setPlayerId(data.yourPlayerId);
          playerIdRef.current = data.yourPlayerId;
        }
        setRoomState(data.room);
        setMySymbol(data.yourSymbol);
        safeStorage.setSessionItem('ttt_active_room', data.code);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'create_room',
            playerName,
            playerId: playerIdRef.current,
            isPublic,
          }));
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to create room' }));
        setErrorMessage(err.error || 'Failed to create room');
      }
    } catch {
      setErrorMessage('Network connection issue. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const joinRoom = async (code: string, playerName: string) => {
    setIsConnecting(true);
    setErrorMessage(null);
    const cleanCode = code.trim().toUpperCase();
    safeStorage.setItem('ttt_player_name', playerName);

    try {
      const res = await fetch(`/api/rooms/${cleanCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName,
          playerId: playerIdRef.current,
        }),
      });

      const data = await res.json();
      if (res.ok && data.room) {
        if (data.yourPlayerId && data.yourPlayerId !== playerIdRef.current) {
          setPlayerId(data.yourPlayerId);
          playerIdRef.current = data.yourPlayerId;
        }
        setRoomState(data.room);
        setMySymbol(data.yourSymbol);
        safeStorage.setSessionItem('ttt_active_room', data.code);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'join_room',
            code: cleanCode,
            playerName,
            playerId: playerIdRef.current,
          }));
        }
      } else {
        setErrorMessage(data.error || `Could not join room "${cleanCode}".`);
      }
    } catch {
      setErrorMessage('Unable to connect to game server. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const quickMatch = async (playerName: string) => {
    setIsConnecting(true);
    setErrorMessage(null);
    safeStorage.setItem('ttt_player_name', playerName);

    try {
      const res = await fetch('/api/rooms/quick-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName,
          playerId: playerIdRef.current,
        }),
      });

      const data = await res.json();
      if (res.ok && data.room) {
        if (data.yourPlayerId && data.yourPlayerId !== playerIdRef.current) {
          setPlayerId(data.yourPlayerId);
          playerIdRef.current = data.yourPlayerId;
        }
        setRoomState(data.room);
        setMySymbol(data.yourSymbol);
        safeStorage.setSessionItem('ttt_active_room', data.code);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'quick_match',
            playerName,
            playerId: playerIdRef.current,
          }));
        }
      } else {
        setErrorMessage(data.error || 'Quick match failed.');
      }
    } catch {
      setErrorMessage('Matchmaking error. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const addBot = async () => {
    if (!roomState) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'add_bot',
        code: roomState.code,
      }));
    }

    try {
      const res = await fetch(`/api/rooms/${roomState.code}/bot`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRoomState(data.room);
      }
    } catch (e) {
      console.error('Failed to add bot', e);
    }
  };

  const makeMove = async (index: number) => {
    if (!roomState) return;

    // Optimistic UI update
    const nextBoard = [...roomState.board];
    if (mySymbol === 'X' || mySymbol === 'O') {
      nextBoard[index] = mySymbol;
      setRoomState((prev) => prev ? {
        ...prev,
        board: nextBoard,
        lastMoveIndex: index,
        currentTurn: mySymbol === 'X' ? 'O' : 'X',
      } : null);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'make_move',
        code: roomState.code,
        index,
        playerId: playerIdRef.current,
      }));
    }

    try {
      const res = await fetch(`/api/rooms/${roomState.code}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index,
          playerId: playerIdRef.current,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRoomState(data.room);
      }
    } catch (e) {
      console.error('Failed to post move', e);
    }
  };

  const requestRematch = async () => {
    if (!roomState) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'request_rematch',
        code: roomState.code,
        playerId: playerIdRef.current,
      }));
    }

    try {
      const res = await fetch(`/api/rooms/${roomState.code}/rematch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: playerIdRef.current,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRoomState(data.room);
      }
    } catch (e) {
      console.error('Failed to post rematch', e);
    }
  };

  const sendReaction = async (emoji: string) => {
    if (!roomState) return;

    const myName = safeStorage.getItem('ttt_player_name') || 'Player';
    const tempId = `${Date.now()}-${Math.random()}`;

    setReactions((prev) => [...prev.slice(-4), {
      id: tempId,
      fromName: myName,
      fromSymbol: mySymbol || 'spectator',
      emoji,
    }]);
    seenReactionsRef.current.add(tempId);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== tempId));
    }, 2500);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_reaction',
        code: roomState.code,
        playerId: playerIdRef.current,
        emoji,
      }));
    }

    fetch(`/api/rooms/${roomState.code}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: playerIdRef.current,
        emoji,
      }),
    }).catch(() => {});
  };

  const leaveRoom = () => {
    if (roomState) {
      fetch(`/api/rooms/${roomState.code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: playerIdRef.current,
        }),
      }).catch(() => {});

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'leave_room',
          code: roomState.code,
          playerId: playerIdRef.current,
        }));
      }
    }
    safeStorage.removeSessionItem('ttt_active_room');
    setRoomState(null);
    setMySymbol(null);
  };

  return {
    isConnected,
    isConnecting,
    roomState,
    mySymbol,
    playerId,
    errorMessage,
    clearError: () => setErrorMessage(null),
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
  };
}
