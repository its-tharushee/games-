import { useEffect, useRef, useState, useCallback } from 'react';
import { ClientMessage, PlayerSymbol, RoomState, ServerMessage } from '../types';

export interface FloatingReaction {
  id: string;
  fromName: string;
  fromSymbol: PlayerSymbol | 'spectator';
  emoji: string;
}

export function useMultiplayerSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [mySymbol, setMySymbol] = useState<PlayerSymbol | 'spectator' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string>('');

  // Initialize or retrieve persistent player ID
  useEffect(() => {
    let pid = localStorage.getItem('ttt_player_id');
    if (!pid) {
      pid = 'p_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem('ttt_player_id', pid);
    }
    playerIdRef.current = pid;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setErrorMessage(null);

        // Check if there was an active room stored to rejoin
        const storedRoom = sessionStorage.getItem('ttt_active_room');
        const storedName = localStorage.getItem('ttt_player_name') || 'Player';
        if (storedRoom) {
          socket.send(JSON.stringify({
            type: 'join_room',
            code: storedRoom,
            playerName: storedName,
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
              sessionStorage.setItem('ttt_active_room', msg.room.code);
              break;
            case 'reaction':
              setReactions((prev) => [...prev.slice(-4), {
                id: msg.id,
                fromName: msg.fromName,
                fromSymbol: msg.fromSymbol,
                emoji: msg.emoji,
              }]);
              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== msg.id));
              }, 2500);
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
          console.error('Failed to parse server message', e);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after brief delay
        setTimeout(() => {
          connect();
        }, 2000);
      };

      socket.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.error('Socket init error', e);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = (msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const createRoom = (playerName: string, isPublic: boolean = false) => {
    localStorage.setItem('ttt_player_name', playerName);
    send({
      type: 'create_room',
      playerName,
      playerId: playerIdRef.current,
      isPublic,
    });
  };

  const joinRoom = (code: string, playerName: string) => {
    localStorage.setItem('ttt_player_name', playerName);
    send({
      type: 'join_room',
      code: code.trim().toUpperCase(),
      playerName,
      playerId: playerIdRef.current,
    });
  };

  const quickMatch = (playerName: string) => {
    localStorage.setItem('ttt_player_name', playerName);
    send({
      type: 'quick_match',
      playerName,
      playerId: playerIdRef.current,
    });
  };

  const makeMove = (index: number) => {
    if (!roomState) return;
    send({
      type: 'make_move',
      code: roomState.code,
      index,
      playerId: playerIdRef.current,
    });
  };

  const requestRematch = () => {
    if (!roomState) return;
    send({
      type: 'request_rematch',
      code: roomState.code,
      playerId: playerIdRef.current,
    });
  };

  const sendReaction = (emoji: string) => {
    if (!roomState) return;
    send({
      type: 'send_reaction',
      code: roomState.code,
      playerId: playerIdRef.current,
      emoji,
    });
  };

  const leaveRoom = () => {
    if (roomState) {
      send({
        type: 'leave_room',
        code: roomState.code,
        playerId: playerIdRef.current,
      });
    }
    sessionStorage.removeItem('ttt_active_room');
    setRoomState(null);
    setMySymbol(null);
  };

  return {
    isConnected,
    roomState,
    mySymbol,
    playerId: playerIdRef.current,
    errorMessage,
    clearError: () => setErrorMessage(null),
    notification,
    reactions,
    createRoom,
    joinRoom,
    quickMatch,
    makeMove,
    requestRematch,
    sendReaction,
    leaveRoom,
  };
}
