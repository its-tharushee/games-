export type PlayerSymbol = 'X' | 'O';
export type BoardCell = PlayerSymbol | null;
export type Board = BoardCell[];

export type GameStatus = 'waiting' | 'in_progress' | 'won' | 'draw';

export interface RoomPlayer {
  id: string;
  name: string;
  symbol: PlayerSymbol;
  connected: boolean;
  score: number;
}

export interface RoomState {
  code: string;
  isPublic: boolean;
  players: {
    X?: RoomPlayer;
    O?: RoomPlayer;
  };
  spectatorsCount: number;
  board: Board;
  currentTurn: PlayerSymbol;
  status: GameStatus;
  winner: PlayerSymbol | null;
  winningLine: number[] | null;
  rematchRequestedBy: string | null;
  round: number;
  drawCount: number;
  lastMoveIndex: number | null;
}

export interface PublicRoomInfo {
  code: string;
  hostName: string;
  createdAt: number;
}

export type ClientMessage =
  | { type: 'join_room'; code: string; playerName: string; playerId: string; isPublic?: boolean }
  | { type: 'create_room'; playerName: string; playerId: string; isPublic?: boolean }
  | { type: 'quick_match'; playerName: string; playerId: string }
  | { type: 'make_move'; code: string; index: number; playerId: string }
  | { type: 'request_rematch'; code: string; playerId: string }
  | { type: 'send_reaction'; code: string; playerId: string; emoji: string }
  | { type: 'leave_room'; code: string; playerId: string };

export type ServerMessage =
  | { type: 'room_state'; room: RoomState; yourSymbol: PlayerSymbol | 'spectator' }
  | { type: 'reaction'; fromName: string; fromSymbol: PlayerSymbol | 'spectator'; emoji: string; id: string }
  | { type: 'error'; message: string }
  | { type: 'opponent_disconnected'; message: string }
  | { type: 'opponent_reconnected'; message: string };

export type GameMode = 'online' | 'local' | 'ai';
export type AIDifficulty = 'casual' | 'smart';
