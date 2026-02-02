import React, { useEffect, useMemo, useState } from "react";
import ChessBoard from "../components/ChessBoard";
import MoveHistory from "../components/MoveHistory";
import ChessClock from "../components/ChessClock";
import Modal from "../components/Modal";

import { useChessGame } from "../hooks/useChessGame";
import { useInterval } from "../hooks/useInterval";
import { useToast } from "../hooks/useToast";
import { chooseAiMove } from "../chess/ai";
import { createSocketClient } from "../services/chessSocket";
import { canUseWebSocket, getWsUrl } from "../services/urls";
import { loadGame, saveGame } from "../services/chessApi";

// PUBLIC_INTERFACE
export default function GamePage({ config, onExit }) {
  const { pushToast } = useToast();

  const {
    game,
    ui,
    selectSquare,
    tryMoveTo,
    setHover,
    newGame,
    undo,
    redo,
    saveToLocal,
    loadFromLocal,
    finalizePromotion,
    resign,
  } = useChessGame({
    mode: config.mode,
    initialMinutes: config.initialMinutes,
    incrementSeconds: config.incrementSeconds,
  });

  const [socketState, setSocketState] = useState({ status: "idle", gameId: null });

  const isOnline = config.mode === "ONLINE";
  const isAi = config.mode === "AI";

  const perspective = useMemo(() => {
    if (config.mode === "AI") return config.playerPlays;
    if (config.mode === "ONLINE" && config.room?.side) return config.room.side;
    return "w";
  }, [config]);

  const playerSide = useMemo(() => {
    if (config.mode === "AI") return config.playerPlays;
    if (config.mode === "ONLINE") return config.room?.side || "w";
    return null;
  }, [config]);

  const isPlayersTurn = useMemo(() => {
    if (config.mode === "LOCAL") return true;
    if (config.mode === "AI") return game.turn === config.playerPlays;
    if (config.mode === "ONLINE") return game.turn === (config.room?.side || "w");
    return true;
  }, [config, game.turn]);

  /**
   * Clock ticking:
   * - runs while game is active and not blocked by promotion choice
   * - in AI mode, clock still ticks for the side to move
   */
  useInterval(
    () => {
      if (game.status.kind !== "ongoing") return;
      if (ui.promotionPending) return;
      game.tick(250);
    },
    game.clockRunning ? 250 : null
  );

  /**
   * AI Turn: when in AI mode and it's not the player's turn, choose an AI move.
   */
  useEffect(() => {
    if (!isAi) return;
    if (game.status.kind !== "ongoing") return;
    if (ui.promotionPending) return;
    if (isPlayersTurn) return;

    let cancelled = false;

    const run = async () => {
      try {
        const move = chooseAiMove(game.state, config.aiDepth);
        if (!move) return;
        if (cancelled) return;
        game.applyMove(move);
      } catch (e) {
        pushToast({ title: "AI error", message: String(e?.message || e) });
      }
    };

    // slight delay for UX
    const t = setTimeout(run, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isAi, isPlayersTurn, ui.promotionPending, game, config.aiDepth, pushToast, game.state, game.status.kind]);

  /**
   * Online WebSocket: connect on enter, hydrate state on 'joined'/'state',
   * and apply remote moves on 'move_applied'.
   */
  useEffect(() => {
    if (!isOnline) return;

    const gameId = config.room?.gameId || "";
    const playerId = config.room?.playerId || "";
    if (!gameId) return;

    if (!canUseWebSocket()) {
      pushToast({
        title: "WebSocket unavailable",
        message: "Your environment does not support WebSockets.",
      });
      return;
    }

    const wsUrl = getWsUrl();
    if (!wsUrl) {
      pushToast({
        title: "Missing WS URL",
        message: "Set REACT_APP_WS_URL (e.g., ws://localhost:3001/ws). Falling back to local play.",
      });
      return;
    }

    const client = createSocketClient({
      wsUrl,
      gameId,
      playerId,
      onStatus: (s) => setSocketState(s),
      onJoined: ({ game: serverGame }) => {
        if (serverGame) {
          game.hydrateFromServerGame(serverGame);
        }
      },
      onState: (serverGame) => {
        if (serverGame) {
          game.hydrateFromServerGame(serverGame);
        }
      },
      onMoveApplied: ({ move, game: serverGame }) => {
        // Best effort:
        // - Apply the move locally so UI stays responsive.
        // - Also hydrate from server snapshot when provided (keeps things correct on reconnect/desync).
        if (move) {
          game.applyMove(move, { remote: true });
        }
        if (serverGame) {
          game.hydrateFromServerGame(serverGame);
        }
      },
      onInfo: (msg) => pushToast({ title: "Online", message: msg }),
      onError: (msg) => {
        pushToast({ title: "Online error", message: msg });
        // Attempt a re-sync if available.
        try {
          client.sync();
        } catch {
          // ignore
        }
      },
    });

    game.setSocketClient(client);
    client.connect();

    return () => {
      try {
        client.leave();
      } catch {
        // ignore
      }
      client.disconnect();
      game.setSocketClient(null);
    };
  }, [isOnline, config.room, pushToast, game]);

  const statusText = useMemo(() => {
    if (game.status.kind === "ongoing") {
      return game.status.inCheck ? `${game.turnLabel} to move — Check!` : `${game.turnLabel} to move`;
    }
    if (game.status.kind === "checkmate") return `Checkmate — ${game.status.winnerLabel} wins`;
    if (game.status.kind === "stalemate") return "Stalemate — Draw";
    if (game.status.kind === "timeout") return `Time — ${game.status.winnerLabel} wins`;
    if (game.status.kind === "resigned") return `${game.status.winnerLabel} wins by resignation`;
    return "Game over";
  }, [game.status, game.turnLabel]);

  const onlineBadge = isOnline ? (
    <span className="NVBadge" title="Online status">
      <span className="NVBadgeDot" />
      {socketState.status === "connected"
        ? `Online: ${socketState.gameId}`
        : socketState.status === "connecting"
          ? "Online: connecting…"
          : "Online: disconnected"}
    </span>
  ) : null;

  const handleSave = async () => {
    if (!isOnline) {
      saveToLocal();
      return;
    }

    const gameId = config.room?.gameId;
    if (!gameId) {
      pushToast({ title: "Save failed", message: "Missing game id." });
      return;
    }

    try {
      await saveGame({ gameId });
      pushToast({ title: "Saved", message: "Game saved on server." });
    } catch (e) {
      pushToast({ title: "Save failed", message: String(e?.message || e) });
    }
  };

  const handleLoad = async () => {
    if (!isOnline) {
      loadFromLocal();
      return;
    }

    const gameId = config.room?.gameId;
    if (!gameId) {
      pushToast({ title: "Load failed", message: "Missing game id." });
      return;
    }

    try {
      const serverGame = await loadGame({ gameId });
      game.hydrateFromServerGame(serverGame);

      // Ask WS to re-sync as well (helps after reconnect).
      const client = game.getSocketClient();
      if (client) client.sync();

      pushToast({ title: "Loaded", message: "Game loaded from server snapshot." });
    } catch (e) {
      pushToast({ title: "Load failed", message: String(e?.message || e) });
    }
  };

  return (
    <div className="NVRow">
      <section className="NVCard">
        <div className="BoardWrap">
          <div className="BoardTopRow">
            <div className="BoardMeta">
              <span className="NVBadge">
                <span className="NVBadgeDot" />
                Mode: {config.mode}
              </span>
              {onlineBadge}
              <span className="NVBadge">
                <span className="NVBadgeDot" />
                {statusText}
              </span>
            </div>

            <div className="NVButtonRow">
              <button className="NVButton NVButtonSecondary" type="button" onClick={onExit}>
                Exit
              </button>
              <button
                className="NVButton NVButtonSecondary"
                type="button"
                onClick={() => {
                  newGame();
                }}
              >
                New
              </button>
              <button className="NVButton NVButtonSecondary" type="button" onClick={undo} disabled={!game.canUndo}>
                Undo
              </button>
              <button className="NVButton NVButtonSecondary" type="button" onClick={redo} disabled={!game.canRedo}>
                Redo
              </button>
              <button className="NVButton NVButtonSecondary" type="button" onClick={handleSave}>
                Save
              </button>
              <button className="NVButton NVButtonSecondary" type="button" onClick={handleLoad}>
                Load
              </button>
              <button className="NVButton NVButtonDanger" type="button" onClick={() => resign(playerSide || game.turn)}>
                Resign
              </button>
            </div>
          </div>

          <ChessBoard
            board={game.state.board}
            perspective={perspective}
            selected={ui.selected}
            hover={ui.hover}
            legalMoves={ui.legalMoves}
            lastMove={game.lastMove}
            disabled={game.status.kind !== "ongoing" || ui.promotionPending || !isPlayersTurn}
            onSquareClick={(coord) => {
              // If user is clicking a target square, attempt move; otherwise update selection.
              const clickedIsSelected = ui.selected && ui.selected.r === coord.r && ui.selected.c === coord.c;

              if (ui.selected && !clickedIsSelected) {
                tryMoveTo(coord, {
                  onOnlineSend: (move) => {
                    // Best-effort: send to server if online and connected.
                    const client = game.getSocketClient();
                    if (isOnline && socketState.status === "connected" && client) {
                      client.sendMove(move);
                    }
                  },
                });
              } else {
                selectSquare(coord);
              }
            }}
            onSquareHover={(coord) => setHover(coord)}
          />

          {ui.promotionPending && (
            <Modal title="Pawn Promotion" onClose={() => pushToast({ title: "Promotion", message: "Choose a piece." })}>
              <p className="NVSubtitle">Select the promotion piece.</p>
              <div className="NVButtonRow">
                {["q", "r", "b", "n"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="NVButton"
                    onClick={() => {
                      finalizePromotion(p);

                      // If online, also send the finalized promotion move to backend by re-sending last move.
                      // The next WS sync/move_applied will reconcile state if needed.
                      const client = game.getSocketClient();
                      if (isOnline && socketState.status === "connected" && client) {
                        // We don't have direct access to the pending move here, so rely on WS sync after promotion.
                        client.sync();
                      }
                    }}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </Modal>
          )}
        </div>
      </section>

      <aside className="NVCard">
        <div className="Sidebar">
          <h3 className="SidebarSectionTitle">Clocks</h3>
          <ChessClock clocks={game.clocks} activeColor={game.turn} />

          <div className="NVHr" />

          <h3 className="SidebarSectionTitle">Moves</h3>
          <MoveHistory moves={game.moves} />

          <div className="NVHr" />

          <h3 className="SidebarSectionTitle">Notes</h3>
          <div className="StatusBanner">
            {config.mode === "AI" ? (
              <>You are playing as {config.playerPlays === "w" ? "White" : "Black"}.</>
            ) : config.mode === "ONLINE" ? (
              <>
                Game: <strong>{config.room?.gameId}</strong>. Side: <strong>{config.room?.side}</strong>.
                <br />
                If the backend rejects a move, the client will sync and replay server history.
              </>
            ) : (
              <>Local hot-seat play.</>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
