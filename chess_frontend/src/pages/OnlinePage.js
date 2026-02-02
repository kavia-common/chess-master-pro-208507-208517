import React, { useMemo, useState } from "react";
import { useToast } from "../hooks/useToast";
import { createGame, joinGame } from "../services/chessApi";

function getOrCreatePlayerId() {
  const KEY = "nvchess.playerId.v1";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.trim()) return existing;

    const id = `p_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Fallback if storage is blocked.
    return `p_${Math.random().toString(16).slice(2, 12)}`;
  }
}

function mapColorPref(uiValue) {
  if (uiValue === "w") return "white";
  if (uiValue === "b") return "black";
  return "random";
}

function mapYourColorToSide(yourColor) {
  if (yourColor === "white") return "w";
  if (yourColor === "black") return "b";
  return "w";
}

// PUBLIC_INTERFACE
export default function OnlinePage({ onBack, onEnterRoom }) {
  const { pushToast } = useToast();

  const [playerId] = useState(() => getOrCreatePlayerId());
  const [playerName, setPlayerName] = useState("Player");

  const [gameId, setGameId] = useState("");
  const [sidePref, setSidePref] = useState("random"); // w | b | random

  const [initialMinutes, setInitialMinutes] = useState(5);
  const [incrementSeconds, setIncrementSeconds] = useState(0);

  const canEnter = useMemo(() => gameId.trim().length >= 6, [gameId]);

  const doCreate = async () => {
    try {
      const res = await createGame({
        playerId,
        playerName,
        colorPreference: mapColorPref(sidePref),
      });

      const createdId = res?.game?.id;
      const yourColor = res?.yourColor;

      if (!createdId) {
        pushToast({ title: "Create failed", message: "Backend did not return a game id." });
        return;
      }

      setGameId(createdId);
      pushToast({
        title: "Game created",
        message: `Game ID: ${createdId} (${yourColor || "spectator"})`,
      });

      onEnterRoom({
        gameId: createdId,
        playerId,
        playerName,
        side: mapYourColorToSide(yourColor),
        initialMinutes,
        incrementSeconds,
      });
    } catch (e) {
      pushToast({
        title: "Create failed",
        message: String(e?.message || e),
      });
    }
  };

  const doJoin = async () => {
    try {
      const id = gameId.trim();
      const res = await joinGame({
        gameId: id,
        playerId,
        playerName,
        colorPreference: mapColorPref(sidePref),
      });

      const yourColor = res?.yourColor;
      pushToast({
        title: "Joined game",
        message: `Joined ${id} as ${yourColor || "spectator"}`,
      });

      onEnterRoom({
        gameId: id,
        playerId,
        playerName,
        side: mapYourColorToSide(yourColor),
        initialMinutes,
        incrementSeconds,
      });
    } catch (e) {
      pushToast({
        title: "Join failed",
        message: String(e?.message || e),
      });
    }
  };

  return (
    <div className="NVRow">
      <section className="NVCard">
        <div className="NVCardHeader">
          <h2 className="NVTitle">Online Multiplayer</h2>
          <p className="NVSubtitle">
            Create or join a server-hosted game (REST), then play in real-time (WebSocket). If the backend is unavailable,
            you’ll see an error toast.
          </p>
        </div>

        <div className="NVCardBody">
          <div className="NVGrid2">
            <div>
              <label className="NVLabel" htmlFor="playerName">
                Player name
              </label>
              <input
                id="playerName"
                className="NVInput"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Alice"
              />
            </div>

            <div>
              <label className="NVLabel" htmlFor="side">
                Color preference
              </label>
              <select id="side" className="NVSelect" value={sidePref} onChange={(e) => setSidePref(e.target.value)}>
                <option value="random">Random</option>
                <option value="w">White</option>
                <option value="b">Black</option>
              </select>
            </div>
          </div>

          <div className="NVHr" />

          <div className="NVGrid2">
            <div>
              <label className="NVLabel" htmlFor="gameId">
                Game ID
              </label>
              <input
                id="gameId"
                className="NVInput"
                value={gameId}
                onChange={(e) => setGameId(e.target.value.trim())}
                placeholder="12-char id (from Create / Share)"
              />
            </div>

            <div>
              <label className="NVLabel" htmlFor="playerId">
                Player ID (auto)
              </label>
              <input id="playerId" className="NVInput" value={playerId} readOnly />
            </div>
          </div>

          <div className="NVHr" />

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

          <div className="NVButtonRow">
            <button className="NVButton NVButtonSecondary" type="button" onClick={onBack}>
              Back
            </button>

            <button className="NVButton" type="button" onClick={doCreate}>
              Create & Enter
            </button>

            <button className="NVButton" type="button" disabled={!canEnter} onClick={doJoin}>
              Join & Enter
            </button>
          </div>

          {!canEnter && (
            <p className="NVSubtitle" style={{ marginTop: 10 }}>
              Enter a Game ID (≥ 6 chars) to join, or click Create.
            </p>
          )}
        </div>
      </section>

      <aside className="NVCard">
        <div className="Sidebar">
          <h3 className="SidebarSectionTitle">How it works</h3>
          <div className="StatusBanner">
            <strong>REST:</strong> create/join/save/load.
            <br />
            <strong>WS:</strong> /ws (join → sync → move_applied/state).
            <br />
            Reconnect is handled automatically; state sync replays server move history into the local engine.
          </div>
        </div>
      </aside>
    </div>
  );
}
