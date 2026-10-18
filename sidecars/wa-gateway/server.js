import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { HttpsProxyAgent } from "https-proxy-agent";
import {
  atomicJson,
  readJson,
  validateConfig,
  identity,
  TestDispatch,
} from "./core.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const data = path.resolve(
  process.env.JOTA_WA_DATA_DIR || path.join(root, "../../.local/whatsapp"),
);
await mkdir(data, { recursive: true, mode: 0o700 });
const lockFile = path.join(data, "gateway.lock");
try {
  await writeFile(lockFile, String(process.pid), { flag: "wx", mode: 0o600 });
} catch {
  console.error(
    "Ya existe un bloqueo de gateway. No ejecutes dos instancias con la misma sesión. Consulta docs/WHATSAPP.md.",
  );
  process.exit(1);
}
const port = Number(process.env.JOTA_WA_PORT || 3001);
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString("base64url");
await atomicJson(path.join(data, "operator.json"), { port, token });
let config = await readJson(path.join(data, "config.json"), null);
let socket = null,
  qr = null,
  status = "disconnected",
  detail = "",
  attempts = 0,
  connecting = false,
  reconnectTimer;
const dispatchFile = path.join(data, "dispatch.json");
const dispatch = new TestDispatch(dispatchFile);
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
const logger = pino({ level: "silent" }); // Never dump Signal credentials or message contents to logs.

async function connect() {
  if (connecting || status === "connected" || status === "connecting" || qr)
    return;
  if (!config)
    throw new Error("Configura el administrador y la prueba primero.");
  connecting = true;
  status = "connecting";
  detail = "";
  try {
    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(data, "auth"),
    );
    const current = makeWASocket({
      auth: state,
      logger,
      browser: Browsers.ubuntu("Chrome"),
      agent,
      fetchAgent: agent,
      connectTimeoutMs: 15000,
      defaultQueryTimeoutMs: 20000,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      getMessage: async (key) => {
        const sent = await readJson(dispatchFile, null);
        return sent?.messageId === key.id ? sent.outgoing : undefined;
      },
    });
    socket = current;
    current.ws.on("unexpected-response", (_request, response) => {
      if (socket !== current) return;
      status = "network_blocked";
      detail = `La red o WhatsApp rechazó el WebSocket (HTTP ${response.statusCode}). Revisa el proxy o prueba desde tu ordenador.`;
      qr = null;
      connecting = false;
      socket = null;
      response.resume();
      current.end(new Error("WebSocket rejected"));
    });
    current.ev.on("creds.update", saveCreds);
    current.ev.on("connection.update", async (update) => {
      if (socket !== current || stopping || status === "wrong_account") return;
      if (update.qr) {
        qr = await QRCode.toDataURL(update.qr, { width: 320, margin: 2 });
        status = "qr";
        await QRCode.toFile(path.join(data, "qr.png"), update.qr, {
          width: 480,
          margin: 2,
        });
        console.log(
          "QR actualizado. Escanéalo desde el panel local o el archivo privado qr.png.",
        );
      }
      if (update.connection === "open") {
        connecting = false;
        qr = null;
        await rm(path.join(data, "qr.png"), { force: true });
        if (identity(current.user?.id) !== config.admin) {
          status = "wrong_account";
          detail =
            "La cuenta vinculada no es el administrador configurado. Desvincula este dispositivo desde el teléfono y vuelve a configurar la sesión.";
          current.end(new Error("Administrator mismatch"));
          socket = null;
          return;
        }
        status = "connected";
        attempts = 0;
        detail =
          "Administrador verificado. No se envía nada hasta pulsar Enviar prueba.";
        console.log("Administrador vinculado y verificado.");
      }
      if (update.connection === "close") {
        connecting = false;
        qr = null;
        await rm(path.join(data, "qr.png"), { force: true });
        const code = update.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          status = "logged_out";
          detail =
            "WhatsApp cerró la sesión. Desvincula y reinicia con una carpeta de sesión nueva.";
        } else if (attempts < 3) {
          attempts++;
          status = "reconnecting";
          detail = `Reconexión ${attempts}/3`;
          reconnectTimer = setTimeout(
            () =>
              connect().catch(() => {
                status = "error";
                detail = "No se pudo conectar.";
              }),
            2000 * attempts,
          );
        } else {
          status = "error";
          detail =
            "No se pudo conectar con WhatsApp. Revisa la red o inicia otra conexión desde el panel.";
        }
      }
    });
    // Receipt-only listener. Never read or answer personal chats or self-chat messages.
    current.ev.on("messages.update", async (updates) => {
      const sent = await readJson(dispatchFile, null);
      if (!sent?.messageId) return;
      for (const { key, update } of updates) {
        if (key.id === sent.messageId && update.status >= 3) {
          const next = update.status >= 4 ? "read" : "delivered";
          if (sent.status !== "read")
            await atomicJson(dispatchFile, { ...sent, status: next });
        }
      }
    });
  } finally {
    connecting = false;
  }
}

