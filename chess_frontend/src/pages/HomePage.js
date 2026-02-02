import React, { useState } from "react";

// PUBLIC_INTERFACE
export default function HomePage({ onStartGame, onGoOnline }) {
  const [aiDepth, setAiDepth] = useState(2);
  const [playerPlays, setPlayerPlays] = useState("w");
  const [initialMinutes, setInitialMinutes] = useState(5);
  const [incrementSeconds, setIncrementSeconds] = useState(0);

  return (
    <div className="NVRow">
      <section className="NVCard">
        <div className="NVCardHeader">
          <h2 className="NVTitle">Start</h2>
          <p className="NVSubtitle">
            Retro neon UI + full legal move validation (castling, en passant, promotion), undo/redo, save/load, clock, AI,
            and online scaffolding.
          </p>
        </div>

        <div className="NVCardBody">
          <div className="NVGrid2">
            <div>
              <label className="NVLabel" htmlFor="minutes">
                Clock minutes
              </label>
              <input
                id="minutes"
                className="NVInput"
                type="number"
                min="0"
                max="120"
                value={initialMinutes}
                onChange={(e) => setInitialMinutes(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="NVLabel" htmlFor="inc">
                Increment seconds
              </label>
              <input
                id="inc"
                className="NVInput"
                type="number"
                min="0"
                max="60"
                value={incrementSeconds}
                onChange={(e) => setIncrementSeconds(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="NVHr" />

          <div className="NVSplit">
            <div>
              <h3 className="SidebarSectionTitle">Local</h3>
              <p className="NVSubtitle">Two players on one device.</p>
            </div>
            <button
              className="NVButton"
              type="button"
              onClick={() =>
                onStartGame({
                  mode: "LOCAL",
                  aiDepth: 0,
                  playerPlays: "w",
                  initialMinutes,
                  incrementSeconds,
                  room: null,
                })
              }
            >
              Play Local
            </button>
          </div>

          <div className="NVHr" />

          <div className="NVGrid2">
            <div>
              <label className="NVLabel" htmlFor="side">
                You play as
              </label>
              <select
                id="side"
                className="NVSelect"
                value={playerPlays}
                onChange={(e) => setPlayerPlays(e.target.value)}
              >
                <option value="w">White</option>
                <option value="b">Black</option>
              </select>
            </div>
            <div>
              <label className="NVLabel" htmlFor="depth">
                AI difficulty (depth)
              </label>
              <select
                id="depth"
                className="NVSelect"
                value={aiDepth}
                onChange={(e) => setAiDepth(Number(e.target.value))}
              >
                <option value={1}>1 (Very Easy)</option>
                <option value={2}>2 (Easy)</option>
                <option value={3}>3 (Medium)</option>
              </select>
            </div>
          </div>

          <div className="NVButtonRow" style={{ marginTop: 12 }}>
            <button
              className="NVButton"
              type="button"
              onClick={() =>
                onStartGame({
                  mode: "AI",
                  aiDepth,
                  playerPlays,
                  initialMinutes,
                  incrementSeconds,
                  room: null,
                })
              }
            >
              Play vs AI
            </button>

            <button className="NVButton NVButtonSecondary" type="button" onClick={onGoOnline}>
              Online Multiplayer
            </button>
          </div>
        </div>
      </section>

      <aside className="NVCard">
        <div className="Sidebar">
          <h3 className="SidebarSectionTitle">Tips</h3>
          <div className="StatusBanner">
            <div className="NVBadge" style={{ marginBottom: 10 }}>
              <span className="NVBadgeDot" />
              Engine-aware highlights
            </div>
            Select a piece to see legal moves. The engine filters out moves that would leave your king in check.
          </div>

          <div className="NVHr" />

          <div className="StatusBanner">
            <div className="NVBadge" style={{ marginBottom: 10 }}>
              <span className="NVBadgeDot" />
              Save & Load
            </div>
            Save/load uses localStorage by default. Online save/load hooks are included, but backend endpoints may not be
            available yet.
          </div>
        </div>
      </aside>
    </div>
  );
}
