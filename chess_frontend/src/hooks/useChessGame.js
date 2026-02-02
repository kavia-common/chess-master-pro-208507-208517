import { useCallback, useMemo, useRef, useState } from "react";
import {
  createInitialState,
  generateLegalMovesForSquare,
  makeMove,
  getStatus,
  normalizeMoveForTransport,
} from "../chess/engine";
import { coordToSquare, squareToCoord } from "../chess/coords";
import { useToast } from "./useToast";

const LOCAL_SAVE_KEY = "nvchess.save.v1";

function nowMoveId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function msFromMinutes(min) {
  return Math.max(0, Number(min) || 0) * 60 * 1000;
}

function msFromSeconds(sec) {
  return Math.max(0, Number(sec) || 0) * 1000;
}

function inferCapture(stateBefore, move) {
  // Best-effort capture detection for better move list UX.
  // En passant: pawn moves diagonally to an empty square.
  try {
    const fromPiece = stateBefore.board?.[move.from.r]?.[move.from.c];
    const toPiece = stateBefore.board?.[move.to.r]?.[move.to.c];

    if (toPiece) return toPiece;

    const isPawn = fromPiece && fromPiece.type === "p";
    const movedDiagonally = move.from.c !== move.to.c;
    if (isPawn && movedDiagonally && !toPiece) {
      return { type: "p", color: fromPiece.color === "w" ? "b" : "w" };
    }
  } catch {
    // ignore
  }
  return null;
}

function buildPresentFromBackendHistory(backendHistory, { initialMinutes, incrementSeconds }) {
  const initState = createInitialState();
  const clocks = {
    w: msFromMinutes(initialMinutes),
    b: msFromMinutes(initialMinutes),
    inc: msFromSeconds(incrementSeconds),
  };

  let state = initState;
  const moves = [];
  let lastMove = null;

  const history = Array.isArray(backendHistory) ? backendHistory : [];
  for (const m of history) {
    const from = squareToCoord(m?.from);
    const to = squareToCoord(m?.to);
    if (!from || !to) continue;

    const candidate = { from, to, promotion: m?.promotion ? String(m.promotion).toLowerCase() : null };
    const capture = inferCapture(state, candidate);

    const result = makeMove(state, candidate);
    if (!result.ok || result.promotionRequired) {
      // If backend history cannot be replayed, stop hydration rather than corrupt UI state.
      break;
    }

    const nextState = result.state;
    const nextStatus = getStatus(nextState);

    moves.push({
      ...candidate,
      id: nowMoveId(),
      capture: capture || null,
      meta: { remote: true, statusNote: nextStatus.note },
    });

    lastMove = { from, to };
    state = nextState;
  }

  return {
    state,
    moves,
    lastMove,
    clocks,
    clockRunning: true,
    status: getStatus(state),
  };
}

