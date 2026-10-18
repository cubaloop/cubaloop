# Validación realizada

- 12 pruebas de backend: aprobación, aislamiento entre cuentas, concurrencia, persistencia, autenticación/origen, expiración de prueba, CSV, consentimiento y minimización de datos en Groq, configuración de Stripe, firma/deduplicación de webhook y selección del precio en servidor.
- Build de producción y build de demostración con Vite 8.3.4.
- Prueba real en Chromium del flujo registro → cliente → propuesta → revisión → aprobación → contacto manual; escritorio y móvil, sin errores de JavaScript ni desbordamiento horizontal.
- Prueba de demostración bajo `/cubaloop/`: Pro 999 AED, Premium 1.499 AED, flujo de ejemplo, navegación por el logo, pagos deshabilitados, cero peticiones a `/api/` y móvil.
- Auditorías npm y pip: sin vulnerabilidades conocidas tras actualizar Vite, FastAPI, Starlette y Uvicorn. Esto no sustituye una revisión de seguridad completa.
- Instalación desde lockfile y arranque repetidos en el entorno de desarrollo.

Las pruebas de navegador se conservaron en `docs/validation/`. Requieren Playwright y Chromium en `/usr/bin/chromium`, con la app ejecutándose en el puerto 8765 y la demo estática en 8766. Crean exclusivamente cuentas y clientes ficticios; usar una base de datos de prueba. Las pruebas de Stripe/Groq emplean adaptadores simulados; ninguna llamada autenticada real se ha validado porque no hay credenciales configuradas.

Docker: se descargaron las imágenes base, pero los pasos `pip install`/`npm ci` dentro del build no resuelven DNS, incluso con red host. El Dockerfile no está validado de extremo a extremo. La API GitHub tampoco resultó accesible mediante el proxy para administrar Pages. No confundir código subido con un sitio publicado: confirmar el workflow de Pages en GitHub.
