import React from "react";
import { moveToPretty } from "../chess/notation";

// PUBLIC_INTERFACE
export default function MoveHistory({ moves }) {
  return (
    <ul className="MoveList" aria-label="Move history">
      {moves.length === 0 && (
        <li className="MoveItem">
          <span className="MoveIndex">—</span>
          <span className="MoveText">No moves yet</span>
          <span className="MoveText" />
        </li>
      )}

      {moves.map((m, i) => {
        const ply = i + 1;
        const moveNo = Math.ceil(ply / 2);
        const side = ply % 2 === 1 ? "W" : "B";
        return (
          <li key={`${i}-${m.id || ""}`} className="MoveItem">
            <span className="MoveIndex">
              {moveNo}.{side}
            </span>
            <span className="MoveText">{moveToPretty(m)}</span>
            <span className="MoveText">{m.meta?.statusNote || ""}</span>
          </li>
        );
      })}
    </ul>
  );
}
