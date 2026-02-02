import { inBounds, isSameCoord } from "./coords";

/**
 * Game state model (minimal but complete):
 * - board: 8x8 array of pieces or null
 * - turn: 'w' | 'b'
 * - castling: { w: { K, Q }, b: { K, Q } }
 * - enPassant: { r, c } | null (target square where a pawn could capture en passant)
 * - halfmove: number
 * - fullmove: number
 *
 * Piece model:
 * - { type: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b' }
 */

function emptyBoard() {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

function cloneBoard(board) {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function other(color) {
  return color === "w" ? "b" : "w";
}

function pieceAt(state, coord) {
  return state.board[coord.r][coord.c];
}

function setPiece(board, coord, piece) {
  board[coord.r][coord.c] = piece;
}

function findKing(state, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (p && p.color === color && p.type === "k") return { r, c };
    }
  }
  return null;
}

function isSquareAttacked(state, target, byColor) {
  // Pawns: attacks are diagonals
  const pawnDir = byColor === "w" ? -1 : 1;
  for (const dc of [-1, 1]) {
    const from = { r: target.r - pawnDir, c: target.c - dc };
    if (inBounds(from)) {
      const p = pieceAt(state, from);
      if (p && p.color === byColor && p.type === "p") return true;
    }
  }

  // Knights
  const knightDeltas = [
    { dr: -2, dc: -1 },
    { dr: -2, dc: 1 },
    { dr: -1, dc: -2 },
    { dr: -1, dc: 2 },
    { dr: 1, dc: -2 },
    { dr: 1, dc: 2 },
    { dr: 2, dc: -1 },
    { dr: 2, dc: 1 },
  ];
  for (const d of knightDeltas) {
    const from = { r: target.r + d.dr, c: target.c + d.dc };
    if (!inBounds(from)) continue;
    const p = pieceAt(state, from);
    if (p && p.color === byColor && p.type === "n") return true;
  }

  // Sliding pieces (bishop/rook/queen)
  const rays = [
    // bishop rays
    { dr: -1, dc: -1, types: ["b", "q"] },
    { dr: -1, dc: 1, types: ["b", "q"] },
    { dr: 1, dc: -1, types: ["b", "q"] },
    { dr: 1, dc: 1, types: ["b", "q"] },
    // rook rays
    { dr: -1, dc: 0, types: ["r", "q"] },
    { dr: 1, dc: 0, types: ["r", "q"] },
    { dr: 0, dc: -1, types: ["r", "q"] },
    { dr: 0, dc: 1, types: ["r", "q"] },
  ];
  for (const ray of rays) {
    let cur = { r: target.r + ray.dr, c: target.c + ray.dc };
    while (inBounds(cur)) {
      const p = pieceAt(state, cur);
      if (p) {
        if (p.color === byColor && ray.types.includes(p.type)) return true;
        break;
      }
      cur = { r: cur.r + ray.dr, c: cur.c + ray.dc };
    }
  }

  // King adjacency
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const from = { r: target.r + dr, c: target.c + dc };
      if (!inBounds(from)) continue;
      const p = pieceAt(state, from);
      if (p && p.color === byColor && p.type === "k") return true;
    }
  }

  return false;
}

function isInCheck(state, color) {
  const king = findKing(state, color);
  if (!king) return false;
  return isSquareAttacked(state, king, other(color));
}

function addMove(moves, base) {
  moves.push({
    ...base,
    capture: Boolean(base.capture),
    isEnPassant: Boolean(base.isEnPassant),
    isCastling: Boolean(base.isCastling),
  });
}

