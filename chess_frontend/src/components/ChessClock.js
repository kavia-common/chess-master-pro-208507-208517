import React from "react";
import { formatClockMs } from "../utils/time";

// PUBLIC_INTERFACE
export default function ChessClock({ clocks, activeColor }) {
  const wActive = activeColor === "w";
  const bActive = activeColor === "b";

  return (
    <div className="ClockRow" aria-label="Chess clocks">
      <div className={`ClockCard ${wActive ? "ClockActive" : ""}`}>
        <p className="ClockName">White</p>
        <p className="ClockTime">{formatClockMs(clocks.w)}</p>
      </div>
      <div className={`ClockCard ${bActive ? "ClockActive" : ""}`}>
        <p className="ClockName">Black</p>
        <p className="ClockTime">{formatClockMs(clocks.b)}</p>
      </div>
    </div>
  );
}
