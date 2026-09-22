import { Board, BoardCell, PlayerSymbol } from '../types';

export const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function checkWinner(board: Board): { winner: PlayerSymbol | null; winningLine: number[] | null } {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as PlayerSymbol, winningLine: combo };
    }
  }
  return { winner: null, winningLine: null };
}

export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

export function getAvailableMoves(board: Board): number[] {
  const moves: number[] = [];
  board.forEach((cell, idx) => {
    if (cell === null) moves.push(idx);
  });
  return moves;
}

// Minimax algorithm for smart AI
function minimax(
  board: Board,
  depth: number,
  isMaximizing: boolean,
  aiSymbol: PlayerSymbol,
  humanSymbol: PlayerSymbol
): { score: number; move?: number } {
  const { winner } = checkWinner(board);
  if (winner === aiSymbol) return { score: 10 - depth };
  if (winner === humanSymbol) return { score: depth - 10 };
  if (isBoardFull(board)) return { score: 0 };

  const availableMoves = getAvailableMoves(board);

  if (isMaximizing) {
    let bestScore = -Infinity;
    let bestMove = availableMoves[0];

    for (const move of availableMoves) {
      board[move] = aiSymbol;
      const result = minimax(board, depth + 1, false, aiSymbol, humanSymbol);
      board[move] = null;

      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
    }
    return { score: bestScore, move: bestMove };
  } else {
    let bestScore = Infinity;
    let bestMove = availableMoves[0];

    for (const move of availableMoves) {
      board[move] = humanSymbol;
      const result = minimax(board, depth + 1, true, aiSymbol, humanSymbol);
      board[move] = null;

      if (result.score < bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
    }
    return { score: bestScore, move: bestMove };
  }
}

export function getAIMove(
  board: Board,
  aiSymbol: PlayerSymbol,
  difficulty: 'casual' | 'smart'
): number {
  const available = getAvailableMoves(board);
  if (available.length === 0) return -1;

  const humanSymbol: PlayerSymbol = aiSymbol === 'X' ? 'O' : 'X';

  if (difficulty === 'casual') {
    // 60% random, 40% smart
    if (Math.random() > 0.4) {
      const randomIndex = Math.floor(Math.random() * available.length);
      return available[randomIndex];
    }
  }

  // Smart Minimax
  const result = minimax(board, 0, true, aiSymbol, humanSymbol);
  return result.move !== undefined ? result.move : available[0];
}
