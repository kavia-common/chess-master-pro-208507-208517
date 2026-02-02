import React from "react";
import { pieceToUnicode } from "../chess/notation";

/**
 * Renders a chess piece as an SVG icon (using unicode glyphs inside <text>).
 * This keeps the UI crisp and themeable without external image assets.
 */
// PUBLIC_INTERFACE
export default function PieceIcon({ piece }) {
  if (!piece) return null;

  const symbol = pieceToUnicode(piece);
  const fill = piece.color === "w" ? "rgba(255,255,255,0.95)" : "rgba(17,24,39,0.92)";
  const stroke = piece.color === "w" ? "rgba(17,24,39,0.55)" : "rgba(255,255,255,0.45)";

  return (
    <svg className="PieceSvg" viewBox="0 0 100 100" role="img" aria-label={`${piece.color} ${piece.type}`}>
      <defs>
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.5  0 1 0 0 0.2  0 0 1 0 0.9  0 0 0 0.6 0"
            result="colorBlur"
          />
          <feMerge>
            <feMergeNode in="colorBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <text
        x="50"
        y="68"
        textAnchor="middle"
        className="PieceText"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        filter="url(#neonGlow)"
      >
        {symbol}
      </text>
    </svg>
  );
}
