# 10 — Decisiones y riesgos

Registro de lo acordado y de los hallazgos del análisis de los datos. Cada decisión indica
su motivo, para que dentro de seis meses se entienda por qué está así.

---

## Decisiones tomadas

### D-01 · Textos de lectura como estímulos independientes — **ACORDADO**

**Problema.** Los pasajes de comprensión lectora estaban incrustados dentro del `text` de
la primera pregunta de cada bloque. 38 de 180 preguntas dependían de un texto que no les
pertenecía: la pregunta 17 dice *"Según el texto anterior…"* y su enunciado no lo contiene.

**Consecuencias detectadas:** en móvil obligaba a subir 3-4 preguntas para releer; hacía
**imposible** la aleatorización que la spec original pedía dejar preparada; y contaminaba el
análisis por tema (un pasaje de 626 caracteres contaba como enunciado de la pregunta 16).

**Decisión.** Extraer los textos a un array `stimuli` y referenciarlos con `stimulusId`.
Detalle en `02-modelo-de-datos.md`.

**Riesgo asumido.** Cambia el formato de `questions.json` respecto al documento original.
Mitigado por: la extracción es mecánica (los 9 casos siguen el patrón
`"Lee el texto:\n\n<PASAJE>\n\n<PREGUNTA>"`) y no hay intentos guardados que migrar.

---

### D-02 · Sesgo de la clave de respuestas — **ACORDADO NO CORREGIRLO**

**Hallazgo.** La clave está fuertemente desbalanceada:

| Examen | A | B | C | Todo "A" | Todo "B" | Todo "C" |
|---|---|---|---|---|---|---|
| diagnóstico-1 (80) | 39 | 33 | 8 | **49%** | 41% | 10% |
| diagnóstico-2 (100) | 47 | 49 | 4 | 47% | **49%** | 4% |

Además:

- En **Redacción indirecta** e **Inglés**, la opción C no es correcta **ni una sola vez** en
  ninguno de los dos exámenes.
- En **Pensamiento matemático** del diagnóstico-2, B es correcta 18 de 25 veces.
- Hay una racha de **9 letras iguales consecutivas** en diagnóstico-2.
- En diagnóstico-2, la correcta es la opción **más larga** el 50% de las veces (azar: 33%).

**Decisión.** No rebalancear. Se asume el sesgo.

**Riesgo asumido y su mitigación obligatoria.** Un estudiante puede sacar ~49% sin leer
nada. Como la aplicación no puede corregir el dato, **debe hacerlo visible**:

1. El resultado muestra la línea base de azar real (`06-resultados.md`, 1.1).
2. El dashboard dibuja esa línea en la gráfica de evolución (`07-dashboard.md`, 7).
3. El resumen copiable incluye una nota para el agente de IA (`05-tiempo-y-cadena.md`, 3.2).

Sin estas tres, un 48% se interpreta como «casi la mitad» cuando en realidad está al nivel
de marcar siempre la misma letra. **No son opcionales.**

---

### D-03 · `exams.json` gana `title` y `questionCount` — **ACORDADO**

El catálogo actual solo tiene `id`, `questions` y `answers`. La pantalla de inicio necesita
título y número de preguntas, y descargar los exámenes completos solo para pintar el
selector es desproporcionado.

**Riesgo:** duplicación de datos y desincronización. **Mitigación:** la validación de
arranque compara catálogo y archivo real y falla si no coinciden.

---

### D-04 · Medición de tiempo activo, no de reloj — **ACORDADO**

Se mide tiempo activo con pausa por pestaña oculta y por 5 minutos de inactividad.

**Motivo.** Si el estudiante empieza, cierra el portátil y retoma al día siguiente, el reloj
de pared diría 1.440 minutos y envenenaría el dashboard. Se guardan **ambos** valores
(`activeMs` y `elapsedWallMs`) para poder detectar intentos partidos.

---

### D-05 · Intento corregido se restaura al recargar — **ACORDADO**

La spec original solo definía qué hacer con un intento *incompleto*. Se añade: si el intento
guardado está corregido, se restaura la pantalla de resultados.

---

### D-06 · `Reiniciar examen` no borra el historial — **ACORDADO**

Borra el intento en curso. El historial solo se borra mediante acción explícita desde el
dashboard, con confirmación.

---

### D-07 · Los datos se mueven a `data/` — **ACORDADO**

