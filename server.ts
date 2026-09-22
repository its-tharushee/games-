import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const app = express();
app.use(express.json());

type PlayerSymbol = 'X' | 'O';

interface ServerPlayer {
  id: string;
  name: string;
  symbol: 'X' | 'O';
  connected: boolean;
  score: number;
  ws?: WebSocket;
}

interface ReactionItem {
  id: string;
  fromName: string;
  fromSymbol: 'X' | 'O' | 'spectator';
  emoji: string;
  timestamp: number;
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
  spectators: Map<string, { id: string; name: string; ws?: WebSocket }>;
  board: ('X' | 'O' | null)[];
  currentTurn: 'X' | 'O';
  status: 'waiting' | 'in_progress' | 'won' | 'draw';
  winner: 'X' | 'O' | null;
  winningLine: number[] | null;
  rematchRequestedBy: string | null;
  round: number;
  drawCount: number;
  lastMoveIndex: number | null;
  recentReactions: ReactionItem[];
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
    if (spectator.ws && spectator.ws.readyState === WebSocket.OPEN) {
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
    if (spectator.ws && spectator.ws.readyState === WebSocket.OPEN) {
      spectator.ws.send(message);
    }
  }
}

// Core Room Operations (shared by HTTP REST and WebSockets)
function createRoomLogic(playerName: string, playerId: string, isPublic: boolean, ws?: WebSocket) {
  const cleanName = (playerName || 'Player 1').slice(0, 20).trim() || 'Player 1';
  const cleanId = String(playerId || Math.random().toString(36).slice(2));
  const code = generateRoomCode();

  const room: ServerRoom = {
    code,
    isPublic: Boolean(isPublic),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    players: {
      X: {
        id: cleanId,
        name: cleanName,
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
    recentReactions: [],
  };

  rooms.set(code, room);
  if (ws) {
    clientMetadata.set(ws, { code, playerId: cleanId, name: cleanName });
  }
  broadcastRoom(room);
  return { code, room: getSanitizedRoomState(room), yourSymbol: 'X' as const };
}

function joinRoomLogic(code: string, playerName: string, playerId: string, ws?: WebSocket) {
  const rawCode = String(code || '').toUpperCase().trim();
  const cleanName = (playerName || 'Guest').slice(0, 20).trim() || 'Guest';
  const cleanId = String(playerId || Math.random().toString(36).slice(2));

  const room = rooms.get(rawCode);
  if (!room) {
    return { error: `Room "${rawCode}" not found. Please check the code.` };
  }

  room.lastActivity = Date.now();
  if (ws) {
    clientMetadata.set(ws, { code: rawCode, playerId: cleanId, name: cleanName });
  }

  // Check if player is reconnecting
  if (room.players.X && room.players.X.id === cleanId) {
    if (ws) room.players.X.ws = ws;
    room.players.X.connected = true;
    room.players.X.name = cleanName;
    broadcastRoom(room);
    broadcastToRoom(room, {
      type: 'opponent_reconnected',
      message: `${cleanName} reconnected to the match.`,
    });
    return { code: rawCode, room: getSanitizedRoomState(room), yourSymbol: 'X' as const, yourPlayerId: cleanId };
  }

  if (room.players.O && room.players.O.id === cleanId) {
    if (ws) room.players.O.ws = ws;
    room.players.O.connected = true;
    room.players.O.name = cleanName;
    broadcastRoom(room);
    broadcastToRoom(room, {
      type: 'opponent_reconnected',
      message: `${cleanName} reconnected to the match.`,
    });
    return { code: rawCode, room: getSanitizedRoomState(room), yourSymbol: 'O' as const, yourPlayerId: cleanId };
  }

  // Replace AI bot if a human joins the room
  if (room.players.O && room.players.O.id === 'ai_bot') {
    room.players.O = {
      id: cleanId,
      name: cleanName,
      symbol: 'O',
      connected: true,
      score: 0,
      ws,
    };
    room.lastActivity = Date.now();
    broadcastRoom(room);
    broadcastToRoom(room, {
      type: 'opponent_reconnected',
      message: `${cleanName} joined and replaced the practice bot!`,
    });
    return { code: rawCode, room: getSanitizedRoomState(room), yourSymbol: 'O' as const, yourPlayerId: cleanId };
  }

  // Check if X slot is open
  if (!room.players.X) {
    room.players.X = {
      id: cleanId,
      name: cleanName,
      symbol: 'X',
      connected: true,
      score: 0,
      ws,
    };
    if (room.players.O) {
      room.status = 'in_progress';
    }
    broadcastRoom(room);
    return { code: rawCode, room: getSanitizedRoomState(room), yourSymbol: 'X' as const, yourPlayerId: cleanId };
  }

  // Check if O slot is open
  if (!room.players.O) {
    room.players.O = {
      id: cleanId,
      name: cleanName,
      symbol: 'O',
      connected: true,
      score: 0,
      ws,
    };
    room.status = 'in_progress';
    broadcastRoom(room);
    return { code: rawCode, room: getSanitizedRoomState(room), yourSymbol: 'O' as const, yourPlayerId: cleanId };
  }

  // Spectator
  room.spectators.set(cleanId, { id: cleanId, name: cleanName, ws });
  broadcastRoom(room);
  return { code: rawCode, room: getSanitizedRoomState(room), yourSymbol: 'spectator' as const, yourPlayerId: cleanId };
}

function findBestBotMove(board: (PlayerSymbol | null)[], botSymbol: PlayerSymbol): number {
  const opponentSymbol: PlayerSymbol = botSymbol === 'X' ? 'O' : 'X';

  // 1. Check if bot can win immediately
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      const copy = [...board];
      copy[i] = botSymbol;
      if (checkWinner(copy).winner === botSymbol) return i;
    }
  }

  // 2. Block opponent's immediate win
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      const copy = [...board];
      copy[i] = opponentSymbol;
      if (checkWinner(copy).winner === opponentSymbol) return i;
    }
  }

  // 3. Center tile
  if (board[4] === null) return 4;

  // 4. Corners
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  // 5. Sides
  const sides = [1, 3, 5, 7].filter((i) => board[i] === null);
  if (sides.length > 0) {
    return sides[Math.floor(Math.random() * sides.length)];
  }

  return -1;
}

