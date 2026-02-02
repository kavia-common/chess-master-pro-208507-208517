// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  const env = process.env.REACT_APP_API_BASE_URL;
  if (env && env.trim()) return env.trim();

  // Default best-effort for local dev: assume backend on port 3001 on same host.
  // (This is not a secret; only a fallback.)
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3001`;
}

function ensureWsPath(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/\/ws\/?$/.test(u)) return u.replace(/\/$/, "");
  return `${u.replace(/\/$/, "")}/ws`;
}

// PUBLIC_INTERFACE
export function getWsUrl() {
  const env = process.env.REACT_APP_WS_URL;
  if (env && env.trim()) return ensureWsPath(env.trim());

  // If not set, derive from API base.
  const api = getApiBaseUrl();
  if (!api) return "";
  const wsProto = api.startsWith("https") ? "wss" : "ws";
  const rest = api.replace(/^https?:\/\//, "");
  return ensureWsPath(`${wsProto}://${rest}`);
}

// PUBLIC_INTERFACE
export function canUseWebSocket() {
  return typeof window !== "undefined" && typeof window.WebSocket !== "undefined";
}
