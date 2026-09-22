import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const app = express();
app.use(express.json());

interface ServerPlayer {
  id: string;
  name: string;
  symbol: 'X' | 'O';
  connected: boolean;
  score: number;
  ws?: WebSocket;
}

interface ServerRoom {
  code: string;
  isPublic: boolean;
  createdAt: number;
  lastActivity: number;
  players: {
    X?: ServerPlayer;
    O?: ServerPlayer;
  };
  spectators: Map<string, { id: string; name: string; ws: WebSocket }>;
  board: ('X' | 'O' | null)[];
  currentTurn: 'X' | 'O';
  status: 'waiting' | 'in_progress' | 'won' | 'draw';
  winner: 'X' | 'O' | null;
  winningLine: number[] | null;
  rematchRequestedBy: string | null;
  round: number;
  drawCount: number;
  lastMoveIndex: number | null;
}

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board: ('X' | 'O' | null)[]): { winner: 'X' | 'O' | null; winningLine: number[] | null } {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as 'X' | 'O', winningLine: combo };
    }
  }
  return { winner: null, winningLine: null };
}

const rooms = new Map<string, ServerRoom>();
const clientMetadata = new WeakMap<WebSocket, { code?: string; playerId?: string; name?: string }>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

function getSanitizedRoomState(room: ServerRoom) {
  return {
    code: room.code,
    isPublic: room.isPublic,
    players: {
      X: room.players.X ? {
        id: room.players.X.id,
        name: room.players.X.name,
        symbol: room.players.X.symbol,
        connected: room.players.X.connected,
        score: room.players.X.score,
      } : undefined,
      O: room.players.O ? {
        id: room.players.O.id,
        name: room.players.O.name,
        symbol: room.players.O.symbol,
        connected: room.players.O.connected,
        score: room.players.O.score,
      } : undefined,
    },
    spectatorsCount: room.spectators.size,
    board: room.board,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    winningLine: room.winningLine,
    rematchRequestedBy: room.rematchRequestedBy,
    round: room.round,
    drawCount: room.drawCount,
    lastMoveIndex: room.lastMoveIndex,
  };
}

function broadcastRoom(room: ServerRoom) {
  const state = getSanitizedRoomState(room);

  // Send to Player X
  if (room.players.X?.ws && room.players.X.ws.readyState === WebSocket.OPEN) {
    room.players.X.ws.send(JSON.stringify({
      type: 'room_state',
      room: state,
      yourSymbol: 'X',
    }));
  }

  // Send to Player O
  if (room.players.O?.ws && room.players.O.ws.readyState === WebSocket.OPEN) {
    room.players.O.ws.send(JSON.stringify({
      type: 'room_state',
      room: state,
      yourSymbol: 'O',
    }));
  }

  // Send to Spectators
  for (const spectator of room.spectators.values()) {
    if (spectator.ws.readyState === WebSocket.OPEN) {
      spectator.ws.send(JSON.stringify({
        type: 'room_state',
        room: state,
        yourSymbol: 'spectator',
      }));
    }
  }
}

function broadcastToRoom(room: ServerRoom, payload: unknown) {
  const message = JSON.stringify(payload);
  if (room.players.X?.ws?.readyState === WebSocket.OPEN) {
    room.players.X.ws.send(message);
  }
  if (room.players.O?.ws?.readyState === WebSocket.OPEN) {
    room.players.O.ws.send(message);
  }
  for (const spectator of room.spectators.values()) {
    if (spectator.ws.readyState === WebSocket.OPEN) {
      spectator.ws.send(message);
    }
  }
}

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size });
});

app.get('/api/public-rooms', (req, res) => {
  const publicRooms: Array<{ code: string; hostName: string; createdAt: number }> = [];
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.isPublic && room.status === 'waiting' && room.players.X && !room.players.O) {
      // Only rooms active within 15 minutes
      if (now - room.lastActivity < 15 * 60 * 1000) {
        publicRooms.push({
          code: room.code,
          hostName: room.players.X.name,
          createdAt: room.createdAt,
        });
      }
    }
  }
  res.json({ rooms: publicRooms });
});

