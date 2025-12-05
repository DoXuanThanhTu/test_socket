import express from "express";
import WebSocket from "ws";

// ================== CONFIG ==================
const DEVICE_ID = "testdata_001";
const WS_URL = `wss://smart-garden-websocket.onrender.com/?deviceId=${DEVICE_ID}`;

// ================== GLOBAL ERROR CATCH ==================
process.on("uncaughtException", err =>
  console.error("[GLOBAL] Uncaught:", err)
);
process.on("unhandledRejection", err =>
  console.error("[GLOBAL] Unhandled:", err)
);

// ================== LOG ==================
const log = (...args) =>
  console.log(`[${new Date().toISOString()}]`, ...args);

// ================== EXPRESS /health ==================
express()
  .get("/health", (req, res) =>
    res.json({ status: "ok", deviceId: DEVICE_ID })
  )
  .listen(4000, () => log("[FAKE] Health server running"));

// ================== WS CLIENT ==================
let ws;
let reconnectTimer = null;
let heartbeatTimer = null;

// ---------- HEARTBEAT ----------
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.ping(); // gửi ping
    }
  }, 15000);
}

// ---------- CONNECT WS ----------
function connectWS() {
  ws = new WebSocket(WS_URL, { rejectUnauthorized: false });

  ws.on("open", () => {
    log(`[FAKE] Connected as ${DEVICE_ID}`);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    startHeartbeat();
  });

  ws.on("message", raw => {
    try {
      const text = raw.toString();
      const json = JSON.parse(text);
      log("[FAKE] Received:", json);
    } catch {
      log("[FAKE] Received NON-JSON:", raw);
    }
  });

  ws.on("ping", () => {
    ws.pong(); // trả lời ping
  });

  ws.on("pong", () => {
    // server phản hồi heartbeat → vẫn OK
  });

  ws.on("error", err => {
    log("[FAKE] WS Error:", err.message);
  });

  ws.on("close", (code, reason) => {
    log("[FAKE] WS Closed:", code, reason?.toString());
    safeReconnect();
  });
}

// ---------- AUTO RECONNECT ----------
function safeReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    log("[FAKE] Reconnecting...");
    connectWS();
  }, 3000);
}

// Start first connection
connectWS();

// ================== RANDOM HELPER ==================
const random = (min, max, dec = 0) =>
  +(Math.random() * (max - min) + min).toFixed(dec);

// ================== SEND EVERY 5 SEC ==================
setInterval(() => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const payload = {
    deviceId: DEVICE_ID,
    temp: random(20, 30, 1),
    humidity: random(40, 70, 1),
    soil: Math.floor(random(50, 100)),
    pump: Math.random() > 0.5
  };

  try {
    ws.send(JSON.stringify(payload));
    log("[FAKE] Sent:", payload);
  } catch (err) {
    log("[FAKE] Send Error:", err.message);
  }
}, 5000);

// ================== SELF PING (HTTP) ==================
function rand(msMin = 10, msMax = 20) {
  return (Math.random() * (msMax - msMin) + msMin) * 1000;
}

async function selfPing() {
  if (!process.env.SERVER_URL) return;

  try {
    const res = await fetch(
      `${process.env.SERVER_URL.replace(/\/$/, "")}/health`
    );
    const json = await res.json();
    log("[FAKE] SelfPing:", json);
  } catch (e) {
    log("[FAKE] SelfPing ERR:", e.message);
  } finally {
    setTimeout(selfPing, rand());
  }
}

if (process.env.SERVER_URL) setTimeout(selfPing, rand());
