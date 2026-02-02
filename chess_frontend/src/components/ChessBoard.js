import React, { useMemo } from "react";
import PieceIcon from "./PieceIcon";
import { coordToSquare, isSameCoord } from "../chess/coords";

/**
 * Interactive 8x8 chess board.
 * Uses callbacks for all state changes (unidirectional data flow).
 */
// PUBLIC_INTERFACE
export default function ChessBoard({
  board,
  perspective = "w",
  selected,
  hover,
  legalMoves,
  lastMove,
  onSquareClick,
  onSquareHover,
  disabled,
}) {
  const squares = useMemo(() => {
    // Build a list of squares to render based on perspective.
    const rows = [...Array(8).keys()];
    const cols = [...Array(8).keys()];

    const rowOrder = perspective === "w" ? rows : rows.slice().reverse();
    const colOrder = perspective === "w" ? cols : cols.slice().reverse();

    const out = [];
    for (const r of rowOrder) {
      for (const c of colOrder) {
        out.push({ r, c });
      }
    }
    return out;
  }, [perspective]);

  const moveTargets = useMemo(() => {
    const map = new Map();
    for (const m of legalMoves || []) {
      map.set(`${m.to.r},${m.to.c}`, m);
    }
    return map;
  }, [legalMoves]);

  return (
    <div className="Board" role="grid" aria-label="Chess board">
      {squares.map(({ r, c }, idx) => {
        const piece = board[r][c];
        const isLight = (r + c) % 2 === 0;

        const isSelected = selected ? isSameCoord(selected, { r, c }) : false;
        const isHover = hover ? isSameCoord(hover, { r, c }) : false;

        const targetMove = moveTargets.get(`${r},${c}`);
        const isHintMove = Boolean(targetMove && !targetMove.capture);
        const isHintCapture = Boolean(targetMove && targetMove.capture);

        const isLastFrom =
          lastMove && isSameCoord(lastMove.from, { r, c });
        const isLastTo =
          lastMove && isSameCoord(lastMove.to, { r, c });

        const classes = [
          "Square",
          isLight ? "SquareLight" : "SquareDark",
          isSelected ? "SquareSelected" : "",
          isHintMove ? "SquareHintMove" : "",
          isHintCapture ? "SquareHintCapture" : "",
          isHover ? "SquareHover" : "",
          isLastFrom || isLastTo ? "SquareHover" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const squareLabel = coordToSquare({ r, c });

        // Only show coordinate labels on the bottom-left area for readability.
        const showCoord =
          (perspective === "w" && r === 7 && c <= 1) ||
          (perspective === "b" && r === 0 && c >= 6);

        return (
          <div
            key={`${r}-${c}-${idx}`}
            role="gridcell"
            aria-label={squareLabel}
            className={classes}
            onClick={() => {
              if (!disabled) onSquareClick({ r, c });
            }}
            onMouseEnter={() => {
              if (!disabled) onSquareHover({ r, c });
            }}
          >
            {showCoord && <div className="SquareCoord">{squareLabel}</div>}
            <PieceIcon piece={piece} />
          </div>
        );
      })}
    </div>
  );
}