async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    clientMetadata.set(ws, {});

    ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(ws, msg);
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err);
    });
  });

  function handleClientMessage(ws: WebSocket, msg: { type: string; [key: string]: unknown }) {
    const meta = clientMetadata.get(ws) || {};

    switch (msg.type) {
      case 'create_room': {
        const playerName = (String(msg.playerName || 'Player 1')).slice(0, 20).trim() || 'Player 1';
        const playerId = String(msg.playerId || Math.random().toString(36).slice(2));
        const isPublic = Boolean(msg.isPublic);

        const code = generateRoomCode();
        const room: ServerRoom = {
          code,
          isPublic,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          players: {
            X: {
              id: playerId,
              name: playerName,
              symbol: 'X',
              connected: true,
              score: 0,
              ws,
            },
          },
          spectators: new Map(),
          board: Array(9).fill(null),
          currentTurn: 'X',
          status: 'waiting',
          winner: null,
          winningLine: null,
          rematchRequestedBy: null,
          round: 1,
          drawCount: 0,
          lastMoveIndex: null,
        };

        rooms.set(code, room);
        clientMetadata.set(ws, { code, playerId, name: playerName });
        broadcastRoom(room);
        break;
      }

      case 'quick_match': {
        const playerName = (String(msg.playerName || 'Player')).slice(0, 20).trim() || 'Player';
        const playerId = String(msg.playerId || Math.random().toString(36).slice(2));

        // Find existing public waiting room
        let joined = false;
        for (const room of rooms.values()) {
          if (room.isPublic && room.status === 'waiting' && room.players.X && !room.players.O && room.players.X.id !== playerId) {
            room.players.O = {
              id: playerId,
              name: playerName,
              symbol: 'O',
              connected: true,
              score: 0,
              ws,
            };
            room.status = 'in_progress';
            room.lastActivity = Date.now();
            rooms.set(room.code, room);
            clientMetadata.set(ws, { code: room.code, playerId, name: playerName });
            broadcastRoom(room);
            joined = true;
            break;
          }
        }

        if (!joined) {
          // Create public room
          handleClientMessage(ws, {
            type: 'create_room',
            playerName,
            playerId,
            isPublic: true,
          });
        }
        break;
      }

      case 'join_room': {
        const rawCode = String(msg.code || '').toUpperCase().trim();
        const playerName = (String(msg.playerName || 'Guest')).slice(0, 20).trim() || 'Guest';
        const playerId = String(msg.playerId || Math.random().toString(36).slice(2));

        const room = rooms.get(rawCode);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: `Room "${rawCode}" does not exist.` }));
          return;
        }

        room.lastActivity = Date.now();
        clientMetadata.set(ws, { code: rawCode, playerId, name: playerName });

        // Check if player is reconnecting
        if (room.players.X && room.players.X.id === playerId) {
          room.players.X.ws = ws;
          room.players.X.connected = true;
          room.players.X.name = playerName;
          broadcastRoom(room);
          broadcastToRoom(room, {
            type: 'opponent_reconnected',
            message: `${playerName} reconnected to the match.`,
          });
          return;
        }

        if (room.players.O && room.players.O.id === playerId) {
          room.players.O.ws = ws;
          room.players.O.connected = true;
          room.players.O.name = playerName;
          broadcastRoom(room);
          broadcastToRoom(room, {
            type: 'opponent_reconnected',
            message: `${playerName} reconnected to the match.`,
          });
          return;
        }

        // Check if X slot is open
        if (!room.players.X) {
          room.players.X = {
            id: playerId,
            name: playerName,
            symbol: 'X',
            connected: true,
            score: 0,
            ws,
          };
          if (room.players.O) {
            room.status = 'in_progress';
          }
          broadcastRoom(room);
          return;
        }

        // Check if O slot is open
        if (!room.players.O) {
          room.players.O = {
            id: playerId,
            name: playerName,
            symbol: 'O',
            connected: true,
            score: 0,
            ws,
          };
          room.status = 'in_progress';
          broadcastRoom(room);
          return;
        }

        // Otherwise spectator
        room.spectators.set(playerId, { id: playerId, name: playerName, ws });
        broadcastRoom(room);
        break;
      }

      case 'make_move': {
        const rawCode = String(msg.code || '').toUpperCase().trim();
        const index = Number(msg.index);
        const playerId = String(msg.playerId);

        const room = rooms.get(rawCode);
        if (!room) return;

        if (room.status !== 'in_progress') return;
        if (index < 0 || index > 8 || room.board[index] !== null) return;

        const isPlayerX = room.players.X?.id === playerId;
        const isPlayerO = room.players.O?.id === playerId;

        if (!isPlayerX && !isPlayerO) return;

        const playerSymbol = isPlayerX ? 'X' : 'O';
        if (room.currentTurn !== playerSymbol) return;

        // Apply move
        room.board[index] = playerSymbol;
        room.lastMoveIndex = index;
        room.lastActivity = Date.now();

        const { winner, winningLine } = checkWinner(room.board);

        if (winner) {
          room.status = 'won';
          room.winner = winner;
          room.winningLine = winningLine;
          if (winner === 'X' && room.players.X) {
            room.players.X.score += 1;
          } else if (winner === 'O' && room.players.O) {
            room.players.O.score += 1;
          }
        } else if (room.board.every((c) => c !== null)) {
          room.status = 'draw';
          room.drawCount += 1;
        } else {
          room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
        }

        broadcastRoom(room);
        break;
      }

      case 'request_rematch': {
        const rawCode = String(msg.code || '').toUpperCase().trim();
        const playerId = String(msg.playerId);
        const room = rooms.get(rawCode);
        if (!room) return;

        if (room.status !== 'won' && room.status !== 'draw') return;

        if (!room.rematchRequestedBy) {
          room.rematchRequestedBy = playerId;
          broadcastRoom(room);
        } else if (room.rematchRequestedBy !== playerId) {
          // Opponent agreed! Start fresh round
          room.board = Array(9).fill(null);
          room.status = 'in_progress';
          room.winner = null;
          room.winningLine = null;
          room.rematchRequestedBy = null;
          room.lastMoveIndex = null;
          room.round += 1;
          // Alternate starting turn on every round
          room.currentTurn = room.round % 2 === 1 ? 'X' : 'O';
          room.lastActivity = Date.now();
          broadcastRoom(room);
        }
        break;
      }

      case 'send_reaction': {
        const rawCode = String(msg.code || '').toUpperCase().trim();
        const playerId = String(msg.playerId);
        const emoji = String(msg.emoji || '👍').slice(0, 5);
        const room = rooms.get(rawCode);
        if (!room) return;

        let fromName = 'Player';
        let fromSymbol: 'X' | 'O' | 'spectator' = 'spectator';

        if (room.players.X?.id === playerId) {
          fromName = room.players.X.name;
          fromSymbol = 'X';
        } else if (room.players.O?.id === playerId) {
          fromName = room.players.O.name;
          fromSymbol = 'O';
        } else if (room.spectators.has(playerId)) {
          fromName = room.spectators.get(playerId)!.name;
        }

        broadcastToRoom(room, {
          type: 'reaction',
          fromName,
          fromSymbol,
          emoji,
          id: `${Date.now()}-${Math.random()}`,
        });
        break;
      }

      case 'leave_room': {
        handleDisconnect(ws);
        break;
      }
    }
  }

  function handleDisconnect(ws: WebSocket) {
    const meta = clientMetadata.get(ws);
    if (!meta || !meta.code || !meta.playerId) return;

    const roomCode = meta.code;
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.players.X?.id === meta.playerId) {
      room.players.X.connected = false;
      broadcastRoom(room);
      broadcastToRoom(room, {
        type: 'opponent_disconnected',
        message: `${room.players.X.name} left the room or disconnected.`,
      });
    } else if (room.players.O?.id === meta.playerId) {
      room.players.O.connected = false;
      broadcastRoom(room);
      broadcastToRoom(room, {
        type: 'opponent_disconnected',
        message: `${room.players.O.name} left the room or disconnected.`,
      });
    } else if (room.spectators.has(meta.playerId)) {
      room.spectators.delete(meta.playerId);
      broadcastRoom(room);
    }

    // Clean up empty room after 1 hour of no players
    const bothDisconnected =
      (!room.players.X || !room.players.X.connected) &&
      (!room.players.O || !room.players.O.connected) &&
      room.spectators.size === 0;

    if (bothDisconnected) {
      setTimeout(() => {
        const current = rooms.get(roomCode);
        if (
          current &&
          (!current.players.X || !current.players.X.connected) &&
          (!current.players.O || !current.players.O.connected) &&
          current.spectators.size === 0
        ) {
          rooms.delete(roomCode);
        }
      }, 60 * 60 * 1000);
    }
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server and WebSockets running on http://localhost:${PORT}`);
  });
}

startServer();