function genPawnMoves(state, from, piece, moves) {
  const dir = piece.color === "w" ? -1 : 1;
  const startRank = piece.color === "w" ? 6 : 1;
  const lastRank = piece.color === "w" ? 0 : 7;

  // forward one
  const f1 = { r: from.r + dir, c: from.c };
  if (inBounds(f1) && !pieceAt(state, f1)) {
    addMove(moves, { from, to: f1, piece });

    // forward two from start
    const f2 = { r: from.r + 2 * dir, c: from.c };
    if (from.r === startRank && inBounds(f2) && !pieceAt(state, f2)) {
      addMove(moves, { from, to: f2, piece, isDoublePawnPush: true });
    }
  }

  // captures
  for (const dc of [-1, 1]) {
    const to = { r: from.r + dir, c: from.c + dc };
    if (!inBounds(to)) continue;
    const target = pieceAt(state, to);
    if (target && target.color !== piece.color) {
      addMove(moves, { from, to, piece, capture: target });
    }
  }

  // en passant
  if (state.enPassant) {
    for (const dc of [-1, 1]) {
      const to = { r: from.r + dir, c: from.c + dc };
      if (!inBounds(to)) continue;
      if (to.r === state.enPassant.r && to.c === state.enPassant.c) {
        // capture pawn behind target square
        const capturedPawn = { r: from.r, c: from.c + dc };
        const target = pieceAt(state, capturedPawn);
        if (target && target.type === "p" && target.color !== piece.color) {
          addMove(moves, { from, to, piece, capture: target, isEnPassant: true, enPassantCaptured: capturedPawn });
        }
      }
    }
  }

  // promotion is handled during makeMove (if pawn reaches last rank)
  // (we still generate the move normally)
  // Note: legality filtering will handle king safety.
  // lastRank variable intentionally unused here.
  void lastRank;
}

function genKnightMoves(state, from, piece, moves) {
  const deltas = [
    { dr: -2, dc: -1 },
    { dr: -2, dc: 1 },
    { dr: -1, dc: -2 },
    { dr: -1, dc: 2 },
    { dr: 1, dc: -2 },
    { dr: 1, dc: 2 },
    { dr: 2, dc: -1 },
    { dr: 2, dc: 1 },
  ];
  for (const d of deltas) {
    const to = { r: from.r + d.dr, c: from.c + d.dc };
    if (!inBounds(to)) continue;
    const target = pieceAt(state, to);
    if (!target) addMove(moves, { from, to, piece });
    else if (target.color !== piece.color) addMove(moves, { from, to, piece, capture: target });
  }
}

function genSlidingMoves(state, from, piece, moves, directions) {
  for (const d of directions) {
    let to = { r: from.r + d.dr, c: from.c + d.dc };
    while (inBounds(to)) {
      const target = pieceAt(state, to);
      if (!target) {
        addMove(moves, { from, to, piece });
      } else {
        if (target.color !== piece.color) addMove(moves, { from, to, piece, capture: target });
        break;
      }
      to = { r: to.r + d.dr, c: to.c + d.dc };
    }
  }
}

function genKingMoves(state, from, piece, moves) {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const to = { r: from.r + dr, c: from.c + dc };
      if (!inBounds(to)) continue;
      const target = pieceAt(state, to);
      if (!target) addMove(moves, { from, to, piece });
      else if (target.color !== piece.color) addMove(moves, { from, to, piece, capture: target });
    }
  }

  // Castling: ensure squares are empty and not attacked.
  const rights = state.castling[piece.color];
  const homeRow = piece.color === "w" ? 7 : 0;

  if (from.r === homeRow && from.c === 4) {
    // Kingside
    if (rights.K) {
      const f = { r: homeRow, c: 5 };
      const g = { r: homeRow, c: 6 };
      const rook = pieceAt(state, { r: homeRow, c: 7 });
      const squaresEmpty = !pieceAt(state, f) && !pieceAt(state, g);
      if (rook && rook.type === "r" && rook.color === piece.color && squaresEmpty) {
        // not in check, and squares passed through not attacked
        if (!isInCheck(state, piece.color) && !isSquareAttacked(state, f, other(piece.color)) && !isSquareAttacked(state, g, other(piece.color))) {
          addMove(moves, {
            from,
            to: g,
            piece,
            isCastling: true,
            rookFrom: { r: homeRow, c: 7 },
            rookTo: f,
          });
        }
      }
    }

    // Queenside
    if (rights.Q) {
      const d = { r: homeRow, c: 3 };
      const cSq = { r: homeRow, c: 2 };
      const b = { r: homeRow, c: 1 };
      const rook = pieceAt(state, { r: homeRow, c: 0 });
      const squaresEmpty = !pieceAt(state, d) && !pieceAt(state, cSq) && !pieceAt(state, b);
      if (rook && rook.type === "r" && rook.color === piece.color && squaresEmpty) {
        if (!isInCheck(state, piece.color) && !isSquareAttacked(state, d, other(piece.color)) && !isSquareAttacked(state, cSq, other(piece.color))) {
          addMove(moves, {
            from,
            to: cSq,
            piece,
            isCastling: true,
            rookFrom: { r: homeRow, c: 0 },
            rookTo: d,
          });
        }
      }
    }
  }
}