function triggerBotMove(room: ServerRoom) {
  if (room.status !== 'in_progress' || room.currentTurn !== 'O' || room.players.O?.id !== 'ai_bot') {
    return;
  }

  setTimeout(() => {
    const currentRoom = rooms.get(room.code);
    if (!currentRoom || currentRoom.status !== 'in_progress' || currentRoom.currentTurn !== 'O') {
      return;
    }

    const botMoveIndex = findBestBotMove(currentRoom.board, 'O');
    if (botMoveIndex !== -1) {
      makeMoveLogic(currentRoom.code, botMoveIndex, 'ai_bot');
    }
  }, 400);
}

function addBotLogic(code: string) {
  const rawCode = String(code || '').toUpperCase().trim();
  const room = rooms.get(rawCode);
  if (!room) return { error: 'Room not found' };

  if (room.players.O && room.players.O.id !== 'ai_bot' && room.players.O.connected) {
    return { error: 'Player 2 is already connected' };
  }

  room.players.O = {
    id: 'ai_bot',
    name: 'TicTacBot (AI)',
    symbol: 'O',
    connected: true,
    score: 0,
  };
  room.status = 'in_progress';
  room.lastActivity = Date.now();
  broadcastRoom(room);

  if (room.currentTurn === 'O') {
    triggerBotMove(room);
  }

  return { room: getSanitizedRoomState(room) };
}

function quickMatchLogic(playerName: string, playerId: string, ws?: WebSocket) {
  const cleanName = (playerName || 'Player').slice(0, 20).trim() || 'Player';
  const cleanId = String(playerId || Math.random().toString(36).slice(2));

  // Find open waiting public room
  for (const room of rooms.values()) {
    if (room.isPublic && room.status === 'waiting' && room.players.X && !room.players.O && room.players.X.id !== cleanId) {
      room.players.O = {
        id: cleanId,
        name: cleanName,
        symbol: 'O',
        connected: true,
        score: 0,
        ws,
      };
      room.status = 'in_progress';
      room.lastActivity = Date.now();
      if (ws) {
        clientMetadata.set(ws, { code: room.code, playerId: cleanId, name: cleanName });
      }
      broadcastRoom(room);
      return { code: room.code, room: getSanitizedRoomState(room), yourSymbol: 'O' as const };
    }
  }

  // If no room found, create one
  return createRoomLogic(cleanName, cleanId, true, ws);
}

