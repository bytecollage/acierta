# 03 — Pantallas y flujo

> **Actualizado por D-12 (2026-11-19).** La bienvenida y el panel con pestañas sustituyen
> a la pantalla de inicio con la lista de exámenes y al `dashboard.html` independiente. Este
> apartado describe el flujo vigente; las secciones 1 a 4 se conservan como detalle de cada
> pantalla, y donde contradigan esto, manda esto.

| Página | Contenido |
|---|---|
| `index.html` | **Bienvenida**: título «Exámenes diagnósticos», inicio de sesión, cuadro «Antes de empezar» y botón **CONTINUAR** |
| `panel.html` | **Panel** con tres pestañas, más las pantallas de examen y resultados |
| `dashboard.html` | Solo redirige a `panel.html#progreso`, para no romper enlaces viejos |

Pestañas del panel:

| Pestaña | Muestra |
|---|---|
| **EXÁMENES** | Exámenes sin ningún intento terminado: *Comenzar*, o *Continuar* / *Comenzar de nuevo* si hay uno a medias |
| **COMPLETADOS** | Exámenes con al menos un intento en el historial, el más reciente primero: último resultado, número de intentos, mejor resultado; *Ver resultados* y *Volver a intentarlo* (o *Continuar intento*) |
| **MI PROGRESO** | El dashboard (`07-dashboard.md`) |

**Navegación por hash**, para que el botón «atrás» del móvil funcione y cada vista tenga
URL propia: `#examenes`, `#completados`, `#progreso`, `#examen/<id>`, `#resultados/<id>`.
Salir del examen (atrás, «← Mis exámenes» o una pestaña) guarda el intento y detiene el
cronómetro; queda para *Continuar*. Recargar `#examen/<id>` sin intento guardado lleva a
EXÁMENES en lugar de crear uno.

```text
┌────────────┐ CONTINUAR ┌──────────────────────────────────┐
│ BIENVENIDA │ ────────▶ │ PANEL                            │
└────────────┘           │ [EXÁMENES][COMPLETADOS][PROGRESO]│
                         └──────┬───────────────▲───────────┘
                        Comenzar│               │atrás / Volver
                         ┌──────▼───┐ Terminar ┌┴───────────┐
                         │  EXAMEN  │ ───────▶ │ RESULTADOS │
                         └──────────┘          └────────────┘
```

**Móvil.** Pestañas fijas arriba al desplazarse, objetivos táctiles de 44 px o más, sin
desplazamiento horizontal desde 320 px, áreas del examen en una fila deslizable, columnas
secundarias de las tablas ocultas en pantallas estrechas, márgenes de *safe area* (iPhone)
y manifiesto web con íconos para añadir la app a la pantalla de inicio.

---

## 1. Pantalla de INICIO

Es la primera que ve el estudiante al abrir la aplicación. **DEBE** mostrarse siempre
antes del examen, incluso si hay un solo examen disponible.

### 1.1 Contenido

**a) Encabezado**

Título de la aplicación y una frase de contexto.

**b) Instrucciones para el examinado**

Bloque de texto legible, no un modal. DEBE explicar al menos:

- Que es un examen **diagnóstico**: sirve para detectar qué estudiar, no para aprobar ni
  reprobar.
- Que hay que responder **todas** las preguntas; no se puede terminar con pendientes.
- Que cada pregunta tiene **tres opciones** y solo una es correcta.
- Que **no hay límite de tiempo**, pero **el tiempo se mide** y forma parte del resultado.
- Que el progreso **se guarda automáticamente**: puede cerrar y continuar después.
- Que al terminar verá la corrección, el resultado por área y por tema, y una cadena de
  respuestas que puede copiar.
- Recomendación de hacerlo de una sentada y sin consultar material, para que el
  diagnóstico sea útil.

**c) Selector de examen**

Una tarjeta por cada entrada de `exams.json`, con:

- título;
- número de preguntas;
- áreas que cubre y cuántas preguntas tiene cada una;
- duración estimada, si `estimatedMinutes` existe;
- botón **Comenzar**.

Si existe un intento sin terminar para ese examen, la tarjeta DEBE indicarlo y ofrecer
**Continuar** y **Comenzar de nuevo** en lugar de *Comenzar* (ver `08-persistencia.md`).

Si existe un intento **ya corregido**, la tarjeta DEBE ofrecer **Ver resultados** y
**Comenzar de nuevo**.

**d) Acceso al dashboard**

Enlace visible a `dashboard.html`. Si no hay ningún intento en el historial, el enlace
DEBERÍA mostrarse deshabilitado con el texto *"Aún no hay intentos registrados"*.

### 1.2 Comportamiento

- El botón **Comenzar** arranca el cronómetro (ver `05-tiempo-y-cadena.md`) y pasa a la
  pantalla de examen.
- Las áreas y el conteo se leen de `exams.json`; el examen completo se descarga al pulsar
  *Comenzar*, no antes.

---

## 2. Pantalla de EXAMEN

Todas las preguntas en una sola página, agrupadas por área, en el orden de `exam.areas`.
Detalle completo en `04-examen-y-correccion.md`.

Elementos permanentes:

- barra de progreso y contador `Respondidas: 42 / 80`;
- navegación rápida por áreas (sticky en escritorio);
- **cronómetro visible** con el tiempo transcurrido;
- botón **Terminar** al final del examen.

---

## 3. Pantalla de RESULTADOS

Se muestra únicamente después de una corrección válida. Contenido en `06-resultados.md`.

Incluye la corrección visual del examen completo, el resultado global, por área y por tema,
la cadena compacta, los botones de copiado y el acceso a **Reiniciar examen** y
**Ver dashboard**.

---

## 4. Pantalla de DASHBOARD

Archivo aparte: `dashboard.html`. No necesita que haya un examen cargado; se alimenta
exclusivamente del historial en `localStorage`. Detalle en `07-dashboard.md`.

DEBE poder abrirse directamente por URL y funcionar sin haber pasado por el examen en esa
sesión.

---

## 5. Reglas de navegación

| Situación | Comportamiento |
|---|---|
| Recarga durante el examen | Restaurar respuestas, progreso y tiempo acumulado; seguir en la pantalla de examen |
| Recarga tras corregir | Restaurar la pantalla de resultados corregida |
| Pulsar *Volver al inicio* durante el examen | Permitido; el intento queda guardado sin terminar. Pedir confirmación |
| Pulsar *Comenzar de nuevo* | Confirmación explícita. Borra el intento en curso, **no** el historial |
| Abrir `dashboard.html` sin historial | Estado vacío explicativo, no un error |

## 6. Estado en memoria

```js
const state = {
  catalog: [],          // exams.json
  exam: null,           // objeto exam
  stimuli: [],          // textos compartidos
  questions: [],
  selectedAnswers: {},  // { [questionId]: "A" | "B" | "C" }
  answerKey: null,      // null hasta pulsar Terminar
  startedAt: null,      // ISO-8601
  activeMs: 0,          // tiempo activo acumulado
  lastTickAt: null,     // marca del segmento en curso
  completed: false,
  completedAt: null,
  result: null
};
```
