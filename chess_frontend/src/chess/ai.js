import { createInitialState, generateLegalMovesForSquare, makeMove } from "./engine";

function other(color) {
  return color === "w" ? "b" : "w";
}

const PIECE_VALUE = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

function evaluate(state) {
  // Positive means advantage for side to move? We'll compute from White perspective for stability.
  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p) continue;
      const v = PIECE_VALUE[p.type] || 0;
      score += p.color === "w" ? v : -v;
    }
  }
  return score;
}

function generateAllMoves(state) {
  const out = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p || p.color !== state.turn) continue;
      out.push(...generateLegalMovesForSquare(state, { r, c }));
    }
  }
  return out;
}

function minimax(state, depth, alpha, beta) {
  if (depth <= 0) {
    return { score: evaluate(state), bestMove: null };
  }

  const moves = generateAllMoves(state);
  if (moves.length === 0) {
    // No legal moves: treat as very bad for side to move (checkmate/stalemate).
    // We can't easily know checkmate here without status; approximate using material + penalty.
    return { score: evaluate(state) - 5000, bestMove: null };
  }

  const maximizing = state.turn === "w";
  let bestMove = null;

  if (maximizing) {
    let bestScore = -Infinity;
    for (const m of moves) {
      const res = makeMove(state, m);
      if (!res.ok || res.promotionRequired) continue;

      const child = minimax(res.state, depth - 1, alpha, beta);
      if (child.score > bestScore) {
        bestScore = child.score;
        bestMove = m;
      }
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break;
    }
    return { score: bestScore, bestMove };
  }

  let bestScore = Infinity;
  for (const m of moves) {
    const res = makeMove(state, m);
    if (!res.ok || res.promotionRequired) continue;

    const child = minimax(res.state, depth - 1, alpha, beta);
    if (child.score < bestScore) {
      bestScore = child.score;
      bestMove = m;
    }
    beta = Math.min(beta, bestScore);
    if (beta <= alpha) break;
  }
  return { score: bestScore, bestMove };
}

// PUBLIC_INTERFACE
export function chooseAiMove(state, depth) {
  // Safety: ensure depth is reasonable.
  const d = Math.max(1, Math.min(3, Number(depth) || 2));

  // Make sure state is valid
  if (!state || !state.board) {
    // fallback to avoid crashes
    const s = createInitialState();
    return minimax(s, d, -Infinity, Infinity).bestMove;
  }

  // For promotions: this simple AI avoids lines requiring a promotion choice.
  const result = minimax(state, d, -Infinity, Infinity);
  return result.bestMove;
}
