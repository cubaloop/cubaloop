const $ = (selector) => document.querySelector(selector);
const token =
  location.hash.slice(1) || sessionStorage.getItem("jota_wa_operator");
if (token) sessionStorage.setItem("jota_wa_operator", token);
history.replaceState(null, "", location.pathname);
let current = null,
  filled = false,
  busy = false;
async function api(path, body) {
  const result = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + (token || ""),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await result.json();
  if (!result.ok)
    throw Error(value.error || "No se pudo completar la operación.");
  return value;
}
function showError(e) {
  $("#error").textContent = e.message;
  $("#error").hidden = false;
}
function availability() {
  $("#send").disabled =
    busy ||
    current?.status !== "connected" ||
    !$("#confirm").checked ||
    !!current?.dispatch;
}
async function refresh() {
  current = await api("/status");
  const names = {
    disconnected: "Desconectado",
    connecting: "Conectando…",
    qr: "Escanea el QR",
    connected: "Administrador conectado",
    reconnecting: "Reconectando…",
    error: "Error de conexión",
    network_blocked: "Conexión bloqueada por la red",
    wrong_account: "Cuenta incorrecta",
    logged_out: "Sesión cerrada",
  };
  $("#status").textContent = names[current.status] || current.status;
  $("#detail").textContent = current.detail;
  $("#qr").hidden = !current.qr;
  if (current.qr) $("#qr").src = current.qr;
  else $("#qr").removeAttribute("src");
  if (current.config) {
    if (!filled) {
      for (const key of ["admin", "recipient", "name", "message"])
        $("#config").elements[key].value = current.config[key];
      filled = true;
    }
    $("#review").textContent =
      `Destinatario: ${current.config.name} · +${current.config.recipient}. Administrador: +${current.config.admin}.`;
    $("#message").textContent = current.config.message;
  }
  if (current.dispatch) {
    const names = {
      sending: "Resultado incierto: revisa WhatsApp antes de repetir.",
      accepted: "Mensaje aceptado por WhatsApp. Entrega todavía no confirmada.",
      delivered: "WhatsApp confirma la entrega.",
      read: "WhatsApp indica que el mensaje fue leído.",
    };
    $("#receipt").textContent =
      names[current.dispatch.status] || current.dispatch.status;
  }
  $("#connect").disabled =
    busy ||
    ["connected", "connecting", "qr", "reconnecting"].includes(current.status);
  for (const el of $("#config").elements)
    el.disabled =
      busy ||
      !!current.dispatch ||
      !["disconnected", "error", "logged_out", "network_blocked"].includes(
        current.status,
      );
  availability();
}
async function run(fn) {
  if (busy) return;
  busy = true;
  availability();
  $("#error").hidden = true;
  try {
    await fn();
    await refresh();
  } catch (e) {
    showError(e);
  } finally {
    busy = false;
    availability();
  }
}
$("#config").addEventListener("submit", (e) => {
  e.preventDefault();
  run(async () => {
    await api("/config", Object.fromEntries(new FormData(e.target)));
    filled = false;
  });
});
$("#connect").addEventListener("click", () => run(() => api("/connect", {})));
$("#confirm").addEventListener("change", availability);
$("#send").addEventListener("click", () =>
  run(() => api("/send-test", { confirmed: $("#confirm").checked })),
);
refresh().catch(showError);
setInterval(() => refresh().catch(showError), 2000);