Hoy están en `app_idea/`. La estructura objetivo usa `data/`, y las rutas de `exams.json`
son relativas a esa carpeta.

---

### D-08 · El tema no se muestra durante el examen — **ACORDADO**

La etiqueta `topic` («Tema: Método científico») funcionaba como pista: acota de qué trata
la pregunta antes de leer las opciones, y en un diagnóstico eso contamina la medición.

**Decisión.** El tema no se renderiza durante el intento y **ni siquiera está en el DOM**.
Se inyecta al corregir, donde sí cumple su función pedagógica: señalar qué concepto falló.

Las **áreas** sí se siguen mostrando (navegación y cabeceras). Un área como «Pensamiento
matemático» es una división estructural del examen, no una pista sobre el reactivo
concreto, y los exámenes reales del EXANI también están organizados por área.

---

### D-09 · El historial pasa a un archivo del proyecto — **SUSTITUIDA POR D-11**

**Problema.** `localStorage` va por origen: `localhost:8000` y `localhost:5500` son
almacenes distintos, así que cambiar de puerto equivale a perder el historial. Tampoco se
comparte entre navegadores ni equipos, no está en git y desaparece al limpiar datos de
navegación. Para un historial que debe acumularse durante meses, es frágil.

**Decisión.** Añadir `server.py` (solo librería estándar) que sirve la aplicación y expone
`GET/POST/DELETE /api/history`, persistiendo en **`data/historial.json`**. El archivo se
versiona en git y se puede editar a mano.

El **intento en curso** sigue en `localStorage`: es efímero y por dispositivo, y llevarlo
al servidor obligaría a un viaje de red por cada respuesta sin aportar nada.

**Respaldo obligatorio.** Si la API no responde, la aplicación cae a `localStorage` y el
dashboard indica dónde está guardando. Así no se rompe si alguien la sirve de otra forma.

**Riesgo asumido.** La aplicación deja de ser 100% estática y **ya no se puede publicar en
GitHub Pages conservando resultados**: allí funcionaría en modo respaldo. Se acepta a
cambio de no perder el historial, que era el objetivo principal del dashboard.

**Lección (2026-10-21).** Entre el 18 de septiembre y el 21 de octubre, la app se sirvió con
`python3 -m http.server` en lugar de `server.py`. Los intentos de los diagnósticos 2 a 5
quedaron solo en `localStorage` y hubo que pasarlos a mano a `data/historial.json`. Hay que
arrancar siempre con `python3 server.py`.

---

### D-10 · Exámenes de nivel 6 a 10 con la estructura oficial — **ACORDADO**

**Motivo.** Con 96 % en tres diagnósticos seguidos, los niveles 1 a 5 ya no distinguían
qué falta por aprender.

**Decisión.** Se añaden cinco exámenes de 150 reactivos, cada uno más difícil que el
anterior. Siguen la proporción de la guía oficial (`12-guia-oficial-exani-i.md`):
PC 28 · CL 28 · RI 28 · PM 38 · Inglés 28.

- Cada pregunta trae `subarea`, con las subáreas oficiales. En Comprensión lectora es el
  proceso (identificación, interpretación, evaluación); en Redacción indirecta, el
  aspecto (comunicativo, gramatical y semántico, ortográfico).
- La clave está equilibrada (50/50/50), sin rachas de más de 3 letras iguales y repartida
  dentro de cada área.
- Las respuestas numéricas se comprueban al generar el examen.
- Se revisó que la respuesta correcta no sea, de forma sistemática, la opción más larga.
- Se generan con `tools/exam-builder/`: hay una fuente por examen, y `build.py` valida y
  escribe los JSON. `validate.js` aplica el mismo `grading.js` que la app.

**Riesgo asumido.** Las preguntas las redactó un modelo de IA. La clave numérica está
comprobada por código, pero las respuestas conceptuales y de lectura no han tenido
revisión humana. Si algún resultado parece injusto, hay que revisar primero la pregunta.

---

### D-11 · App pública en GitHub Pages con historial en Google Sheets — **ACORDADO**

**Motivo.** La app se publica en la web para que la usen varios estudiantes. GitHub Pages
solo sirve archivos estáticos, así que la API de `server.py` (D-09) deja de servir.

**Decisión.**

- **Hosting.** GitHub Pages, repo público `bytecollage/acierta` (antes `ycaceres/exani`, transferido el 2026-11-19). El workflow
  `.github/workflows/pages.yml` valida los exámenes, prueba el Apps Script y publica `web/`.
