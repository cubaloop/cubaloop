import { createHash } from "node:crypto";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";

export function phone(value) {
  const digits = String(value || "").replace(/[+\s()-]/g, "");
  if (!/^[1-9][0-9]{7,14}$/.test(digits))
    throw new Error("Usa un número internacional, con prefijo de país.");
  return digits;
}
export function validateConfig(value) {
  const admin = phone(value.admin);
  const recipient = phone(value.recipient);
  const name = String(value.name || "").trim();
  const message = String(value.message || "").trim();
  if (!name || name.length > 80 || message.length < 10 || message.length > 2000)
    throw new Error("Indica el nombre y un mensaje de 10 a 2.000 caracteres.");
  if (admin === recipient)
    throw new Error(
      "El destinatario de esta prueba debe ser distinto del administrador.",
    );
  return { admin, recipient, name, message };
}
export function identity(id) {
  return String(id || "")
    .split("@")[0]
    .split(":")[0];
}
export async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file + ".tmp", JSON.stringify(value, null, 2), {
    mode: 0o600,
  });
  await rename(file + ".tmp", file);
}
export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

export class TestDispatch {
  constructor(file) {
    this.file = file;
    this.busy = false;
  }
  async send(socket, config, confirmed) {
    if (!confirmed) throw new Error("Confirma el destinatario y el mensaje.");
    if (!socket?.user || identity(socket.user.id) !== config.admin)
      throw new Error("La sesión no pertenece al administrador configurado.");
    if (this.busy) throw new Error("El envío ya está en curso.");
    this.busy = true;
    try {
      const previous = await readJson(this.file, null);
      if (previous) {
        if (
          previous.status === "accepted" ||
          previous.status === "delivered" ||
          previous.status === "read"
        )
          return previous;
        throw new Error(
          "El intento anterior tiene resultado incierto. Revisa el teléfono; no se reenvía automáticamente.",
        );
      }
      const jid = config.recipient + "@s.whatsapp.net";
      const [contact] = await socket.onWhatsApp(jid);
      if (!contact?.exists)
        throw new Error("El destinatario no está registrado en WhatsApp.");
      const record = {
        status: "sending",
        recipient: config.recipient,
        name: config.name,
        message: config.message,
        startedAt: new Date().toISOString(),
        fingerprint: createHash("sha256")
          .update(jid + config.message)
          .digest("hex"),
      };
      // Persist before network dispatch. A crash must never trigger an automatic second message.
      await atomicJson(this.file, record);
      const sent = await socket.sendMessage(jid, { text: config.message });
      if (!sent?.key?.id)
        throw new Error(
          "WhatsApp no devolvió identificador. Revisa el teléfono antes de reintentar.",
        );
      const accepted = {
        ...record,
        status: "accepted",
        messageId: sent.key.id,
        jid,
        outgoing: sent.message,
      };
      await atomicJson(this.file, accepted);
      return accepted;
    } finally {
      this.busy = false;
    }
  }
}