function makeMoveLogic(code: string, index: number, playerId: string) {
  const rawCode = String(code || '').toUpperCase().trim();
  const room = rooms.get(rawCode);
  if (!room) return { error: 'Room not found' };

  if (room.status !== 'in_progress') return { error: 'Game is not in progress' };
  if (index < 0 || index > 8 || room.board[index] !== null) return { error: 'Invalid move' };

  const isPlayerX = room.players.X?.id === playerId;
  const isPlayerO = room.players.O?.id === playerId;
  if (!isPlayerX && !isPlayerO) return { error: 'Not a player in this match' };

  const playerSymbol = isPlayerX ? 'X' : 'O';
  if (room.currentTurn !== playerSymbol) return { error: 'Not your turn' };

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

  // If next turn is AI bot, trigger its move
  if (room.status === 'in_progress' && room.currentTurn === 'O' && room.players.O?.id === 'ai_bot') {
    triggerBotMove(room);
  }

  return { room: getSanitizedRoomState(room) };
}

function rematchLogic(code: string, playerId: string) {
  const rawCode = String(code || '').toUpperCase().trim();
  const room = rooms.get(rawCode);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'won' && room.status !== 'draw') return { error: 'Round still active' };

  // If opponent is AI bot, bot accepts rematch immediately
  if (room.players.O?.id === 'ai_bot') {
    room.board = Array(9).fill(null);
    room.status = 'in_progress';
    room.winner = null;
    room.winningLine = null;
    room.rematchRequestedBy = null;
    room.lastMoveIndex = null;
    room.round += 1;
    room.currentTurn = room.round % 2 === 1 ? 'X' : 'O';
    room.lastActivity = Date.now();
    broadcastRoom(room);

    if (room.currentTurn === 'O') {
      triggerBotMove(room);
    }
    return { room: getSanitizedRoomState(room) };
  }

  if (!room.rematchRequestedBy) {
    room.rematchRequestedBy = playerId;
    broadcastRoom(room);
  } else if (room.rematchRequestedBy !== playerId) {
    room.board = Array(9).fill(null);
    room.status = 'in_progress';
    room.winner = null;
    room.winningLine = null;
    room.rematchRequestedBy = null;
    room.lastMoveIndex = null;
    room.round += 1;
    room.currentTurn = room.round % 2 === 1 ? 'X' : 'O';
    room.lastActivity = Date.now();
    broadcastRoom(room);
  }

  return { room: getSanitizedRoomState(room) };
}

