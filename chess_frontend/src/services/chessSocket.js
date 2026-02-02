/**
 * A minimal WebSocket client intended for a future multiplayer backend.
 * Message convention (JSON):
 * - { type: "join", roomCode, side }
 * - { type: "move", roomCode, move }
 * - { type: "info", message }
 * - { type: "error", message }
 *
 * The backend for this project currently may not implement this yet; the UI will
 * surface connection problems via toast messages.
 */

// PUBLIC_INTERFACE
export function createSocketClient({ wsUrl, roomCode, side, onStatus, onRemoteMove, onInfo, onError }) {
  let socket = null;
  let status = { status: "idle", roomCode };

  const setStatus = (s) => {
    status = s;
    if (typeof onStatus === "function") onStatus(s);
  };

  const safeCall = (fn, arg) => {
    try {
      if (typeof fn === "function") fn(arg);
    } catch {
      // ignore callback failures
    }
  };

  const connect = () => {
    try {
      setStatus({ status: "connecting", roomCode });

      socket = new window.WebSocket(wsUrl);

      socket.addEventListener("open", () => {
        setStatus({ status: "connected", roomCode });
        socket.send(JSON.stringify({ type: "join", roomCode, side }));
        safeCall(onInfo, `Connected to ${roomCode}`);
      });

      socket.addEventListener("message", (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "move" && msg.move) {
            safeCall(onRemoteMove, msg.move);
          } else if (msg.type === "info") {
            safeCall(onInfo, msg.message || "Info");
          } else if (msg.type === "error") {
            safeCall(onError, msg.message || "Error");
          }
        } catch {
          safeCall(onError, "Invalid message from server.");
        }
      });

      socket.addEventListener("close", () => {
        setStatus({ status: "disconnected", roomCode });
        safeCall(onError, "Disconnected.");
      });

      socket.addEventListener("error", () => {
        setStatus({ status: "error", roomCode });
        safeCall(onError, "WebSocket connection failed.");
      });
    } catch (e) {
      setStatus({ status: "error", roomCode });
      safeCall(onError, String(e?.message || e));
    }
  };

  const disconnect = () => {
    if (!socket) return;
    try {
      socket.close();
    } catch {
      // ignore
    } finally {
      socket = null;
      setStatus({ status: "disconnected", roomCode });
    }
  };

  const sendMove = (move) => {
    if (!socket || socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "move", roomCode, move }));
  };

  return { connect, disconnect, sendMove, getStatus: () => status };
}
