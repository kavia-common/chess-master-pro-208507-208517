import { getApiBaseUrl } from "./urls";

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

async function safeReadJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function buildErrorMessage({ status, code, message }) {
  if (message) return message;
  if (code) return code;
  if (status) return status;
  return "Request failed.";
}

// PUBLIC_INTERFACE
export async function apiRequestJson(path, { method = "GET", body } = {}) {
  /**
   * Perform a JSON request against the chess backend.
   * Throws an Error with `statusCode`, `code`, and `details` when available.
   */
  const base = getApiBaseUrl();
  const url = joinUrl(base, path);

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await safeReadJson(res);

  if (!res.ok) {
    const err = new Error(
      buildErrorMessage({
        status: payload?.status,
        code: payload?.code,
        message: payload?.message,
      })
    );
    err.statusCode = res.status;
    err.code = payload?.code || "REQUEST_FAILED";
    err.details = payload?.details;
    throw err;
  }

  return payload;
}

// PUBLIC_INTERFACE
export async function createGame({ playerId, playerName, colorPreference = "random" }) {
  /** Create a new game (REST). */
  return apiRequestJson("/games", {
    method: "POST",
    body: { playerId, playerName, colorPreference },
  });
}

// PUBLIC_INTERFACE
export async function joinGame({ gameId, playerId, playerName, colorPreference = "random" }) {
  /** Join an existing game (REST). */
  return apiRequestJson(`/games/${encodeURIComponent(gameId)}/join`, {
    method: "POST",
    body: { playerId, playerName, colorPreference },
  });
}

// PUBLIC_INTERFACE
export async function getGame({ gameId }) {
  /** Fetch current game snapshot (REST). */
  const res = await apiRequestJson(`/games/${encodeURIComponent(gameId)}`, { method: "GET" });
  return res.game;
}

// PUBLIC_INTERFACE
export async function saveGame({ gameId }) {
  /** Force-save a game snapshot to disk (REST). */
  const res = await apiRequestJson(`/games/${encodeURIComponent(gameId)}/save`, { method: "POST" });
  return res.game;
}

// PUBLIC_INTERFACE
export async function loadGame({ gameId }) {
  /** Load game snapshot from disk (REST). */
  const res = await apiRequestJson(`/games/${encodeURIComponent(gameId)}/load`, { method: "GET" });
  return res.game;
}

// PUBLIC_INTERFACE
export async function applyMoveRest({ gameId, playerId, from, to, promotion }) {
  /** Apply a move via REST fallback (server-authoritative). */
  return apiRequestJson(`/games/${encodeURIComponent(gameId)}/move`, {
    method: "POST",
    body: { playerId, from, to, promotion },
  });
}
