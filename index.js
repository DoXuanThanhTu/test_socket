import express from "express";
import WebSocket from "ws";

// ================== CÀI ĐẶT ==================
const DEVICE_ID = "testdata_001";
const WS_URL = `wss://smart-garden-websocket.onrender.com/?deviceId=${DEVICE_ID}`;

// ================== EXPRESS SERVER /health ==================
express()
  .get("/health", (req, res) => res.json({ status: "ok", deviceId: DEVICE_ID }))
  .listen(4000, () => console.log(`[FAKE] Health server running on port 4000`));

// ================== WEBSOCKET CLIENT ==================
const ws = new WebSocket(WS_URL, { rejectUnauthorized: false });

// ================== LOG ==================
const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);

ws.on("open", () => log(`[FAKE] Connected as ${DEVICE_ID}`));
ws.on("message", msg => {
  try { log("[FAKE] Received:", JSON.parse(msg.toString())); }
  catch { log("[FAKE] Received invalid JSON:", msg.toString()); }
});
ws.on("error", err => log("[FAKE] WS Error:", err));
ws.on("close", () => log("[FAKE] Disconnected from WS"));

// ================== HÀM HỖ TRỢ ==================
const random = (min, max, dec=0) => +(Math.random()*(max-min)+min).toFixed(dec);

// ================== GỬI DỮ LIỆU SENSOR MỖI 5 GIÂY ==================
setInterval(() => {
  if (ws.readyState !== WebSocket.OPEN) return;

  const data = {
    deviceId: DEVICE_ID,
    temp: random(20,30,1),
    humidity: random(40,70,1),
    soil: Math.floor(random(50,100)),
    pump: Math.random() > 0.5
  };

  ws.send(JSON.stringify(data));
  log("[FAKE] Sent sensor data:", data);
}, 5000);

// ================== TỰ PING SERVER /health MỖI 10-20s ==================
function randomInterval(minSec = 10, maxSec = 20) {
  return Math.floor(Math.random() * (maxSec - minSec + 1) + minSec) * 1000;
}

async function selfPing() {
  if (!process.env.SERVER_URL) return; // Chỉ ping nếu SERVER_URL tồn tại
  try {
    const res = await fetch(`${process.env.SERVER_URL.replace(/\/$/, '')}/health`);
    const data = await res.json();
    log("[FAKE] Self ping response:", data);
  } catch(err) {
    log("[FAKE] Self ping error:", err);
  } finally {
    setTimeout(selfPing, randomInterval());
  }
}

// Khởi động ping nếu có SERVER_URL
if (process.env.SERVER_URL) setTimeout(selfPing, randomInterval());
