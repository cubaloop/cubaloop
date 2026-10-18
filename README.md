# Jota Web

Piloto SaaS en español para organizar clientes, preparar propuestas y aprobar cada contacto. Adaptado del manifiesto Jota a la elección del propietario: **aplicación web por suscripción**. React + Vite, FastAPI, SQLite separado por cuenta, Stripe y Groq opcional.

## Lo que funciona

- Registro, inicio/cierre de sesión, contraseñas con scrypt y cookies HttpOnly.
- CRM por cuenta, búsqueda y exportación CSV con protección contra fórmulas.
- Un único proyecto activo por cuenta, impuesto mediante índice único en SQLite.
- Propuesta en inglés, enlace al prototipo, aprobación explícita y contacto **manual**.
- Propuestas aprobadas inmutables, historial de acciones y persistencia entre reinicios.
- Plantilla sin IA; adaptador Groq que envía solo nombre y sector previa autorización.
- Prueba de 14 días; al expirar conserva lectura y exportación, bloqueando nuevas escrituras.
- Stripe Checkout, portal de facturación y webhook firmado e idempotente. El navegador no puede elegir el precio ni activar la suscripción.
- Interfaz adaptable a escritorio y móvil, sin datos de clientes ficticios precargados.

## Inicio de desarrollo

Requisitos: Python 3.12, Node 24 y npm. En la raíz del repositorio:

```bash
bash scripts/install.sh
bash scripts/start.sh
```

El servidor utiliza el puerto 8765, enlazado solo a loopback por defecto. La interfaz compilada se sirve desde el mismo proceso. Crea una cuenta desde la pantalla inicial; no existen credenciales predeterminadas. No necesitas Groq ni Stripe para probar el flujo durante 14 días.

Los datos de desarrollo se guardan en `.local/data/`, ignorado por Git. No uses esa carpeta para almacenar datos reales en un entorno efímero. Las variables de `.env.example` son documentación: el programa **no carga automáticamente** un archivo `.env`; el proveedor de alojamiento o el shell debe inyectarlas.

Tras modificar la interfaz: `npm run build --prefix frontend`. Tras cambiar backend, reinicia el proceso. La salida de producción sirve siempre frontend y API en el mismo origen.

## Comprobaciones

```bash
.venv/bin/pip install pytest==8.3.5
.venv/bin/python -m pytest backend/tests -q
npm run build --prefix frontend
npm audit --prefix frontend --audit-level=high
```

Las pruebas cubren aislamiento entre cuentas, concurrencia de proyectos, persistencia, aprobación, CSRF/origen, expiración de prueba, exportación, consentimiento de Groq, precio de Stripe y webhooks. Los tests de Stripe usan un cliente simulado y firmas HMAC reales; no equivalen a una compra verificada en Stripe.

## Planes definidos

| Plan    | Precio cada 30 días | Mensajes a leads |
| ------- | ------------------: | ---------------: |
| Pro     |             999 AED |              300 |
| Premium |           1.499 AED |              700 |

Los cupos forman parte de la oferta a validar. **No se descuentan ni se anuncian como mensajes enviados**: WhatsApp todavía no está conectado. La contratación está deshabilitada en la interfaz hasta habilitar y validar el canal. El registro manual de contacto no equivale a un mensaje enviado.

## Despliegue y venta

Consulta [la guía de lanzamiento](docs/LAUNCH.md). Se incluye Dockerfile de dos etapas y CI para build y pruebas. Este repositorio es un piloto funcional, **no una publicación comercial terminada**.

Se incluye un piloto Baileys separado para vinculación por QR y un mensaje de prueba controlado del administrador. No se han implementado el gateway multiempresa de producción, generación/alojamiento de prototipos ni los 136 leads citados en el manifiesto. El documento no incluía esos datos ni código. Los precios de 1.000 AED y 500 AED/año corresponden a las propuestas de servicios a clientes; **no son el precio de la suscripción a Jota**.

Esta edición almacena datos en el servidor; no promete soberanía exclusivamente local. Groq implica procesamiento externo y Stripe procesa la facturación.

## Demostración en GitHub Pages

El workflow `.github/workflows/pages.yml` publica únicamente una demostración estática con datos ficticios. No contiene claves, base de datos ni backend. Sus cambios viven en memoria y desaparecen al recargar. No introducir datos reales.

1. Subir el repositorio a GitHub.
2. En **Settings → Pages → Source**, elegir **GitHub Actions**.
3. En **Actions → Publish interactive demo**, ejecutar **Run workflow** sobre `main`.
4. GitHub mostrará la dirección publicada al terminar; no se presupone una publicación exitosa antes de comprobar ese resultado.

Construcción local de la demo (separada del frontend real):

```bash
VITE_DEMO_MODE=true npm run build --prefix frontend -- --base=/cubaloop/ --outDir=../.local/pages/cubaloop
```

El SaaS completo necesita servidor con almacenamiento persistente; GitHub Pages no puede alojar Python, claves ni webhooks.

## Probar WhatsApp real

En Windows, descarga y extrae el proyecto, instala Node.js 24 LTS y abre `PROBAR-WHATSAPP.cmd`. El panel local permite configurar el administrador y el destinatario, vincular por QR y enviar una única prueba revisada. No envía nada al escanear. [Guía completa y límites](docs/WHATSAPP.md). GitHub Pages incluye la sección **Probar WhatsApp**, pero no ejecuta el gateway.
