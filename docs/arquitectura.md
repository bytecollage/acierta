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
| `js/main.js` | Entrada de `panel.html`: carga catálogo e historial, conecta la sesión y decide qué pantalla abre cada ruta |
| `js/router.js` | Rutas por hash: `parseRoute()` (pura), `go()`, `replace()`, `redirect()` (D-16) |
| `js/screens/panel.js` | Pestañas, aviso de la cuenta, aviso de sincronización y listas de exámenes |
| `js/screens/exam.js` | Examen y corrección: preguntas, avance, cronómetro visible, «Terminar», ↻ |
| `js/screens/results.js` | Resultado: tarjeta con ↻ y «Ver detalles», áreas y cadena de respuestas |
| `js/screens/progress.js` | Pestaña «Mi progreso» |
| `js/screens/report.js` | «Reporte detallado» con sus filtros |
| `js/services/exam-session.js` | El intento abierto: abrir, responder, cronómetro con pausa, guardar y terminar. Sin DOM |
| `js/ui/appbar.js` | Qué pantalla se ve, barra fija (← y título) y pie |
| `js/ui/feedback.js` | Espera bloqueante, aviso breve, confirmación, copiar y error fatal |
| `js/ui/charts.js` | Gráficas de línea SVG propias, dibujadas al ancho real; tabla equivalente opcional |
| `js/ui/hbars.js`, `rows.js`, `icons.js`, `dom.js` | Barras por área, resumen de resultado, íconos, `$`/`esc`/fechas |
| `js/data/catalog.js` | Carga y valida `data/*.json` (catálogo en caché); `gradeAttempt()` carga la clave y corrige |
| `js/data/storage.js` | Historial (API + cola + caché) e intento en curso. Migra los ids anteriores al primer `init()` |
| `js/data/auth.js` | Inicio de sesión con Google Identity Services; guarda el ID token y el nombre |
| `js/domain/grading.js` | Validación de catálogo, examen y clave, y corrección. También lo usan `tools/validate-exams.js` y `tests/` |
| `js/domain/answer-string.js` | Armar y leer la cadena de respuestas (formato actual y anterior) |
| `js/domain/attempt.js` | Rehacer un intento desde el historial, el registro que se envía a la API, clasificar exámenes |
| `js/domain/stats.js` | Puntuación, indicadores, áreas, temas (confianza, tendencia, débiles) y líneas de azar, con sus umbrales |
| `js/domain/ids.js` | Ids anteriores → actuales (D-14); la misma regla que `canonExamId` de `Code.gs` |
| `js/domain/errors.js` | `DataError`: mensaje para el estudiante y detalle técnico |
| `js/package.json` | Solo `{"type":"module"}`, para que Node lea los `.js` como módulos. No se publica |

Los scripts son **módulos ES nativos**, sin bundler (D-15). Cada página carga una sola entrada
(`panel.html` → `main.js`; `index.html` → un módulo en línea que importa `data/storage.js`) y el
resto llega por `import`. Las dependencias van en un solo sentido:

```text
main.js ── router.js
   │
   ├─ screens/  panel · exam · results · progress · report      (HTML de cada pantalla)
   │     │
   │     ├─ ui/        appbar · feedback · charts · hbars · rows · icons · dom
   │     └─ services/  exam-session                             (intento abierto, sin DOM)
   │              │
   └──────────────┴─ data/   catalog · storage · auth            (archivos, red, localStorage)
                        │
                        └─ domain/  grading · answer-string · attempt · stats · ids · errors
```

**Capas.** `domain/` es lógica pura: no usa `document`, `window`, `localStorage` ni `fetch`, y
solo importa de `domain/`; `tests/modules.test.js` vigila la regla. `services/` y `data/` no
tocan el DOM, así que también se prueban en Node (`tests/exam-session.test.js`). `router.js` no
conoce las pantallas: `main.js` decide qué abrir para cada ruta, y cada pantalla toca solo su
sección de `panel.html`.

**Todo `import` relativo lleva `?v=__BUILD__`** (`from "./storage.js?v=__BUILD__"`); la prueba
`tests/modules.test.js` lo exige. Si un módulo se importara con dos URL distintas, el navegador
cargaría dos copias con estado separado (por ejemplo, dos historiales).
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

**Mantenimiento.** Funciones que se ejecutan a mano desde el editor (seleccionar la función
y pulsar *Ejecutar*); el resultado queda en el registro de ejecución:

| Función | Para qué |
|---|---|
| `migrateExamIds()` | Pasa las filas con el id anterior (`diagnostico-7`, «Examen Diagnóstico N1E02») a `N1E02` / «Examen N1E02». Idempotente; una vez basta (D-14) |

---

## 4. Almacenamiento en el navegador (`js/data/storage.js`)

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

Si la sesión cambia mientras esa actualización está en camino (por ejemplo, el estudiante
cierra sesión en los primeros segundos), la respuesta que llega tarde se descarta: cada
`Storage.init()` abre una generación nueva y solo se aplica la lectura de la generación vigente.

---

## 5. Publicación

Cada push a `main` ejecuta `.github/workflows/pages.yml`:

1. Valida los exámenes (`tools/validate-exams.js`).
2. Prueba el código del navegador (`node --test tests/*.test.js`).
3. Prueba la API (`apps-script/test.js`).
4. Copia `web/` sin `server.py` ni historiales locales.
5. Sustituye `__BUILD__` por el commit en las URL de JS y CSS (`app.js?v=7c9d005`), en los HTML
   y dentro de los JS (los `import`). GitHub
   Pages guarda los archivos 10 minutos en caché; sin esto, alguien podría recibir HTML
   nuevo con JS viejo justo después de publicar.
6. Publica en GitHub Pages.

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
- Abrir los HTML con doble clic (`file://`) no funciona: los módulos ES y `fetch()` necesitan
  un servidor HTTP.

---

## 7. Herramientas

| Comando | Qué hace |
|---|---|
| `node tools/validate-exams.js` | Valida todo el catálogo con `domain/grading.js` |
| `python3 -I tools/exam-builder/build.py tools/exam-builder/exams/n6.py [--write]` | Genera un examen de nivel N1 desde su fuente ([datos.md](datos.md) §5) |
| `node --test tests/*.test.js` | Pruebas del código del navegador sin navegador: `domain/*`, migración de `storage.js` y reglas de los módulos |
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
