const BACKEND_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) ||
  "http://localhost:8000";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeMoney(money) {
  return clamp((money ?? 0) / 5000, -1, 1);
}

function normalizePosition(position) {
  return clamp((position ?? 0) / 39, 0, 1);
}

export function buildStateVector(gameState) {
  const vector = new Array(240).fill(0);
  const { players = [], currentPlayer = 0 } = gameState || {};

  vector[0] = clamp((currentPlayer ?? 0) / 3, 0, 1);

  players.slice(0, 4).forEach((player, idx) => {
    const base = 1 + idx * 5;
    vector[base] = normalizeMoney(player.money);
    vector[base + 1] = normalizePosition(player.position);
    vector[base + 2] = player.inJail ? 1 : 0;
    vector[base + 3] = player.bankrupt ? 1 : 0;
    vector[base + 4] = player.jailFreeCard ? 1 : 0;
  });

  return vector;
}

export async function fetchAIPredict(gameState) {
  const state = buildStateVector(gameState);

  const payload = {
    state,
    trade_available: Boolean(gameState?.tradeAvailable),
    property_buy_available: Boolean(gameState?.propertyBuyAvailable),
  };

  console.log("[AI->Backend] Predict request", {
    stateLength: payload.state.length,
    trade_available: payload.trade_available,
    property_buy_available: payload.property_buy_available,
  });
  console.log("[AI->Backend] POST", `${BACKEND_BASE_URL}/predict`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend predict failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log("[Backend->AI] Predict response", result);
    return result;
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "Backend predict timed out after 5s"
      : error?.message || String(error);

    console.error("[AI->Backend] Predict error", message);
    throw new Error(message);
  } finally {
    clearTimeout(timeoutId);
  }
}
