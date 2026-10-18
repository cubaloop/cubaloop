import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Plus,
  Users,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
  Search,
  Download,
  X,
  ArrowRight,
  Check,
  LogOut,
  BriefcaseBusiness,
  CircleHelp,
} from "lucide-react";
import "./style.css";
import { demoApi } from "./demo";
const DEMO = import.meta.env.VITE_DEMO_MODE === "true";

async function api(path, method = "GET", body) {
  if (DEMO) return demoApi(path, method, body);
  const res = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg;
    try {
      const j = await res.json();
      msg =
        typeof j.detail === "string"
          ? j.detail
          : "Revisa los campos e inténtalo de nuevo.";
    } catch {
      msg =
        res.status === 401
          ? "Inicia sesión para continuar."
          : res.status === 402
            ? "Tu prueba ha terminado. Activa tu suscripción."
            : "No se pudo completar la operación.";
    }
    throw new Error(msg);
  }
  return res.json();
}
const labels = {
  drafting: "En preparación",
  review: "Por aprobar",
  approved: "Aprobado",
  contacted: "Contactado",
  cancelled: "Cancelado",
};
function App() {
  const [me, setMe] = useState(null),
    [loading, setLoading] = useState(true),
    [state, setState] = useState({ leads: [], projects: [], audit: [] }),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(false),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState(""),
    [demo, setDemo] = useState(""),
    [consent, setConsent] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const active = state.projects.find((p) =>
    ["drafting", "review", "approved"].includes(p.status),
  );
  async function refresh() {
    const [m, s] = await Promise.all([api("/me"), api("/state")]);
    setMe(m);
    setState(s);
  }
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    setProposal(active?.proposal || "");
    setDemo(active?.demo_url || "");
    setConfirmed(false);
  }, [active?.id, active?.proposal, active?.status]);
  async function run(fn) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function act(action) {
    await api(`/projects/${active.id}/${action}`, "POST", { confirmed: true });
    await refresh();
  }
  async function exportCsv() {
    if (DEMO)
      throw new Error(
        "La exportación de datos reales requiere el servidor. Esta es una demostración.",
      );
    const r = await fetch("/api/export");
    if (!r.ok) throw new Error("No se pudo exportar.");
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "jota-clientes.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (loading)
    return <div className="loading">Jota · Preparando tu espacio…</div>;
  if (!me)
    return (
      <Auth
        error={error}
        busy={busy}
        onSubmit={(action, data) =>
          run(async () => {
            await api("/auth/" + action, "POST", data);
            await refresh();
          })
        }
      />
    );
  const contacted = state.projects.filter(
    (p) => p.status === "contacted",
  ).length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          jota<span>•</span>
        </a>
        <div className="workspace">
          <div className="avatar">J</div>
          <div>
            Mi espacio de trabajo<small>Jota para negocios</small>
          </div>
        </div>
        <p className="nav-label">TU OFICINA</p>
        <nav>
          {[
            ["overview", LayoutDashboard, "Vista general"],
            ["crm", Users, "Clientes"],
            ["project", BriefcaseBusiness, "Proyecto activo"],
            ["whatsapp", CircleHelp, "Probar WhatsApp"],
            ["settings", Settings, "Configuración"],
          ].map(([id, Icon, text]) => (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {text}
              {id === "project" && active && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trial">
            <Sparkles size={20} />
            <strong>
              {["active", "trialing"].includes(me.status)
                ? "Tu plan está activo"
                : "Haz espacio para crecer"}
            </strong>
            <p>
              {["active", "trialing"].includes(me.status)
                ? "Gestiona tu suscripción en Configuración."
                : `Prueba hasta el ${new Date(me.trial_until * 1000).toLocaleDateString("es")}.`}
            </p>
            <button onClick={() => setTab("settings")}>
              Ver mi plan <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="user">
            <span className="avatar">{me.email[0].toUpperCase()}</span>
            <span>
              {me.email}
              <small>Tu cuenta</small>
            </span>
            <button
              aria-label="Cerrar sesión"
              onClick={() =>
                run(async () => {
                  if (DEMO) {
                    window.location.reload();
                    return;
                  }
                  await api("/logout", "POST");
                  setMe(null);
                  setState({ leads: [], projects: [], audit: [] });
                })
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Mi espacio <span className="slash">/</span>{" "}
            {
              {
                overview: "Vista general",
                crm: "Clientes",
                project: "Proyecto activo",
                settings: "Configuración",
                whatsapp: "Probar WhatsApp",
              }[tab]
            }
          </span>
          <span className="private">
            <ShieldCheck size={15} /> Espacio privado
          </span>
        </header>
        <div className="content">
          {DEMO && (
            <div className="demo-banner">
              <strong>Demostración interactiva</strong> · Datos ficticios, sin
              cobros ni mensajes. Los cambios desaparecen al recargar. No
              introduzcas datos reales.
            </div>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
              <button aria-label="Cerrar error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {tab === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">MENOS RUIDO. MÁS FOCO.</p>
                  <h1>
                    Tu próximo gran cliente
                    <br />
                    empieza aquí.
                  </h1>
                  <p>Un negocio a la vez. Cada paso, bajo tu control.</p>
                </div>
                <button className="primary" onClick={() => setModal(true)}>
                  <Plus size={17} /> Añadir cliente
                </button>
              </div>
              <div className="stats">
                {[
                  [
                    "Clientes en tu CRM",
                    state.leads.length,
                    "Tu próxima oportunidad",
                  ],
                  [
                    "Proyecto en curso",
                    active ? "01" : "00",
                    active?.name || "Listo cuando tú lo estés",
                  ],
                  [
                    "Contactos registrados",
                    contacted,
                    "Conversaciones que tú inicias",
                  ],
                ].map(([title, n, sub], i) => (
                  <div className="stat" key={title}>
                    <div>
                      {title}
                      <span>0{i + 1}</span>
                    </div>
                    <strong>{String(n).padStart(2, "0")}</strong>
                    <small>{sub}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="focus card">
                  <div className="section-title">
                    <h2>El foco de hoy</h2>
                    <span className="badge">
                      {active ? labels[active.status] : "Todo por empezar"}
                    </span>
                  </div>
                  <div className="focus-icon">
                    <BriefcaseBusiness size={28} />
                  </div>
                  <h2>
                    {active
                      ? active.name
                      : "Una oportunidad. Toda tu atención."}
                  </h2>
                  <p>
                    {active
                      ? "Prepara una propuesta, revisa el prototipo y aprueba el siguiente paso."
                      : "Añade tu primer cliente y transforma una buena idea en una propuesta concreta."}
                  </p>
                  <button
                    className="primary"
                    onClick={() => (active ? setTab("project") : setTab("crm"))}
                  >
                    {active ? "Continuar proyecto" : "Explorar mis clientes"}
                    <ArrowRight size={17} />
                  </button>
                  <div className="steps">
                    {["Preparar", "Revisar", "Aprobar", "Contactar"].map(
                      (s, i) => (
                        <span
                          key={s}
                          className={
                            active &&
                            i <=
                              ["drafting", "review", "approved"].indexOf(
                                active.status,
                              )
                              ? "current"
                              : ""
                          }
                        >
                          <b>{i + 1}</b>
                          {s}
                        </span>
                      ),
                    )}
                  </div>
                </section>
                <section className="principle">
                  <p className="eyebrow">EL MÉTODO JOTA</p>
                  <h2>
                    La inteligencia ayuda.
                    <br />
                    Tú decides.
                  </h2>
                  <p>
                    Propuestas claras, clientes organizados y un proceso que
                    nunca avanza sin tu aprobación.
                  </p>
                  <div>
                    <ShieldCheck size={20} />
                    <span>Ningún mensaje se envía automáticamente.</span>
                  </div>
                  <span className="decor">j.</span>
                </section>
              </div>
              <section className="card activity">
                <div className="section-title">
                  <h2>Últimos movimientos</h2>
                  <span className="muted">Tu actividad, en orden</span>
                </div>
                {state.audit.length ? (
                  state.audit.slice(0, 4).map((a) => (
                    <div className="activity-row" key={a.id}>
                      <span className="activity-check">
                        <Check size={15} />
                      </span>
                      <span>
                        {a.action}
                        <small>Proyecto #{a.project_id}</small>
                      </span>
                      <time>{new Date(a.created_at).toLocaleString("es")}</time>
                    </div>
                  ))
                ) : (
                  <div className="empty-inline">
                    Aquí verás los avances de tus proyectos. El primer paso es
                    tuyo.
                  </div>
                )}
              </section>
            </>
          )}
          {tab === "crm" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">RELACIONES QUE IMPORTAN</p>
                  <h1>Tus clientes</h1>
                  <p>De una primera conversación a una nueva oportunidad.</p>
                </div>
                <button className="primary" onClick={() => setModal(true)}>
                  <Plus size={17} /> Añadir cliente
                </button>
              </div>
              <section className="card">
                <div className="table-tools">
                  <label className="search">
                    <Search size={17} />
                    <input
                      placeholder="Buscar nombre o sector…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => run(exportCsv)}
                  >
                    <Download size={16} /> Exportar CSV
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Negocio</th>
                        <th>Contacto</th>
                        <th>Sector</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.leads
                        .filter((l) =>
                          (l.name + " " + l.sector)
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        )
                        .map((l) => (
                          <tr key={l.id}>
                            <td>
                              <strong>{l.name}</strong>
                              {l.maps_url && (
                                <a
                                  href={l.maps_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Ver ubicación ↗
                                </a>
                              )}
                            </td>
                            <td>{l.email || l.phone || "Sin contacto"}</td>
                            <td>{l.sector || "—"}</td>
                            <td>
                              <button
                                className="secondary"
                                disabled={busy || !!active}
                                onClick={() =>
                                  run(async () => {
                                    await api(
                                      "/projects?lead_id=" + l.id,
                                      "POST",
                                    );
                                    await refresh();
                                    setTab("project");
                                  })
                                }
                              >
                                Iniciar proyecto <ArrowRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!state.leads.length && (
                  <div className="empty-inline">
                    Aún no hay clientes. Añade el primer negocio para empezar.
                  </div>
                )}
                {active && (
                  <p className="table-note">
                    Termina o cancela el proyecto activo antes de iniciar otro.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "project" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">UN PASO A LA VEZ</p>
                  <h1>{active?.name || "Tu próximo proyecto"}</h1>
                  <p>
                    {active
                      ? "Prepara, revisa y aprueba. El contacto final es manual."
                      : "Selecciona un cliente para empezar."}
                  </p>
                </div>
                {active && (
                  <span className="badge">{labels[active.status]}</span>
                )}
              </div>
              {!active ? (
                <section className="card empty-inline">
                  <p>No tienes un proyecto activo.</p>
                  <button className="primary" onClick={() => setTab("crm")}>
                    Ver clientes <ArrowRight size={16} />
                  </button>
                </section>
              ) : (
                <div className="project-grid">
                  <section className="card editor">
                    <h2>Propuesta comercial</h2>
                    <p className="muted">
                      En inglés · 1.000 AED + soporte opcional de 500 AED/año
                    </p>
                    {active.status !== "approved" && (
                      <>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                            disabled={!state.groq_configured}
                          />
                          Autorizo enviar el nombre y sector de este cliente a
                          Groq.
                        </label>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              const r = await api(
                                "/generate/" + active.id,
                                "POST",
                                { share_with_groq: consent },
                              );
                              setProposal(r.proposal);
                              setNotice(
                                r.source === "groq"
                                  ? "Borrador generado con Groq. Revísalo antes de guardarlo."
                                  : "Plantilla local creada. Personalízala antes de guardarla.",
                              );
                            })
                          }
                        >
                          <Sparkles size={16} />
                          {consent
                            ? "Generar con Groq"
                            : "Usar plantilla local"}
                        </button>
                      </>
                    )}
                    <label>
                      Mensaje para el cliente
                      <textarea
                        rows="12"
                        value={proposal}
                        readOnly={active.status === "approved"}
                        onChange={(e) => setProposal(e.target.value)}
                        placeholder="Escribe tu propuesta o empieza con una plantilla…"
                      />
                    </label>
                    <label>
                      Enlace al prototipo
                      <input
                        type="url"
                        value={demo}
                        readOnly={active.status === "approved"}
                        onChange={(e) => setDemo(e.target.value)}
                        placeholder="https://tu-demo.com"
                      />
                    </label>
                    <p className="hint">
                      Crea y publica el prototipo por separado. Jota registra el
                      enlace para revisarlo.
                    </p>
                    {active.status !== "approved" && (
                      <button
                        className="primary"
                        disabled={busy || proposal.length < 10 || !demo}
                        onClick={() =>
                          run(async () => {
                            await api(
                              "/projects/" + active.id + "/draft",
                              "PUT",
                              { proposal, demo_url: demo },
                            );
                            await refresh();
                            setNotice(
                              "Propuesta guardada. Ya puedes revisarla.",
                            );
                          })
                        }
                      >
                        Guardar para revisión <ArrowRight size={16} />
                      </button>
                    )}
                  </section>
                  <section className="card approval">
                    <ShieldCheck size={26} />
                    <h2>Tu aprobación cuenta</h2>
                    <p>
                      Revisa el prototipo y el mensaje guardado antes de
                      continuar.
                    </p>
                    {active.demo_url && (
                      <a
                        className="secondary"
                        href={active.demo_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir prototipo <ArrowUpRight size={16} />
                      </a>
                    )}
                    {active.status === "review" && (
                      <>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                          />
                          He revisado el prototipo y la propuesta guardada.
                        </label>
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            !confirmed ||
                            proposal !== active.proposal ||
                            demo !== active.demo_url
                          }
                          onClick={() => run(() => act("approve"))}
                        >
                          Aprobar propuesta <Check size={16} />
                        </button>
                      </>
                    )}
                    {active.status === "approved" && (
                      <>
                        <p className="success">
                          Propuesta aprobada. Puedes copiarla y enviarla
                          manualmente.
                        </p>
                        <button
                          className="secondary"
                          onClick={() =>
                            run(async () => {
                              await navigator.clipboard.writeText(
                                active.proposal,
                              );
                              setNotice("Propuesta copiada.");
                            })
                          }
                        >
                          Copiar propuesta
                        </button>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                          />
                          Ya he contactado al cliente por mi cuenta.
                        </label>
                        <button
                          className="primary"
                          disabled={!confirmed || busy}
                          onClick={() => run(() => act("contacted"))}
                        >
                          Registrar contacto
                        </button>
                      </>
                    )}
                    <div className="approval-foot">
                      <CircleHelp size={16} />
                      Jota no envía mensajes a WhatsApp ni a otros canales.
                    </div>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Cancelar este proyecto? La actividad quedará registrada.",
                          )
                        )
                          run(() => act("cancel"));
                      }}
                    >
                      Cancelar proyecto
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
          {tab === "whatsapp" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    CONEXIÓN REAL · PILOTO DEL ADMINISTRADOR
                  </p>
                  <h1>Prueba Jota en WhatsApp.</h1>
                  <p>
                    Vincula por QR, revisa el mensaje y envía una prueba desde
                    tu ordenador.
                  </p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="card editor">
                  <h2>1. Abre el piloto local</h2>
                  <p>
                    Descarga el proyecto, extrae el ZIP e instala Node.js 24
                    LTS. En Windows, abre <strong>PROBAR-WHATSAPP.cmd</strong>.
                    El panel privado se abrirá en tu navegador.
                  </p>
                  <a
                    className="secondary"
                    href="https://github.com/cubaloop/cubaloop/archive/refs/heads/main.zip"
                  >
                    Descargar proyecto <Download size={16} />
                  </a>
                  <p>
                    <a
                      href="https://nodejs.org/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Instalar Node.js ↗
                    </a>
                  </p>
                </section>
                <section className="card editor">
                  <h2>2. Vincula y revisa</h2>
                  <p>
                    Introduce el número administrador, el destinatario, su
                    nombre y el mensaje. Guarda, pulsa Mostrar QR y escanea
                    desde WhatsApp → Dispositivos vinculados.
                  </p>
                  <p>
                    El número vinculado debe coincidir con el administrador.
                    Después revisa el texto y pulsa Enviar una prueba.
                  </p>
                </section>
                <section className="card editor">
                  <h2>Una prueba controlada</h2>
                  <p>
                    No se envía nada al escanear. El piloto evita repetir el
                    mensaje por un doble clic o una reconexión. No lee ni
                    contesta tus conversaciones personales.
                  </p>
                  <p>
                    Baileys es una biblioteca no oficial. Los cupos comerciales
                    siguen pendientes de implementación.
                  </p>
                  <a
                    className="secondary"
                    href="https://github.com/cubaloop/cubaloop/blob/main/docs/WHATSAPP.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Guía de prueba completa <ArrowUpRight size={16} />
                  </a>
                </section>
                <section className="card editor">
                  <h2>¿Por qué fuera de esta página?</h2>
                  <p>
                    GitHub Pages solo sirve esta demostración. La sesión de
                    WhatsApp necesita un proceso activo y almacenamiento
                    privado, que el piloto mantiene en tu ordenador.
                  </p>
                  <p>
                    Nunca subas la carpeta .local ni compartas el enlace privado
                    del operador.
                  </p>
                </section>
              </div>
            </>
          )}
          {tab === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">A TU MANERA</p>
                  <h1>Tu espacio, tus reglas.</h1>
                  <p>Suscripción, inteligencia y transparencia.</p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="card editor">
                  <h2>Tu suscripción</h2>
                  <span className="badge">
                    {["active", "trialing"].includes(me.status)
                      ? "Suscripción activa"
                      : me.entitled
                        ? "Prueba gratuita"
                        : "Prueba finalizada"}
                  </span>
                  <p>
                    14 días para conocer Jota. Elige el plan que acompaña a tu
                    negocio. Los cupos de mensajes están pendientes de activar
                    el canal de envío.
                  </p>
                  <div className="plan-options">
                    {(me.plans || []).map((plan) => (
                      <div className="plan-option" key={plan.id}>
                        <strong>{plan.name}</strong>
                        <h3>
                          {plan.amount_aed.toLocaleString("es")}{" "}
                          <small>AED / 30 días</small>
                        </h3>
                        <p>{plan.messages} mensajes a leads por período</p>
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            !me.billing_configured ||
                            !me.messaging_available
                          }
                          onClick={() =>
                            run(async () => {
                              const r = await api("/billing/checkout", "POST", {
                                plan: plan.id,
                              });
                              window.location.assign(r.url);
                            })
                          }
                        >
                          Elegir {plan.name} <ArrowUpRight size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="hint">
                    Oferta en validación. No se venden cupos ni se cobran planes
                    hasta conectar y verificar el envío de mensajes.
                  </p>
                  <button
                    className="secondary"
                    disabled={busy || !me.billing_configured}
                    onClick={() =>
                      run(async () => {
                        const r = await api("/billing/portal", "POST");
                        window.location.assign(r.url);
                      })
                    }
                  >
                    Gestionar plan y facturas
                  </button>
                  {!me.billing_configured && (
                    <p className="hint">
                      Los cobros aún no están habilitados en esta instalación.
                    </p>
                  )}
                </section>
                <section className="card editor">
                  <h2>Inteligencia y canales</h2>
                  <div className="integration">
                    <span>
                      Groq<small>Generación de propuestas</small>
                    </span>
                    <span className="badge">
                      {state.groq_configured ? "Configurado" : "Sin configurar"}
                    </span>
                  </div>
                  <p>
                    Solo se comparte el nombre y sector del cliente cuando
                    marcas la autorización. Las plantillas funcionan sin
                    servicios externos.
                  </p>
                  <div className="integration">
                    <span>
                      WhatsApp<small>Piloto Baileys del administrador</small>
                    </span>
                    <button
                      className="secondary"
                      onClick={() => setTab("whatsapp")}
                    >
                      Probar por QR
                    </button>
                  </div>
                  <p>
                    Esta versión permite copiar propuestas y registrar contactos
                    manuales.
                  </p>
                </section>
                <section className="card editor">
                  <h2>Sobre tus datos</h2>
                  <p>
                    Los clientes y proyectos se guardan en el servidor de Jota,
                    separados por cuenta. Esta edición web no almacena el CRM
                    exclusivamente en tu ordenador.
                  </p>
                  <button className="secondary" onClick={() => run(exportCsv)}>
                    <Download size={16} /> Exportar clientes
                  </button>
                  <p className="hint">
                    Versión piloto 0.1 · No se han activado cobros reales ni
                    WhatsApp para clientes SaaS.
                  </p>
                </section>
              </div>
            </>
          )}
          <footer>
            Jota <span>Hecho para avanzar con intención.</span>
            <small>Edición web · Piloto</small>
          </footer>
        </div>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-lead"
          >
            <div className="section-title">
              <h2 id="new-lead">Una nueva oportunidad</h2>
              <button aria-label="Cerrar" onClick={() => setModal(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="muted">
              Empieza con lo esencial. El resto viene después.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                if (!data.maps_url) data.maps_url = null;
                run(async () => {
                  await api("/leads", "POST", data);
                  await refresh();
                  setModal(false);
                  setTab("crm");
                });
              }}
            >
              <label>
                Nombre del negocio
                <input
                  name="name"
                  required
                  maxLength="160"
                  autoFocus
                  placeholder="Ej. Studio Oliva"
                />
              </label>
              <div className="form-row">
                <label>
                  Sector
                  <input
                    name="sector"
                    maxLength="100"
                    placeholder="Arquitectura"
                  />
                </label>
                <label>
                  Teléfono
                  <input name="phone" maxLength="40" placeholder="+971…" />
                </label>
              </div>
              <label>
                Correo de contacto
                <input
                  name="email"
                  type="email"
                  maxLength="254"
                  placeholder="hola@negocio.com"
                />
              </label>
              <label>
                Enlace de Google Maps
                <input
                  name="maps_url"
                  type="url"
                  placeholder="https://maps.google.com/…"
                />
              </label>
              <label>
                Notas
                <textarea
                  name="notes"
                  rows="3"
                  maxLength="4000"
                  placeholder="¿Qué oportunidad has detectado?"
                />
              </label>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                Guardar cliente <Plus size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function Auth({ onSubmit, error, busy }) {
  const [register, setRegister] = useState(false);
  return (
    <div className="auth">
      <section className="auth-story">
        <a className="brand" href={import.meta.env.BASE_URL}>
          jota<span>•</span>
        </a>
        <div>
          <p className="eyebrow">TU OFICINA COMERCIAL, EN CALMA.</p>
          <h1>
            Grandes relaciones.
            <br />
            Pequeños pasos.
            <br />
            <em>Todo en su sitio.</em>
          </h1>
          <p>
            Organiza clientes, prepara propuestas y avanza con intención. Tú
            tienes la última palabra.
          </p>
          <div className="auth-feature">
            <ShieldCheck />
            Sin envíos automáticos. Sin perder el control.
          </div>
        </div>
        <small>Jota · Edición web para negocios</small>
      </section>
      <section className="auth-form">
        <p className="eyebrow">UN ESPACIO PARA CRECER</p>
        <h2>
          {register ? "Empieza algo bueno." : "Qué bueno verte de nuevo."}
        </h2>
        <p>
          {register
            ? "Crea tu cuenta y prueba Jota durante 14 días. Sin tarjeta."
            : "Entra en tu espacio y retoma el siguiente paso."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(
              register ? "register" : "login",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
          }}
        >
          <label>
            Tu correo
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="tu@empresa.com"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              name="password"
              required
              minLength="12"
              maxLength="128"
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="Al menos 12 caracteres"
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Un momento…"
              : register
                ? "Crear mi espacio"
                : "Entrar en Jota"}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "¿Ya tienes cuenta?" : "¿Es tu primera vez?"}{" "}
          <button onClick={() => setRegister(!register)}>
            {register ? "Inicia sesión" : "Prueba Jota gratis"}
          </button>
        </p>
        <div className="pilot-note">
          Piloto privado · Los datos se guardan en el servidor. La facturación
          depende de la configuración del administrador.
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
