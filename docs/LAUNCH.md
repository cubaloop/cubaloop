# Lanzamiento de Jota Web

## Estado y límites

La versión 0.1 permite demostrar el proceso comercial completo y preparar un piloto privado. Falta verificar servicios reales, configurar los precios aprobados en Stripe y desplegar en infraestructura del propietario. No se han enviado mensajes ni cobrado pagos.

No abrir registros al público todavía: falta verificación de correo, recuperación de contraseña, gestión de eliminación de cuentas/datos, límites de consumo de IA por plan y control persistente de abuso. El limitador de autenticación actual es por proceso/IP y se reinicia con la aplicación. La prueba gratuita no impide crear cuentas con otros correos. Estos son trabajos pendientes de producto, no ajustes que se resuelvan con una clave.

## Infraestructura

Usar un servidor o plataforma de contenedores con **volumen persistente**, una única instancia/worker y un proxy HTTPS. No usar filesystem efímero ni múltiples réplicas con esta versión SQLite. El volumen contiene `accounts.db` y `tenants/<id>/crm.db`; protegerlo, respaldarlo y probar restauración. Datos y sesiones no están cifrados a nivel de aplicación: usar cifrado de disco del proveedor. Cada backup contiene información personal.

```bash
docker build -t jota-web:pilot .
docker volume create jota-data
docker run --name jota-web --restart unless-stopped \
  -p 127.0.0.1:8765:8765 \
  --env-file /ruta/segura/jota.env \
  -v jota-data:/data jota-web:pilot
```

El archivo seguro debe contener `APP_URL=https://tu-dominio` sin barra final. Docker ya define `JOTA_BIND=0.0.0.0` y `JOTA_DATA_DIR=/data`. La ruta debe ser escribible por UID 10001. No montar una carpeta vacía con permisos incorrectos. Mantener API e interfaz en el mismo dominio; cookies Secure se activan cuando APP_URL usa HTTPS.

Configurar el proxy para conservar Host, limitar tamaño de solicitudes, aplicar límites de tráfico y TLS. El proxy debe ser el único acceso público. No confiar en cabeceras de IP de clientes arbitrarios. El backend no habilita CORS. `/healthz` es público, sin datos privados.

## Stripe

1. Crear en Stripe un producto Jota con un dos precios recurrentes en AED: Pro 999 AED (99.900 fils) y Premium 1.499 AED (149.900 fils), ambos con `interval=day` e `interval_count=30`. Los cupos previstos son 300 y 700 mensajes respectivamente.
2. Inyectar `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID` y `STRIPE_PREMIUM_PRICE_ID` en el servidor mediante el gestor de secretos. Empezar en modo test.
3. Activar Customer Portal en Stripe para facturas, método de pago y cancelación.
4. Registrar el endpoint HTTPS `/api/billing/webhook` con los eventos `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`.
5. Inyectar `STRIPE_WEBHOOK_SECRET` como secreto real en el proceso. No sirve un placeholder de proxy: la firma se comprueba localmente.
6. Probar compra, webhook, activación, pago fallido, portal, cancelación al final del período y renovación. No activar desde la redirección `?billing=success`; solo un evento firmado actualiza acceso.
7. Revisar impuestos, facturas, política de reembolso y términos antes de cambiar a claves live.

El código reutiliza un Checkout abierto y consulta suscripciones existentes antes de crear otro. El webhook consulta Stripe para aplicar el estado actual, evitando que un evento retrasado restablezca un estado antiguo. Los eventos confirmados quedan registrados para evitar duplicados. Stripe debe poder reintentar en caso de fallo temporal.

## Groq

Inyectar `GROQ_API_KEY`; opcionalmente `GROQ_MODEL` (predeterminado `llama-3.3-70b-versatile`). Permitir salida HTTPS a `api.groq.com`. No se solicita ni almacena la clave en el navegador. La app pide consentimiento para compartir nombre y sector por generación. Notas, teléfonos y correos del lead no se envían. Probar el modelo disponible en la cuenta y sus límites antes de ofrecerlo como función pagada.

Stripe necesita `api.stripe.com`. Checkout y Customer Portal se abren en los dominios que devuelve Stripe. No enviar claves en chat, commits, capturas ni logs.

## Diferencias respecto al manifiesto

- El producto elegido es web por suscripción, no Tauri ni aplicación Windows.
- No existe conexión con la cuenta personal del fundador. La autenticación de clientes de Jota es independiente.
- WhatsApp requiere un diseño multiempresa y revisión de las condiciones del proveedor. El manifiesto denomina oficial a Baileys, pero no debe ofrecerse como cliente oficial ni prometerse funcionamiento garantizado.
- No se implementa la purga de sesiones criptográficas descrita: no es una garantía universal de reparación y podría causar pérdida de estado.
- No se contacta a terceros automáticamente. El usuario copia la propuesta aprobada y registra el contacto.
- El prototipo se prepara y publica fuera de Jota. Jota guarda y permite revisar el enlace.

## Antes de vender al público

Completar las funciones de cuenta y cuotas indicadas arriba; aprobar precio y moneda; publicar términos, privacidad y soporte con la identidad legal del propietario; verificar la contratación real en modo test; programar backups y monitorización; efectuar revisión de seguridad y restauración. No se han publicado textos legales ficticios ni elegido jurisdicción por el usuario.

## Primera validación de valor

El propietario ha elegido GitHub como primera publicación. Usar el workflow de demostración de Pages descrito en README. En esta etapa no activar Stripe live ni anunciar mensajes disponibles: la oferta está visible para validar interés, pero el canal multiempresa y el control de cupos de envíos reales aún no están implementados. El piloto Baileys del administrador permite validar por separado una conexión QR y un mensaje de prueba; consulta docs/WHATSAPP.md.
