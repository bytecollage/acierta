# 03 — Pantallas y flujo

La aplicación tiene **cuatro pantallas**. Las tres primeras viven en `index.html` y se
alternan mostrando/ocultando secciones. El dashboard vive en `dashboard.html`.

```text
┌─────────────┐  Comenzar   ┌─────────┐  Terminar   ┌────────────┐
│   INICIO    │ ──────────▶ │  EXAMEN │ ──────────▶ │ RESULTADOS │
│ instruccio- │             │         │  (solo si   │            │
│ nes + lista │ ◀────────── │         │   está      │            │
└─────────────┘  Volver     └─────────┘   completo) └────────────┘
       │                                                   │
       │                  ┌───────────┐                    │
       └─────────────────▶│ DASHBOARD │◀───────────────────┘
                          └───────────┘
```

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