async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 8192) throw new Error("Solicitud demasiado grande.");
  }
  return text ? JSON.parse(text) : {};
}
function authorized(req) {
  const value = req.headers.authorization?.replace(/^Bearer /, "") || "";
  const a = Buffer.from(value),
    b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
const server = http.createServer(async (req, res) => {
  const reply = (code, value, type = "application/json") => {
    res.writeHead(code, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    });
    res.end(type === "application/json" ? JSON.stringify(value) : value);
  };
  if (
    req.headers.host !== `127.0.0.1:${port}` ||
    (req.headers.origin && req.headers.origin !== origin)
  )
    return reply(403, { error: "Origen no permitido." });
  try {
    const url = new URL(req.url, origin);
    const staticFiles = {
      "/": "index.html",
      "/app.js": "app.js",
      "/style.css": "style.css",
    };
    if (req.method === "GET" && staticFiles[url.pathname]) {
      return reply(
        200,
        await readFile(path.join(root, "public", staticFiles[url.pathname])),
        url.pathname.endsWith(".js")
          ? "text/javascript"
          : url.pathname.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
    }
    if (!authorized(req))
      return reply(401, {
        error: "Abre el panel con el enlace privado que muestra el launcher.",
      });
    if (req.method === "GET" && url.pathname === "/status") {
      const sent = await readJson(dispatchFile, null);
      return reply(200, {
        status,
        detail,
        qr,
        config,
        dispatch: sent
          ? {
              status: sent.status,
              recipient: sent.recipient,
              messageId: sent.messageId,
            }
          : null,
      });
    }
    if (req.method === "POST" && url.pathname === "/config") {
      if (socket || status === "connected" || status === "qr")
        throw new Error(
          "Reinicia el gateway antes de cambiar el administrador o la prueba.",
        );
      if (await readJson(dispatchFile, null))
        throw new Error(
          "Esta carpeta ya contiene un intento. No se cambia el destinatario ni se repite la prueba.",
        );
      config = validateConfig(await body(req));
      await atomicJson(path.join(data, "config.json"), config);
      return reply(200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/connect") {
      attempts = 0;
      await connect();
      return reply(200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/send-test") {
      const value = await body(req);
      if (status !== "connected")
        throw new Error(
          "Vincula y verifica el WhatsApp del administrador primero.",
        );
      const result = await dispatch.send(
        socket,
        config,
        value.confirmed === true,
      );
      return reply(200, { status: result.status, messageId: result.messageId });
    }
    return reply(404, { error: "Ruta no disponible." });
  } catch (err) {
    return reply(400, {
      error: err.message || "No se pudo completar la operación.",
    });
  }
});
server.listen(port, "127.0.0.1", () => {
  // This one-time local operator link is deliberately shown only to the machine's operator.
  console.log(`Panel privado del operador: ${origin}/#${token}`);
  console.log(
    "No compartas este enlace ni la carpeta de sesión. No se envían mensajes automáticamente.",
  );
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(reconnectTimer);
  socket?.end(new Error("Gateway stopped"));
  await rm(lockFile, { force: true });
  await rm(path.join(data, "operator.json"), { force: true });
  await rm(path.join(data, "qr.png"), { force: true });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
