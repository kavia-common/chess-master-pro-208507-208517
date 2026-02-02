import { coordToSquare } from "./coords";

const UNICODE = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

// PUBLIC_INTERFACE
export function pieceToUnicode(piece) {
  if (!piece) return "";
  return (UNICODE[piece.color] && UNICODE[piece.color][piece.type]) || "?";
}

// PUBLIC_INTERFACE
export function moveToPretty(move) {
  if (!move) return "";
  const from = coordToSquare(move.from);
  const to = coordToSquare(move.to);

  const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  const cap = move.capture ? "x" : "-";
  const special = move.isCastling ? (to[0] === "g" ? " (O-O)" : " (O-O-O)") : "";
  const ep = move.isEnPassant ? " e.p." : "";

  return `${from}${cap}${to}${promo}${special}${ep}`;
}