// PUBLIC_INTERFACE
export function useChessGame({ mode, initialMinutes, incrementSeconds }) {
  const { pushToast } = useToast();

  const [history, setHistory] = useState(() => {
    const initState = createInitialState();
    const clocks = {
      w: msFromMinutes(initialMinutes),
      b: msFromMinutes(initialMinutes),
      inc: msFromSeconds(incrementSeconds),
    };
    return {
      past: [],
      present: {
        state: initState,
        moves: [],
        lastMove: null,
        clocks,
        clockRunning: true,
        status: getStatus(initState),
      },
      future: [],
      promotionPending: null, // { move }
    };
  });

  const [ui, setUi] = useState({
    selected: null,
    hover: null,
    legalMoves: [],
    promotionPending: false,
  });

  // For online mode: allow attaching the WS client for "best-effort" send/sync from UI.
  const socketClientRef = useRef(null);

  const present = history.present;

  const updateUiForSelection = useCallback((state, selected) => {
    const legal = selected ? generateLegalMovesForSquare(state, selected) : [];
    setUi((prev) => ({
      ...prev,
      selected,
      legalMoves: legal,
    }));
  }, []);

  const newGame = useCallback(() => {
    const initState = createInitialState();
    const clocks = {
      w: msFromMinutes(initialMinutes),
      b: msFromMinutes(initialMinutes),
      inc: msFromSeconds(incrementSeconds),
    };

    setHistory({
      past: [],
      present: {
        state: initState,
        moves: [],
        lastMove: null,
        clocks,
        clockRunning: true,
        status: getStatus(initState),
      },
      future: [],
      promotionPending: null,
    });

    setUi({ selected: null, hover: null, legalMoves: [], promotionPending: false });
  }, [initialMinutes, incrementSeconds]);

  const pushPresent = useCallback((nextPresent) => {
    setHistory((prev) => ({
      past: [...prev.past, prev.present],
      present: nextPresent,
      future: [],
      promotionPending: null,
    }));
  }, []);

  const applyMoveInternal = useCallback(
    (move, meta) => {
      const normalized = normalizeMoveForTransport(move);
      const result = makeMove(present.state, normalized);

      if (!result.ok) {
        pushToast({ title: "Illegal move", message: result.reason || "That move is not legal." });
        return;
      }

      if (result.promotionRequired) {
        setHistory((prev) => ({
          ...prev,
          promotionPending: { move: normalized },
        }));
        setUi((prev) => ({
          ...prev,
          promotionPending: true,
          selected: null,
          legalMoves: [],
        }));
        return;
      }

      const moveRecord = {
        ...normalized,
        id: nowMoveId(),
        meta: { ...(meta || {}) },
      };

      const nextClocks = { ...present.clocks };
      // increment applies after making a move for the mover
      if (present.clocks.inc > 0) {
        if (present.state.turn === "w") nextClocks.w += present.clocks.inc;
        else nextClocks.b += present.clocks.inc;
      }

      const nextState = result.state;
      const nextStatus = getStatus(nextState);

      const nextPresent = {
        ...present,
        state: nextState,
        moves: [...present.moves, { ...moveRecord, meta: { ...(moveRecord.meta || {}), statusNote: nextStatus.note } }],
        lastMove: { from: normalized.from, to: normalized.to },
        clocks: nextClocks,
        status: nextStatus,
      };

      pushPresent(nextPresent);
      setUi((prevUi) => ({
        ...prevUi,
        selected: null,
        legalMoves: [],
        promotionPending: false,
      }));
    },
    [present, pushPresent, pushToast]
  );

  const finalizePromotion = useCallback(
    (promotionType) => {
      setHistory((prev) => {
        if (!prev.promotionPending?.move) return prev;

        const pendingMove = { ...prev.promotionPending.move, promotion: promotionType };
        const result = makeMove(prev.present.state, pendingMove);

        if (!result.ok) {
          pushToast({ title: "Promotion error", message: result.reason || "Could not finalize promotion." });
          return { ...prev, promotionPending: null };
        }

        const moveRecord = {
          ...pendingMove,
          id: nowMoveId(),
          meta: { promotion: promotionType },
        };

        const nextClocks = { ...prev.present.clocks };
        if (prev.present.clocks.inc > 0) {
          if (prev.present.state.turn === "w") nextClocks.w += prev.present.clocks.inc;
          else nextClocks.b += prev.present.clocks.inc;
        }

        const nextState = result.state;
        const nextStatus = getStatus(nextState);

        const nextPresent = {
          ...prev.present,
          state: nextState,
          moves: [...prev.present.moves, { ...moveRecord, meta: { ...moveRecord.meta, statusNote: nextStatus.note } }],
          lastMove: { from: pendingMove.from, to: pendingMove.to },
          clocks: nextClocks,
          status: nextStatus,
        };

        // push to past
        return {
          past: [...prev.past, prev.present],
          present: nextPresent,
          future: [],
          promotionPending: null,
        };
      });

      setUi((prevUi) => ({ ...prevUi, promotionPending: false }));
    },
    [pushToast]
  );

  const selectSquare = useCallback(
    (coord) => {
      updateUiForSelection(present.state, coord);
    },
    [present.state, updateUiForSelection]
  );

  const setHover = useCallback((coord) => {
    setUi((prev) => ({ ...prev, hover: coord }));
  }, []);

  const tryMoveTo = useCallback(
    (to, { onOnlineSend } = {}) => {
      if (!ui.selected) return;

      const from = ui.selected;
      const legal = generateLegalMovesForSquare(present.state, from);
      const chosen = legal.find((m) => m.to.r === to.r && m.to.c === to.c);

      if (!chosen) {
        pushToast({ title: "Illegal move", message: `No legal move from ${coordToSquare(from)} to ${coordToSquare(to)}.` });
        updateUiForSelection(present.state, null);
        return;
      }

      // Apply locally (optimistic). If online backend rejects, caller can sync and hydrate.
      applyMoveInternal(chosen);

      // best-effort callback for online sync
      if (typeof onOnlineSend === "function") {
        try {
          onOnlineSend(chosen);
        } catch {
          // ignore
        }
      }
    },
    [ui.selected, present.state, applyMoveInternal, pushToast, updateUiForSelection]
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const past = prev.past.slice();
      const previous = past.pop();
      return {
        past,
        present: previous,
        future: [prev.present, ...prev.future],
        promotionPending: null,
      };
    });
    setUi((prevUi) => ({ ...prevUi, selected: null, legalMoves: [], promotionPending: false }));
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const [next, ...rest] = prev.future;
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: rest,
        promotionPending: null,
      };
    });
    setUi((prevUi) => ({ ...prevUi, selected: null, legalMoves: [], promotionPending: false }));
  }, []);

  const saveToLocal = useCallback(() => {
    try {
      window.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(present));
      pushToast({ title: "Saved", message: "Game saved locally." });
    } catch (e) {
      pushToast({ title: "Save failed", message: String(e?.message || e) });
    }
  }, [present, pushToast]);

  const loadFromLocal = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_SAVE_KEY);
      if (!raw) {
        pushToast({ title: "No save found", message: "No local save exists yet." });
        return;
      }
      const loaded = JSON.parse(raw);
      if (!loaded?.state?.board) {
        pushToast({ title: "Load failed", message: "Save data is invalid." });
        return;
      }

      setHistory({
        past: [],
        present: { ...loaded, status: getStatus(loaded.state) },
        future: [],
        promotionPending: null,
      });
      setUi({ selected: null, hover: null, legalMoves: [], promotionPending: false });
      pushToast({ title: "Loaded", message: "Game loaded from local save." });
    } catch (e) {
      pushToast({ title: "Load failed", message: String(e?.message || e) });
    }
  }, [pushToast]);

  const resign = useCallback((color) => {
    setHistory((prev) => {
      if (prev.present.status.kind !== "ongoing") return prev;
      const winner = color === "w" ? "b" : "w";
      const nextPresent = {
        ...prev.present,
        status: { kind: "resigned", winner, winnerLabel: winner === "w" ? "White" : "Black", note: "Resignation" },
      };
      return {
        past: [...prev.past, prev.present],
        present: nextPresent,
        future: [],
        promotionPending: null,
      };
    });
  }, []);

  /**
   * A small façade that the UI can call for ticking the clock without mutating
   * game state directly.
   */
  const tick = useCallback((ms) => {
    setHistory((prev) => {
      const p = prev.present;
      if (!p.clockRunning) return prev;
      if (p.status.kind !== "ongoing") return prev;

      const nextClocks = { ...p.clocks };
      if (p.state.turn === "w") nextClocks.w = Math.max(0, nextClocks.w - ms);
      else nextClocks.b = Math.max(0, nextClocks.b - ms);

      let nextStatus = p.status;
      if (nextClocks.w === 0 || nextClocks.b === 0) {
        const winner = nextClocks.w === 0 ? "b" : "w";
        nextStatus = {
          kind: "timeout",
          winner,
          winnerLabel: winner === "w" ? "White" : "Black",
          note: "Time",
        };
      }

      const nextPresent = {
        ...p,
        clocks: nextClocks,
        status: nextStatus,
      };

      return { ...prev, present: nextPresent };
    });
  }, []);

  const setSocketClient = useCallback((client) => {
    socketClientRef.current = client || null;
  }, []);

  const getSocketClient = useCallback(() => {
    return socketClientRef.current;
  }, []);

  const hydrateFromServerGame = useCallback(
    (serverGame) => {
      try {
        const nextPresent = buildPresentFromBackendHistory(serverGame?.history, {
          initialMinutes,
          incrementSeconds,
        });

        setHistory({
          past: [],
          present: nextPresent,
          future: [],
          promotionPending: null,
        });

        setUi({ selected: null, hover: null, legalMoves: [], promotionPending: false });
      } catch (e) {
        pushToast({ title: "Sync failed", message: String(e?.message || e) });
      }
    },
    [initialMinutes, incrementSeconds, pushToast]
  );

  const gameFacade = useMemo(() => {
    const status = present.status;
    const turn = present.state.turn;

    return {
      state: present.state,
      turn,
      turnLabel: turn === "w" ? "White" : "Black",
      moves: present.moves,
      lastMove: present.lastMove,
      clocks: { w: present.clocks.w, b: present.clocks.b },
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      status,
      clockRunning: present.clockRunning,

      // PUBLIC_INTERFACE
      setSocketClient,
      // PUBLIC_INTERFACE
      getSocketClient,
      // PUBLIC_INTERFACE
      hydrateFromServerGame,

      applyMove: (move, meta) => applyMoveInternal(move, meta),
      tick,
    };
  }, [
    present,
    history.past.length,
    history.future.length,
    applyMoveInternal,
    tick,
    setSocketClient,
    getSocketClient,
    hydrateFromServerGame,
  ]);

  return {
    game: gameFacade,
    ui: {
      ...ui,
      promotionPending: Boolean(history.promotionPending),
    },
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
  };
}
