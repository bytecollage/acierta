# Arquitectura y operación

Acierta es un sitio estático. El navegador hace todo el trabajo de la app; lo único que
necesita un servicio externo es el historial de intentos de cada estudiante.

```text
┌────────────────────────── navegador ───────────────────────────┐
│ index.html · panel.html · js/*.js                              │
│                                                                │
│ data/*.json ◀─ GitHub Pages (exámenes, claves, catálogo)       │
│ auth.js ◀──── Google Identity Services (ID token de Google)    │
│ storage.js ─▶ Apps Script /exec ─▶ Google Sheets (historial)   │
│ localStorage: intento en curso, cola de envíos, caché, sesión  │
└────────────────────────────────────────────────────────────────┘
```

| Pieza | Dónde | Qué hace |
|---|---|---|
| Sitio | GitHub Pages, repo `bytecollage/acierta` | Sirve `web/` en <https://bytecollage.github.io/acierta/> |
| Exámenes | `web/data/` | JSON estáticos; ver [datos.md](datos.md) |
| Inicio de sesión | Google Cloud, proyecto `exani-515214`, cliente OAuth «Exani web» | Da un ID token al navegador |
| API del historial | Apps Script `exani-api`, ligado a la hoja EXANI-DB | Verifica el token, lee y añade intentos |
| Historial | Google Sheets EXANI-DB | Pestañas `attempts` y `students` |

---

## 1. Archivos de la app

| Archivo | Función |
|---|---|
| `index.html` | Bienvenida. Precarga el catálogo y el historial mientras se leen las instrucciones |
| `panel.html` | Pestañas, examen, resultados y reporte. Navega por hash (`#examenes`, `#examen/<id>`…) |
| `privacidad.html` | Aviso de privacidad, enlazado desde la pantalla de inicio de sesión de Google |
| `js/config.js` | URL `/exec` de la API y client ID de OAuth. **Públicos por diseño** |
| `js/auth.js` | Inicio de sesión con Google Identity Services; guarda el ID token y el nombre |
| `js/storage.js` | Historial (API + cola + caché) e intento en curso |
| `js/grading.js` | Validación de datos y corrección. Sin DOM: también lo usa `validate.js` |
| `js/app.js` | Panel, barra fija, examen, cronómetro, corrección y resultados |
| `js/dashboard.js` | Resumen de «Mi progreso» y pantalla «Reporte detallado» |
| `js/charts.js` | Gráficas de línea SVG propias, dibujadas al ancho real; tabla equivalente opcional |
| `manifest.webmanifest`, `icons/` | Instalación en la pantalla de inicio del celular |

---

## 2. Identidad

1. El estudiante pulsa «Iniciar sesión con Google». Google Identity Services devuelve un
   **ID token** (JWT, dura 1 hora) que `auth.js` guarda en `localStorage` (`exani.auth`).
2. Cada llamada a la API lleva ese token. El Apps Script lo verifica con
   `oauth2.googleapis.com/tokeninfo`: audiencia igual al client ID, emisor de Google y no
   vencido. El resultado se guarda en caché del script mientras el token es válido.
3. El estudiante se guarda como `SHA-256(PEPPER + ":" + sub)`. **La hoja no contiene
   correos ni nombres.** `sub` es el identificador estable de la cuenta de Google.

Si el token vence (un examen puede durar más de una hora), el intento terminado espera en
la cola local y se sube cuando hay sesión de nuevo. Al abrir la app con la sesión vencida,
se intenta renovar sin interacción.

---

## 3. API del historial (`apps-script/Code.gs`)

Todas las acciones van por `POST`, con el cuerpo JSON enviado como `text/plain` para
evitar el *preflight* CORS, que Apps Script no atiende.

| Acción | Cuerpo | Efecto |
|---|---|---|
| `list` | `{ idToken }` | Intentos del estudiante, ordenados por fecha |
| `create` | `{ idToken, record }` | Añade un intento |
| `import` | `{ adminKey, email, records }` | Carga intentos para un correo; pasan a la cuenta del estudiante en su primer inicio de sesión |

