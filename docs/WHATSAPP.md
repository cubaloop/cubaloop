# Prueba real de WhatsApp con Baileys

Este piloto usa `@whiskeysockets/baileys` 7.0.0-rc14, fijado en el lockfile. Es una versión candidata de una biblioteca **no oficial de Meta**. Debe validarse antes de comercializarla; no ofrece garantías de disponibilidad o de aceptación de la cuenta por WhatsApp.

## Probar en Windows

1. Descarga el ZIP del repositorio y extráelo en una carpeta privada.
2. Instala Node.js 24 LTS desde el sitio oficial si no lo tienes.
3. Abre `PROBAR-WHATSAPP.cmd`. Instala las dependencias y abre el panel privado en el navegador de ese ordenador. Mantén la ventana de comandos abierta.
4. Escribe el número internacional del administrador, el número del destinatario de prueba, su nombre y el mensaje personalizado. **Guardar esta prueba**.
5. Pulsa **Mostrar QR**. En el teléfono del administrador, abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo. Escanea el QR vivo del panel. No uses un QR antiguo ni lo compartas.
6. El estado debe indicar **Administrador conectado**. Si la cuenta no coincide con el número configurado, el gateway rechaza el envío.
7. Revisa el destinatario y el mensaje, marca la autorización y pulsa **Enviar una prueba**. El intento queda registrado para evitar envíos duplicados.
8. Comprueba WhatsApp en el teléfono de prueba. El panel diferencia aceptado, entregado y leído cuando WhatsApp proporciona esas confirmaciones. Las confirmaciones de lectura pueden no estar disponibles.

En macOS/Linux: `bash scripts/start-whatsapp.sh`. Node 24 es el único runtime necesario para esta prueba; no requiere Python, Groq ni Stripe.

## Datos y acceso

- Solo escucha en loopback; el enlace privado incluye un token temporal en el fragmento, nunca en parámetros HTTP. El panel lo conserva en sessionStorage. No compartir el enlace.
- Configuración, credenciales de dispositivo y registro del único mensaje se guardan en `.local/whatsapp/`, ignorado por Git. Nunca subir esa carpeta, copiarla a Pages ni compartirla por chat.
- Los números personales no están preconfigurados en el código público. Se introducen en el panel local.
- No hay endpoint de envío arbitrario: se manda exactamente el destinatario y texto guardados antes de conectar.
- No se registran listeners de mensajes entrantes. No lee ni responde al self-chat, contactos personales o grupos. Solo consulta estados del mensaje enviado por esta prueba.
- No elimina claves Signal ni sesiones al iniciar. Conserva la autenticación hasta que desvincules el dispositivo en WhatsApp.
- Un bloqueo de instancia impide iniciar dos procesos sobre la misma carpeta. Tras un cierre forzoso, confirma que no hay procesos activos antes de borrar **solo** `gateway.lock`. No borres `dispatch.json` para intentar resolver una entrega incierta.
- Si se escaneó una cuenta equivocada o se cerró sesión, desvincula el dispositivo en el teléfono, detén el proceso y usa una nueva ruta `JOTA_WA_DATA_DIR`. Conserva la carpeta antigua privada hasta aclarar cualquier intento anterior.
- `dispatch.json` se crea antes del envío. Si se produce un fallo después de aceptar el mensaje pero antes de confirmar, el resultado queda incierto y no se reintenta automáticamente. Para pruebas adicionales se necesita una decisión explícita y una carpeta nueva; no hacerlo mientras el intento anterior siga incierto.

## Red y límites

Requiere HTTPS/WSS hacia `web.whatsapp.com`. Se admite el proxy `HTTPS_PROXY`/`HTTP_PROXY` mediante `https-proxy-agent`, sin desactivar TLS. Si la red impide el WebSocket, el QR no aparecerá; ejecutar el piloto en el ordenador local suele evitar las restricciones del entorno de desarrollo cloud.

GitHub Pages sigue siendo una demo estática: no ejecuta Baileys, no almacena sesiones y no envía WhatsApp. Este piloto es para el operador administrador, no un gateway multiempresa abierto a todos los clientes SaaS. La facturación y los cupos Pro/Premium siguen desactivados hasta implementar aislamiento y contabilidad de envíos de producción.

## Pruebas

`npm test --prefix sidecars/wa-gateway` comprueba seis casos: validación, cuenta correcta y confirmación, envío exacto, deduplicación tras reinicio, ambigüedad de red, concurrencia y destinatario no registrado. Los sockets son simulados: eso no acredita una vinculación o entrega reales.