function reactionLogic(code: string, playerId: string, emoji: string) {
  const rawCode = String(code || '').toUpperCase().trim();
  const room = rooms.get(rawCode);
  if (!room) return { error: 'Room not found' };

  const cleanEmoji = String(emoji || '👍').slice(0, 5);
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

  const reactionItem: ReactionItem = {
    id: `${Date.now()}-${Math.random()}`,
    fromName,
    fromSymbol,
    emoji: cleanEmoji,
    timestamp: Date.now(),
  };

  room.recentReactions.push(reactionItem);
  const cutoff = Date.now() - 10000;
  room.recentReactions = room.recentReactions.filter((r) => r.timestamp > cutoff);

  broadcastToRoom(room, {
    type: 'reaction',
    ...reactionItem,
  });

  // If opponent is AI bot, send a fun reaction reply
  if (room.players.O?.id === 'ai_bot') {
    setTimeout(() => {
      const botEmojis = ['🤖', '🔥', '⚡', '😎', '👏'];
      const pick = botEmojis[Math.floor(Math.random() * botEmojis.length)];
      broadcastToRoom(room, {
        type: 'reaction',
        id: `${Date.now()}-bot`,
        fromName: 'TicTacBot (AI)',
        fromSymbol: 'O',
        emoji: pick,
        timestamp: Date.now(),
      });
    }, 700);
  }

  return { ok: true, reaction: reactionItem };
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

app.post('/api/rooms', (req, res) => {
  const { playerName, playerId, isPublic } = req.body;
  const result = createRoomLogic(playerName, playerId, isPublic);
  res.json(result);
});

app.post('/api/rooms/quick-match', (req, res) => {
  const { playerName, playerId } = req.body;
  const result = quickMatchLogic(playerName, playerId);
  res.json(result);
});

app.post('/api/rooms/:code/join', (req, res) => {
  const { code } = req.params;
  const { playerName, playerId } = req.body;
  const result = joinRoomLogic(code, playerName, playerId);
  if ('error' in result) {
    res.status(400).json(result);
  } else {
    res.json(result);
  }
});

app.get('/api/rooms/:code', (req, res) => {
  const { code } = req.params;
  const room = rooms.get(String(code).toUpperCase().trim());
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const cutoff = Date.now() - 8000;
  res.json({
    room: getSanitizedRoomState(room),
    reactions: room.recentReactions.filter((r) => r.timestamp > cutoff),
  });
});

app.post('/api/rooms/:code/move', (req, res) => {
  const { code } = req.params;
  const { index, playerId } = req.body;
  const result = makeMoveLogic(code, Number(index), String(playerId));
  if ('error' in result) {
    res.status(400).json(result);
  } else {
    res.json(result);
  }
});

app.post('/api/rooms/:code/rematch', (req, res) => {
  const { code } = req.params;
  const { playerId } = req.body;
  const result = rematchLogic(code, String(playerId));
  if ('error' in result) {
    res.status(400).json(result);
  } else {
    res.json(result);
  }
});

app.post('/api/rooms/:code/reaction', (req, res) => {
  const { code } = req.params;
  const { playerId, emoji } = req.body;
  const result = reactionLogic(code, String(playerId), String(emoji));
  res.json(result);
});

app.post('/api/rooms/:code/bot', (req, res) => {
  const { code } = req.params;
  const result = addBotLogic(code);
  if ('error' in result) {
    res.status(400).json(result);
  } else {
    res.json(result);
  }
});

app.post('/api/rooms/:code/leave', (req, res) => {
  const { code } = req.params;
  const { playerId } = req.body;
  const room = rooms.get(String(code).toUpperCase().trim());
  if (room) {
    if (room.players.X && room.players.X.id === playerId) {
      room.players.X.connected = false;
      broadcastRoom(room);
      broadcastToRoom(room, {
        type: 'opponent_disconnected',
        message: `${room.players.X.name} left the match.`,
      });
    } else if (room.players.O && room.players.O.id === playerId) {
      room.players.O.connected = false;
      broadcastRoom(room);
      broadcastToRoom(room, {
        type: 'opponent_disconnected',
        message: `${room.players.O.name} left the match.`,
      });
    } else if (room.spectators.has(playerId)) {
      room.spectators.delete(playerId);
      broadcastRoom(room);
    }
  }
  res.json({ ok: true });
});

async function startServer() {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = request.url || '';
    if (url === '/ws' || url.startsWith('/ws?') || url.startsWith('/ws/')) {
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
    switch (msg.type) {
      case 'create_room': {
        createRoomLogic(
          String(msg.playerName || ''),
          String(msg.playerId || ''),
          Boolean(msg.isPublic),
          ws
        );
        break;
      }
      case 'quick_match': {
        quickMatchLogic(
          String(msg.playerName || ''),
          String(msg.playerId || ''),
          ws
        );
        break;
      }
      case 'join_room': {
        const res = joinRoomLogic(
          String(msg.code || ''),
          String(msg.playerName || ''),
          String(msg.playerId || ''),
          ws
        );
        if ('error' in res) {
          ws.send(JSON.stringify({ type: 'error', message: res.error }));
        }
        break;
      }
      case 'make_move': {
        makeMoveLogic(
          String(msg.code || ''),
          Number(msg.index),
          String(msg.playerId || '')
        );
        break;
      }
      case 'request_rematch': {
        rematchLogic(
          String(msg.code || ''),
          String(msg.playerId || '')
        );
        break;
      }
      case 'send_reaction': {
        reactionLogic(
          String(msg.code || ''),
          String(msg.playerId || ''),
          String(msg.emoji || '')
        );
        break;
      }
      case 'add_bot': {
        addBotLogic(String(msg.code || ''));
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

    if (room.players.X && room.players.X.id === meta.playerId) {
      room.players.X.connected = false;
      broadcastRoom(room);
      broadcastToRoom(room, {
        type: 'opponent_disconnected',
        message: `${room.players.X.name} disconnected.`,
      });
    } else if (room.players.O && room.players.O.id === meta.playerId) {
      room.players.O.connected = false;
      broadcastRoom(room);
      broadcastToRoom(room, {
        type: 'opponent_disconnected',
        message: `${room.players.O.name} disconnected.`,
      });
    } else if (room.spectators.has(meta.playerId)) {
      room.spectators.delete(meta.playerId);
      broadcastRoom(room);
    }

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
