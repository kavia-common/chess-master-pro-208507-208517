/**
 * WebSocket client aligned to the Express backend WS protocol (/ws).
 *
 * Client -> Server messages (JSON):
 * - { type: "join", gameId, playerId? }
 * - { type: "sync" }
 * - { type: "move", from: "e2", to: "e4", promotion?: "q|r|b|n" }
 * - { type: "leave" }
 *
 * Server -> Client messages (JSON):
 * - { type: "joined", game, yourColor: "white|black|null" }
 * - { type: "state", game }
 * - { type: "move_applied", game, move }   // move is chess.js verbose move object
 * - { type: "error", code, message, details? }
 */

import { coordToSquare, squareToCoord } from "../chess/coords";

function normalizeOutgoingMove(move) {
  if (!move) return null;

  // Allow either:
  // 1) Internal format: { from:{r,c}, to:{r,c}, promotion? }
  // 2) Already-squares: { from:"e2", to:"e4", promotion? }
  const from =
    typeof move.from === "string" ? move.from : move.from ? coordToSquare(move.from) : null;
  const to = typeof move.to === "string" ? move.to : move.to ? coordToSquare(move.to) : null;

  if (!from || !to) return null;

  const promotion = move.promotion ? String(move.promotion).toLowerCase() : undefined;
  return { from, to, promotion };
}

function normalizeIncomingMove(chessJsVerboseMove) {
  if (!chessJsVerboseMove || !chessJsVerboseMove.from || !chessJsVerboseMove.to) return null;
  const from = squareToCoord(chessJsVerboseMove.from);
  const to = squareToCoord(chessJsVerboseMove.to);
  if (!from || !to) return null;
  return {
    from,
    to,
    promotion: chessJsVerboseMove.promotion ? String(chessJsVerboseMove.promotion).toLowerCase() : null,
  };
}

// PUBLIC_INTERFACE
export function createSocketClient({
  wsUrl,
  gameId,
  playerId,
  onStatus,
  onJoined,
  onState,
  onMoveApplied,
  onInfo,
  onError,
}) {
  let socket = null;
  let status = { status: "idle", gameId: gameId || null };

  let shouldReconnect = true;
  let reconnectAttempt = 0;
  let reconnectTimer = null;

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

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (!shouldReconnect) return;
    clearReconnectTimer();

    // Exponential backoff, capped.
    const delay = Math.min(10000, 500 * 2 ** reconnectAttempt);
    reconnectAttempt += 1;

    reconnectTimer = window.setTimeout(() => {
      connect();
    }, delay);
  };

  const connect = () => {
    try {
      clearReconnectTimer();

      if (!wsUrl) {
        setStatus({ status: "error", gameId });
        safeCall(onError, "Missing WebSocket URL.");
        return;
      }

      if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
        // Already connecting/connected.
        return;
      }

      setStatus({ status: "connecting", gameId });

      socket = new window.WebSocket(wsUrl);

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        setStatus({ status: "connected", gameId });

        socket.send(JSON.stringify({ type: "join", gameId, playerId: playerId || undefined }));
        socket.send(JSON.stringify({ type: "sync" }));
        safeCall(onInfo, `Connected (game ${gameId}).`);
      });

      socket.addEventListener("message", (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const type = msg.type;

          if (type === "joined") {
            safeCall(onJoined, { game: msg.game, yourColor: msg.yourColor || null });
            return;
          }

          if (type === "state") {
            safeCall(onState, msg.game);
            return;
          }

          if (type === "move_applied") {
            const move = normalizeIncomingMove(msg.move);
            safeCall(onMoveApplied, { move, game: msg.game, rawMove: msg.move });
            return;
          }

          if (type === "error") {
            safeCall(onError, msg.message || "Server error.");
            return;
          }
        } catch {
          safeCall(onError, "Invalid message from server.");
        }
      });

      socket.addEventListener("close", () => {
        setStatus({ status: "disconnected", gameId });
        safeCall(onError, "Disconnected.");
        scheduleReconnect();
      });

      socket.addEventListener("error", () => {
        setStatus({ status: "error", gameId });
        safeCall(onError, "WebSocket connection failed.");
        scheduleReconnect();
      });
    } catch (e) {
      setStatus({ status: "error", gameId });
      safeCall(onError, String(e?.message || e));
      scheduleReconnect();
    }
  };

  const disconnect = () => {
    shouldReconnect = false;
    clearReconnectTimer();

    if (!socket) return;
    try {
      socket.close();
    } catch {
      // ignore
    } finally {
      socket = null;
      setStatus({ status: "disconnected", gameId });
    }
  };

  const sync = () => {
    if (!socket || socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "sync" }));
  };

  const leave = () => {
    if (!socket || socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: "leave" }));
  };

  const sendMove = (move) => {
    if (!socket || socket.readyState !== 1) return;
    const normalized = normalizeOutgoingMove(move);
    if (!normalized) {
      safeCall(onError, "Cannot send move: invalid move format.");
      return;
    }
    socket.send(JSON.stringify({ type: "move", ...normalized }));
  };

  return { connect, disconnect, sendMove, sync, leave, getStatus: () => status };
}