function generatePseudoMoves(state, from) {
  const piece = pieceAt(state, from);
  if (!piece) return [];
  if (piece.color !== state.turn) return [];

  const moves = [];
  switch (piece.type) {
    case "p":
      genPawnMoves(state, from, piece, moves);
      break;
    case "n":
      genKnightMoves(state, from, piece, moves);
      break;
    case "b":
      genSlidingMoves(
        state,
        from,
        piece,
        moves,
        [
          { dr: -1, dc: -1 },
          { dr: -1, dc: 1 },
          { dr: 1, dc: -1 },
          { dr: 1, dc: 1 },
        ]
      );
      break;
    case "r":
      genSlidingMoves(
        state,
        from,
        piece,
        moves,
        [
          { dr: -1, dc: 0 },
          { dr: 1, dc: 0 },
          { dr: 0, dc: -1 },
          { dr: 0, dc: 1 },
        ]
      );
      break;
    case "q":
      genSlidingMoves(
        state,
        from,
        piece,
        moves,
        [
          { dr: -1, dc: -1 },
          { dr: -1, dc: 1 },
          { dr: 1, dc: -1 },
          { dr: 1, dc: 1 },
          { dr: -1, dc: 0 },
          { dr: 1, dc: 0 },
          { dr: 0, dc: -1 },
          { dr: 0, dc: 1 },
        ]
      );
      break;
    case "k":
      genKingMoves(state, from, piece, moves);
      break;
    default:
      break;
  }
  return moves;
}

function applyMoveToState(state, move) {
  const next = {
    ...state,
    board: cloneBoard(state.board),
    turn: other(state.turn),
    enPassant: null,
    castling: {
      w: { ...state.castling.w },
      b: { ...state.castling.b },
    },
    halfmove: state.halfmove + 1,
    fullmove: state.fullmove + (state.turn === "b" ? 1 : 0),
  };

  const piece = pieceAt(state, move.from);
  if (!piece) {
    return { ok: false, reason: "No piece on from-square." };
  }
  if (piece.color !== state.turn) {
    return { ok: false, reason: "Not your turn." };
  }

  const target = pieceAt(state, move.to);

  // Reset halfmove clock on pawn move or capture
  if (piece.type === "p" || target || move.isEnPassant) next.halfmove = 0;

  // Castling rights updates: king or rook moves; rook captured
  const homeRow = piece.color === "w" ? 7 : 0;
  if (piece.type === "k") {
    next.castling[piece.color].K = false;
    next.castling[piece.color].Q = false;
  }
  if (piece.type === "r" && move.from.r === homeRow) {
    if (move.from.c === 0) next.castling[piece.color].Q = false;
    if (move.from.c === 7) next.castling[piece.color].K = false;
  }
  if (target && target.type === "r") {
    const targetHomeRow = target.color === "w" ? 7 : 0;
    if (move.to.r === targetHomeRow) {
      if (move.to.c === 0) next.castling[target.color].Q = false;
      if (move.to.c === 7) next.castling[target.color].K = false;
    }
  }

  // Handle en passant capture
  if (move.isEnPassant && move.enPassantCaptured) {
    setPiece(next.board, move.enPassantCaptured, null);
  }

  // Move piece
  setPiece(next.board, move.from, null);

  // Promotion: if a pawn reaches last rank, require a promotion piece.
  let movedPiece = piece;
  const lastRank = piece.color === "w" ? 0 : 7;
  if (piece.type === "p" && move.to.r === lastRank) {
    if (!move.promotion) {
      return { ok: true, promotionRequired: true };
    }
    movedPiece = { ...piece, type: move.promotion };
  }

  setPiece(next.board, move.to, movedPiece);

  // Set en passant target after double pawn push
  if (piece.type === "p" && move.isDoublePawnPush) {
    const mid = { r: (move.from.r + move.to.r) / 2, c: move.from.c };
    next.enPassant = { r: mid.r, c: mid.c };
  }

  // Castling rook movement
  if (move.isCastling && move.rookFrom && move.rookTo) {
    const rook = pieceAt(state, move.rookFrom);
    setPiece(next.board, move.rookFrom, null);
    setPiece(next.board, move.rookTo, rook);
  }

  return { ok: true, state: next };
}