**No hay acciones de edición ni de borrado.** Si hace falta borrar algo, se hace a mano en
la hoja.

`create`:

- valida campos y tipos, y descarta los campos desconocidos;
- rechaza textos que la hoja interpretaría como fórmula (`=`, `+`, `-`, `@` al inicio);
- calcula `attemptNumber` e `isFirstAttempt` por fecha (el cliente puede no conocer
  intentos de otros dispositivos);
- es idempotente: examen + `completedAt` + cadena identifican un intento;
- limita a 200 intentos por examen y estudiante, y a 30 envíos cada 10 minutos.

### 3.1 Hoja EXANI-DB

El script crea las pestañas con encabezados y en formato de texto plano. No se editan los
encabezados a mano.

**`attempts`**: un renglón por intento terminado.

| Columna | Contenido |
|---|---|
| `id` | UUID del renglón |
| `studentId` | Hash del estudiante, o `pending:<hash del correo>` para intentos importados aún no reclamados |
| `examId`, `examTitle`, `version` | Examen al que pertenece |
| `completedAt` | Fecha ISO de término |
| `attemptNumber`, `isFirstAttempt` | Calculados por el servidor |
| `score`, `total`, `percentage`, `correctCount`, `incorrectCount` | Resultado |
| `minutes`, `activeMs`, `elapsedWallMs` | Tiempo activo y de reloj |
| `answers` | Cadena `<código>\|<minutos>\|<LETRAS>`; también acepta el formato anterior `<minutos><LETRAS>` |
| `keyDistribution`, `areaResults`, `topicResults`, `topicAreas` | JSON |
| `createdAt` | Fecha de escritura |

**`students`**: `studentId`, `createdAt`, `lastSeenAt`.

### 3.2 Configuración (`apps-script/Config.gs`, **no versionado**)

| Clave | Qué es |
|---|---|
| `SPREADSHEET_ID` | ID de la hoja EXANI-DB |
| `GOOGLE_CLIENT_ID` | Debe coincidir con `web/js/config.js` |
| `PEPPER` | Secreto para derivar `studentId`. **No cambiarlo nunca**: todos los historiales quedarían huérfanos |
| `ADMIN_KEY` | Clave de la acción `import` |

`Config.example.gs` es la plantilla.

### 3.3 Actualizar el script

1. Pegar el nuevo `Code.gs` en el editor de Apps Script (Extensiones → Apps Script desde la hoja).
2. **Implementar → Gestionar implementaciones → Editar → Versión: Nueva versión.**

Si se crea una implementación nueva en lugar de editar la existente, la URL `/exec`
cambia y hay que actualizar `web/js/config.js`.

---

## 4. Almacenamiento en el navegador (`js/storage.js`)

| Dato | Clave de `localStorage` | Notas |
|---|---|---|
| Intento en curso o corregido | `exani.attempt.<examId>.v<version>` | Por navegador; no depende de la sesión |
| Cola de intentos sin confirmar | `exani.pending` | Cada intento terminado pasa por aquí antes de subirse |
| Caché del historial | `exani.cache` | Último historial leído, por cuenta. Se borra al cerrar sesión |
| Sesión | `exani.auth` | ID token y nombre para mostrar |
| Historial en modo local | `exani.history.local` | Solo sin API configurada |

**Modos** (`Storage.getMode()`):

| Modo | Cuándo | Historial que se ve |
|---|---|---|
| `remote` | API configurada y sesión vigente | El de la cuenta, más lo pendiente de este navegador |
| `guest` | API configurada, sin sesión | Solo lo pendiente de este navegador |
| `local` | `config.js` vacío | `exani.history.local` |

