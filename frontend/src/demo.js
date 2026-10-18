// GitHub Pages demonstration. Data is fictional and lives only in memory.
const seed = () => ({
  leads: [
    {
      id: 1,
      name: "Studio Oliva · Ejemplo",
      sector: "Arquitectura",
      email: "hola@example.com",
      phone: "",
      notes: "Cliente ficticio para explorar Jota",
      maps_url: null,
    },
  ],
  projects: [],
  audit: [],
  groq_configured: false,
  whatsapp: "not_implemented",
});
let state = seed();
const me = {
  email: "demo@example.com",
  status: "trial",
  trial_until: Date.now() / 1000 + 14 * 86400,
  entitled: true,
  billing_configured: false,
  plan: "trial",
  messaging_available: false,
  plans: [
    { id: "pro", name: "Pro", amount_aed: 999, messages: 300, days: 30 },
    {
      id: "premium",
      name: "Premium",
      amount_aed: 1499,
      messages: 700,
      days: 30,
    },
  ],
};
function log(project_id, action) {
  state.audit.unshift({
    id: state.audit.length + 1,
    project_id,
    action,
    created_at: new Date().toISOString(),
  });
}
export async function demoApi(path, method, body) {
  if (path === "/me") return structuredClone(me);
  if (path === "/state") return structuredClone(state);
  if (path === "/logout") {
    state = seed();
    return {};
  }
  if (path.startsWith("/auth/")) return {};
  if (path === "/leads" && method === "POST") {
    state.leads.unshift({ ...body, id: state.leads.length + 1 });
    return {};
  }
  if (path.startsWith("/projects?")) {
    if (
      state.projects.some((p) =>
        ["drafting", "review", "approved"].includes(p.status),
      )
    )
      throw Error("Termina el proyecto activo.");
    const lead_id = Number(
      new URLSearchParams(path.split("?")[1]).get("lead_id"),
    );
    const lead = state.leads.find((l) => l.id === lead_id);
    const p = {
      id: state.projects.length + 1,
      lead_id,
      name: lead.name,
      status: "drafting",
      proposal: "",
      demo_url: "",
    };
    state.projects.unshift(p);
    log(p.id, "Proyecto de demostración iniciado");
    return { id: p.id };
  }
  if (path.startsWith("/generate/"))
    return {
      source: "template",
      proposal:
        "Hello Studio Oliva team,\n\nWe would like to propose a tailored website for your business. Activation is AED 1,000, with optional annual support for AED 500.\n\nWould you like to review the prototype?\n\nBest regards",
    };
  const match = path.match(
    /^\/projects\/(\d+)\/(draft|approve|contacted|cancel)$/,
  );
  if (match) {
    const p = state.projects.find((p) => p.id === Number(match[1]));
    if (!p) throw Error("Proyecto no encontrado.");
    const action = match[2];
    if (action === "draft") {
      if (!["drafting", "review"].includes(p.status))
        throw Error("Propuesta no editable.");
      p.proposal = body.proposal;
      p.demo_url = body.demo_url;
      p.status = "review";
    } else {
      if (!body.confirmed) throw Error("Confirma la acción.");
      if (
        (action === "approve" && p.status !== "review") ||
        (action === "contacted" && p.status !== "approved")
      )
        throw Error("Acción no disponible.");
      p.status = {
        approve: "approved",
        contacted: "contacted",
        cancel: "cancelled",
      }[action];
    }
    log(
      p.id,
      {
        draft: "Borrador de ejemplo guardado",
        approve: "Aprobación simulada",
        contacted: "Contacto simulado: no se ha enviado ningún mensaje",
        cancel: "Proyecto cancelado",
      }[action],
    );
    return {};
  }
  throw Error(
    "Esta función requiere el servidor; no está disponible en la demostración.",
  );
}
