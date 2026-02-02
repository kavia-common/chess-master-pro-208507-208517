import React, { useMemo, useState } from "react";
import { createRoomCode } from "../utils/roomCode";
import { useToast } from "../hooks/useToast";

// PUBLIC_INTERFACE
export default function OnlinePage({ onBack, onEnterRoom }) {
  const { pushToast } = useToast();

  const [roomCode, setRoomCode] = useState("");
  const [side, setSide] = useState("w");
  const [initialMinutes, setInitialMinutes] = useState(5);
  const [incrementSeconds, setIncrementSeconds] = useState(0);

  const canEnter = useMemo(() => roomCode.trim().length >= 4, [roomCode]);

  const createRoom = () => {
    const newCode = createRoomCode();
    setRoomCode(newCode);
    pushToast({
      title: "Room created",
      message: `Share code: ${newCode}`,
    });
  };

  return (
    <div className="NVRow">
      <section className="NVCard">
        <div className="NVCardHeader">
          <h2 className="NVTitle">Online Multiplayer</h2>
          <p className="NVSubtitle">
            This screen prepares a room code and side selection. The game screen will attempt a WebSocket connection; if the
            backend isn’t available, you can still play locally.
          </p>
        </div>

        <div className="NVCardBody">
          <div className="NVGrid2">
            <div>
              <label className="NVLabel" htmlFor="room">
                Room code
              </label>
              <input
                id="room"
                className="NVInput"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD12"
              />
            </div>

            <div>
              <label className="NVLabel" htmlFor="side">
                Your side
              </label>
              <select id="side" className="NVSelect" value={side} onChange={(e) => setSide(e.target.value)}>
                <option value="w">White</option>
                <option value="b">Black</option>
              </select>
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

            <button className="NVButton" type="button" onClick={createRoom}>
              Create Room
            </button>

            <button
              className="NVButton"
              type="button"
              disabled={!canEnter}
              onClick={() => onEnterRoom({ roomCode: roomCode.trim(), side, initialMinutes, incrementSeconds })}
            >
              Enter Room
            </button>
          </div>

          {!canEnter && (
            <p className="NVSubtitle" style={{ marginTop: 10 }}>
              Enter a room code (≥ 4 chars) or click Create Room.
            </p>
          )}
        </div>
      </section>

      <aside className="NVCard">
        <div className="Sidebar">
          <h3 className="SidebarSectionTitle">Backend Note</h3>
          <div className="StatusBanner">
            The backend OpenAPI currently exposes only a health endpoint. This frontend includes WebSocket scaffolding and
            will show a toast if it can’t connect.
          </div>
        </div>
      </aside>
    </div>
  );
}