- **Base de datos.** Un Google Spreadsheet detrás de un Apps Script publicado como
  aplicación web (`apps-script/`). La API pública solo permite `list` y `create`: **no hay
  edición ni borrado**. El botón "Borrar historial" desaparece del dashboard.
- **Identidad.** Inicio de sesión con Google (Google Identity Services). El Apps Script
  verifica el ID token y guarda al estudiante como `SHA-256(PEPPER + ":" + sub)`; la hoja
  no contiene correos ni nombres. Se pueden añadir otros proveedores más adelante sin
  cambiar el modelo, porque el identificador es opaco.
- **Sin pérdida de intentos.** Cada intento terminado entra primero en una cola local
  (`exani.pending`) y se sube desde ahí. Sin sesión, con la sesión vencida (el ID token
  dura una hora y un examen puede durar más) o sin red, queda en la cola y se sube
  después.
- **Claves públicas.** `answers.json` es público. Se acepta: es una herramienta de estudio
  y cada quien decide cómo usarla.
- **`server.py`** queda como servidor estático para desarrollo, en el puerto 8080, que
  está registrado como origen autorizado del client ID.
- **Migración.** Los intentos de `data/historial.json` se cargan con
  `tools/import-history.js`, reservados para el correo del estudiante, y pasan a su cuenta
  en su primer inicio de sesión. `historial.json` deja de versionarse.

**Riesgos asumidos.**

- El límite de 20 intentos por examen (`08-persistencia.md` §3.2) desaparece porque
  implicaba borrar. Lo sustituye un tope de 200 por examen y estudiante, y un límite de
  30 envíos cada 10 minutos.
- Cualquier cuenta de Google puede escribir sus propios intentos. Nadie puede leer ni
  escribir los de otro estudiante.
- Latencia de 0,5 a 2 s por llamada al Apps Script, que se nota al abrir la app.
- El intento en curso sigue siendo por navegador y no por cuenta. Dos estudiantes que
  compartan navegador comparten intentos sin terminar.

---

### D-12 · Bienvenida + panel con pestañas, y uso en móvil — **ACORDADO**

**Decisión.**

- El título pasa a **«Exámenes diagnósticos»**, sin UADY ni EXANI.
- `index.html` queda como bienvenida, con el cuadro de instrucciones y el botón
  **CONTINUAR**.
- `panel.html` reúne las pestañas EXÁMENES, COMPLETADOS y MI PROGRESO, más el examen y los
  resultados. Navega por hash. Detalle en `03-pantallas-y-flujo.md`.
- Se añaden ajustes para móvil y un manifiesto web (`manifest.webmanifest`, `icons/`) para
  instalar la app en la pantalla de inicio.

**Riesgo asumido.** No hay *service worker*, así que la app no funciona sin conexión. Se
evita a propósito: una caché desactualizada podría servir exámenes o claves viejas.

**Nombre (2026-11-19).** La app se llama **Acierta** (nombre en el celular, pestaña del navegador y bienvenida); «Exámenes diagnósticos» queda como subtítulo. No se revisó si el nombre está registrado como marca.

**Ícono (2026-11-19).** Hoja de respuestas: tres círculos (A, B, C) con el del centro relleno
en verde y palomeado, sobre fondo verde claro. Fuente en `web/icons/icon.svg`; los PNG
(192, 512, 512 *maskable* con el dibujo al 80 % para la zona segura de Android, y 180 para
iOS) se generan desde ese dibujo con `sips` de macOS.

**Nombres de examen (2026-11-19).** Los exámenes se nombran «Examen Diagnóstico N<n>E<ee>»
(nivel y número de examen): los diagnósticos 1–5 son N0E01–N0E05 y los 6–10, N1E01–N1E05.
El `id` (`diagnostico-N`) no cambia, porque identifica los intentos en la hoja y en
`localStorage`. Los títulos de la hoja se migraron una vez desde el `examId`, y el dashboard
muestra siempre el título del catálogo, así que un cambio de nombre futuro no necesita
migración.

---

## Riesgos abiertos

### R-01 · La granularidad de `topic` no soporta el análisis por tema — **ABIERTO**

**Este es el riesgo más serio para el objetivo del dashboard.**