function isLegalMove(state, move) {
  const applied = applyMoveToState(state, move);
  if (!applied.ok) return { ok: false, reason: applied.reason || "Move application failed." };
  if (applied.promotionRequired) return { ok: true, promotionRequired: true };

  // Ensure you didn't leave your king in check after the move.
  const movedColor = state.turn;
  if (isInCheck(applied.state, movedColor)) {
    return { ok: false, reason: "Move leaves king in check." };
  }
  return { ok: true, state: applied.state };
}

// PUBLIC_INTERFACE
export function createInitialState() {
  const b = emptyBoard();

  // Black pieces
  const blackBack = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < 8; c += 1) {
    b[0][c] = { type: blackBack[c], color: "b" };
    b[1][c] = { type: "p", color: "b" };
  }

  // White pieces
  const whiteBack = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < 8; c += 1) {
    b[7][c] = { type: whiteBack[c], color: "w" };
    b[6][c] = { type: "p", color: "w" };
  }

  return {
    board: b,
    turn: "w",
    castling: { w: { K: true, Q: true }, b: { K: true, Q: true } },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  };
}

// PUBLIC_INTERFACE
export function generateLegalMovesForSquare(state, from) {
  const pseudo = generatePseudoMoves(state, from);
  const legal = [];
  for (const m of pseudo) {
    const res = isLegalMove(state, m);
    if (res.ok) legal.push(m);
  }
  return legal;
}

function generateAllLegalMoves(state) {
  const out = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (!p || p.color !== state.turn) continue;
      const moves = generateLegalMovesForSquare(state, { r, c });
      out.push(...moves);
    }
  }
  return out;
}

// PUBLIC_INTERFACE
export function makeMove(state, move) {
  // Ensure the move matches a legal move (including special move flags).
  const legalFrom = generateLegalMovesForSquare(state, move.from);

  const found = legalFrom.find((m) => {
    const sameTo = isSameCoord(m.to, move.to);
    const samePromo = (m.promotion || null) === (move.promotion || null);
    // For promotions, m.promotion may be empty until chosen; accept move with promotion later.
    const promoCompatible = m.promotion ? samePromo : true;
    return sameTo && promoCompatible;
  });

  if (!found) {
    return { ok: false, reason: "Move not legal." };
  }

  // Merge canonical flags from generated move (en passant/castling/double push).
  const canonical = {
    ...found,
    promotion: move.promotion || found.promotion || null,
  };

  const res = isLegalMove(state, canonical);
  if (!res.ok) return { ok: false, reason: res.reason || "Illegal." };
  if (res.promotionRequired) return { ok: true, promotionRequired: true };
  return { ok: true, state: res.state };
}

// PUBLIC_INTERFACE
export function getStatus(state) {
  const inCheck = isInCheck(state, state.turn);
  const legalMoves = generateAllLegalMoves(state);

  if (legalMoves.length === 0) {
    if (inCheck) {
      const winner = other(state.turn);
      return {
        kind: "checkmate",
        winner,
        winnerLabel: winner === "w" ? "White" : "Black",
        note: "Checkmate",
        inCheck: true,
      };
    }
    return { kind: "stalemate", note: "Stalemate", inCheck: false };
  }

  // 50-move rule (simple): halfmove >= 100
  if (state.halfmove >= 100) {
    return { kind: "draw", note: "Draw (50-move rule)", inCheck: false };
  }

  return { kind: "ongoing", note: inCheck ? "Check" : "", inCheck };
}

// PUBLIC_INTERFACE
export function normalizeMoveForTransport(move) {
  // Strip volatile fields; keep the core info needed to replay the move deterministically.
  return {
    from: { r: move.from.r, c: move.from.c },
    to: { r: move.to.r, c: move.to.c },
    promotion: move.promotion || null,
    isEnPassant: Boolean(move.isEnPassant),
    isCastling: Boolean(move.isCastling),
    isDoublePawnPush: Boolean(move.isDoublePawnPush),
    enPassantCaptured: move.enPassantCaptured ? { ...move.enPassantCaptured } : null,
    rookFrom: move.rookFrom ? { ...move.rookFrom } : null,
    rookTo: move.rookTo ? { ...move.rookTo } : null,
    capture: move.capture ? { ...move.capture } : null,
    piece: move.piece ? { ...move.piece } : null,
  };
}