**Cola.** Cada intento terminado entra en `exani.pending` con su dueño (`sub` de Google, o
`null` si no había sesión) y se intenta subir de inmediato. Se reintenta en cada carga y
al iniciar sesión. Los intentos anónimos se suben a la primera cuenta que inicie sesión;
los que tienen dueño, solo a la suya. Un intento sale de la cola únicamente cuando el
servidor confirma que lo guardó.

**Carga anticipada.** Si la sesión sigue vigente, la bienvenida lee el historial y lo deja
en `exani.cache` (no muestra nada de Google: renovar una sesión vencida lo hace el panel). El panel
se pinta al instante con esa caché y la actualiza en segundo plano («Actualizando tu
historial…»). Sin caché, muestra «Cargando tus exámenes…» hasta que responde el servidor.
Si un script no llega o la carga pasa de 20 s, ofrece **Reintentar**.

---

## 5. Publicación

Cada push a `main` ejecuta `.github/workflows/pages.yml`:

1. Valida los exámenes (`tools/validate-exams.js`).
2. Prueba la API (`apps-script/test.js`).
3. Copia `web/` sin `server.py` ni historiales locales.
4. Sustituye `__BUILD__` por el commit en las URL de JS y CSS (`app.js?v=7c9d005`). GitHub
   Pages guarda los archivos 10 minutos en caché; sin esto, alguien podría recibir HTML
   nuevo con JS viejo justo después de publicar.
5. Publica en GitHub Pages.

La URL anterior (`ycaceres.github.io/exani`) dejó de funcionar al transferir el repo.

---

## 6. Desarrollo local

```bash
cd web
python3 server.py              # http://localhost:8080
```

- `server.py` solo sirve archivos, sin caché, con una cola de 128 conexiones. Con la
  cola por defecto de Python (5), el navegador veía conexiones rechazadas y el panel se
  quedaba en «Cargando…».
- Iniciar sesión solo funciona en orígenes autorizados: `http://localhost:8080` y
  `http://localhost`. Otro puerto no podrá iniciar sesión.
- En local se usa la API y la hoja reales.
- Con `js/config.js` vacío, la app funciona en modo local y guarda todo en el navegador.

---

## 7. Herramientas

| Comando | Qué hace |
|---|---|
| `node tools/validate-exams.js` | Valida todo el catálogo con `grading.js` |
| `python3 -I tools/exam-builder/build.py tools/exam-builder/exams/n6.py [--write]` | Genera un examen de nivel N1 desde su fuente ([datos.md](datos.md) §5) |
| `node apps-script/test.js` | Pruebas de `Code.gs` con SpreadsheetApp, CacheService y demás simulados |
| `node tools/import-history.js <archivo.json> <correo> [--dry-run]` | Carga intentos antiguos para un correo (acción `import`). Idempotente |

---

## 8. Puesta en marcha desde cero

Solo hace falta si se rehace la infraestructura.

**Cliente OAuth (Google Cloud → Google Auth Platform)**

1. Información de la marca: nombre «Acierta», correo de asistencia, página principal y
   política de privacidad. Solo alcances básicos (`openid`, `email`, `profile`).
2. Público: *External* y **Publicar app**. En modo *Testing* solo entran los usuarios de
   prueba.
3. Clientes → Crear cliente → Aplicación web. Orígenes autorizados:
   `https://bytecollage.github.io`, `http://localhost:8080`, `http://localhost`. Sin URIs de
   redireccionamiento.

**Apps Script**

1. En la hoja: Extensiones → Apps Script. Pegar `Code.gs` y crear `Config.gs`.
2. Implementar → Nueva implementación → Aplicación web, *Ejecutar como: Yo*, *Cualquier
   usuario*. Autorizar los permisos de hojas de cálculo y servicios externos.
3. Poner la URL `/exec` y el client ID en `web/js/config.js`.

**Seguridad de la hoja.** Debe estar compartida como **Restringido**. El script corre con
la cuenta del dueño y no necesita que la hoja sea pública.