| | diagnóstico-1 | diagnóstico-2 |
|---|---|---|
| Preguntas | 80 | 100 |
| Temas distintos | 63 | 83 |
| Media preguntas/tema | 1.27 | 1.20 |
| Temas con **1 sola** pregunta | 51 (81%) | 69 (83%) |
| Temas con ≥ 3 preguntas | 3 | 3 |
| Preguntas que son el único caso de su tema | 51 (64%) | 69 (69%) |

Un `0/1 — 0%` no distingue una laguna real de un descuido. Con n=1 no hay señal.

**Mitigación aplicada en v1:** el dashboard agrega temas **cruzando los dos exámenes**
(comparten 39 temas), muestra siempre el conteo absoluto, etiqueta la confianza por número
de observaciones y **solo recomienda estudiar** temas con ≥ 3 observaciones y < 60% de
acierto (`07-dashboard.md`, 5).

**Solución de fondo, no acordada:** añadir un nivel intermedio `subarea` entre `area` y
`topic`. Unas 15-20 subáreas (*Álgebra*, *Estadística*, *Geometría*, *Ortografía*,
*Sintaxis*, *Gramática inglesa*…) darían 5-8 preguntas cada una y serían directamente
accionables. El campo ya está previsto como opcional en `02-modelo-de-datos.md`, pero
**nadie ha etiquetado las 180 preguntas**. Hasta que se haga, el análisis por tema seguirá
siendo más ruidoso de lo deseable.

---

### R-02 · Repetir el mismo examen mide memoria — **MITIGADO, NO RESUELTO**

Sin aleatorización y con solo dos exámenes fijos, el segundo intento del mismo examen
refleja en parte memorización. Una curva de mejora construida sobre repeticiones sube sola.

**Mitigación:** el dashboard separa primeros intentos de repeticiones, usa solo los primeros
para recomendar temas y avisa al incluir repeticiones (`07-dashboard.md`, 6.1).

**Solución de fondo:** más exámenes, o aleatorización con banco de preguntas. Ambas están
fuera del alcance de v1.

---

### R-03 · Solo hay dos exámenes — **ACEPTADO**

Con 180 preguntas en total y sin banco, el techo de información es bajo. El diseño mitiga lo
que puede (añadir un examen solo requiere JSON nuevos), pero la utilidad del dashboard crece
mucho con el tercer y cuarto examen.

---

### R-04 · Enunciados genéricos repetidos — **MENOR, ABIERTO**

Siete preguntas comparten enunciados sin contexto propio:

- `diagnóstico-1`: ids 31, 32, 33, 34 (*"Selecciona la opción escrita correctamente:"*) y
  40, 44 (*"Selecciona la opción correcta:"*).
- `diagnóstico-2`: ids 46, 51, 57 (*"Selecciona la opción correcta:"*).

Las opciones sí son distintas, así que **no son duplicados reales** y no afectan a la
corrección. Pero el enunciado no aporta información y dificulta identificar la pregunta en
el detalle por tema. Se podría mejorar la redacción; no bloquea nada.

---

### R-05 · La clave es pública — **ACEPTADO POR DISEÑO**

La aplicación es estática: cualquiera con DevTools puede leer `answers.json`. No se intenta
ocultar. La carga tardía es una comodidad, no una medida de seguridad. Si en algún momento
el examen tuviera valor sumativo, este diseño dejaría de servir y haría falta un backend.

---

## Historial de la especificación

| Versión | Fecha | Cambio |
|---|---|---|
| 1.5 | 2026-11-19 | D-12: bienvenida + panel con pestañas (Exámenes, Completados, Mi progreso) y ajustes para móvil |
| 1.4 | 2026-11-19 | D-11: app pública en GitHub Pages, historial en Google Sheets con inicio de sesión de Google |
| 1.3 | 2026-10-21 | D-10: exámenes de nivel 6 a 10 (150 reactivos, `subarea`); guía oficial en `12-guia-oficial-exani-i.md` |
| 1.2 | 2026-09-17 | D-09: el historial pasa de localStorage a data/historial.json con server.py |
| 1.1 | 2026-09-17 | D-08: el tema deja de mostrarse durante el examen |
| 1.0 | 2026-09-17 | Primera versión consolidada. Sustituye a `app_idea/AGENT_IMPLEMENTATION_INSTRUCTIONS.md`. Añade pantalla de inicio, medición de tiempo, cadena con minutos, dashboard y modelo de estímulos |
