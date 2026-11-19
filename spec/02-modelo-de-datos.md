# 02 — Modelo de datos

Todos los archivos son JSON, codificados en UTF-8, servidos desde `data/`.

> **Cambio de versión.** El formato de `questions.json` cambia respecto a los datos
> actuales para soportar textos de lectura compartidos. Los archivos pasan a **versión
> `2.0`**. Como todavía no existen intentos guardados en ningún navegador, la migración no
> tiene coste: no hay datos de usuario que preservar.

---

## 1. `data/exams.json`

Catálogo de exámenes disponibles. Es lo único que la pantalla de inicio necesita leer para
pintar el selector, **sin descargar los exámenes completos**.

```json
[
  {
    "id": "diagnostico-1",
    "title": "Diagnóstico UADY / EXANI-I — Nivel 1",
    "version": "2.0",
    "questionCount": 80,
    "estimatedMinutes": 60,
    "questions": "diagnostico-1/questions.json",
    "answers": "diagnostico-1/answers.json"
  }
]
```

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí | Único. Se usa en las claves de `localStorage` |
| `title` | string | sí | Se muestra en el selector y en el dashboard |
| `version` | string | sí | DEBE coincidir con `exam.version` del archivo de preguntas |
| `questionCount` | number | sí | DEBE coincidir con el número real de preguntas |
| `estimatedMinutes` | number | no | Orientativo, se muestra en las instrucciones |
| `questions` | string | sí | Ruta relativa a `data/` |
| `answers` | string | sí | Ruta relativa a `data/` |

**Motivo del cambio:** el archivo actual solo tiene `id`, `questions` y `answers`. La
pantalla de inicio necesita título y número de preguntas, y descargar los dos exámenes
completos solo para pintar el selector es desproporcionado.

Duplicar `title`, `version` y `questionCount` aquí crea riesgo de desincronización; por eso
la validación de arranque (sección 5) DEBE comprobar que coinciden con el archivo real.

---

## 2. `data/<examId>/questions.json`

```json
{
  "exam": {
    "id": "diagnostico-1",
    "title": "Diagnóstico UADY / EXANI-I — Nivel 1",
    "version": "2.0",
    "questionCount": 80,
    "areas": [
      { "name": "Pensamiento científico", "start": 1,  "end": 15 },
      { "name": "Comprensión lectora",    "start": 16, "end": 30 },
      { "name": "Redacción indirecta",    "start": 31, "end": 45 },
      { "name": "Pensamiento matemático", "start": 46, "end": 65 },
      { "name": "Inglés",                 "start": 66, "end": 80 }
    ]
  },
  "stimuli": [
    {
      "id": "cl-1",
      "area": "Comprensión lectora",
      "instruction": "Lee el texto:",
      "text": "Durante muchos años se pensó que estudiar durante varias horas consecutivas…"
    }
  ],
  "questions": [
    {
      "id": 16,
      "area": "Comprensión lectora",
      "topic": "Idea principal",
      "stimulusId": "cl-1",
      "text": "¿Cuál es la idea principal?",
      "options": { "A": "…", "B": "…", "C": "…" }
    }
  ]
}
```

### 2.1 Objeto `exam`

| Campo | Tipo | Obligatorio |
|---|---|---|
| `id` | string | sí |
| `title` | string | sí |
| `version` | string | sí |
| `questionCount` | number | sí |
| `areas` | array | sí |

Cada área: `name` (string), `start` (number), `end` (number). Los rangos DEBEN ser
contiguos, no solaparse y cubrir todas las preguntas. El orden del array define el orden de
presentación.

### 2.2 Objeto `stimuli` — **nuevo**

Array de textos compartidos por varias preguntas. PUEDE estar vacío o ausente en exámenes
que no los necesiten.

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | sí | Único dentro del examen |
| `area` | string | sí | DEBE existir en `exam.areas` |
| `instruction` | string | no | Encabezado corto: `"Lee el texto:"`, `"Read the text:"` |
| `text` | string | sí | El pasaje completo, sin la pregunta |

### 2.3 Objeto `questions`

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | number | sí | Entero, único, consecutivo desde 1 |
| `area` | string | sí | DEBE existir en `exam.areas` |
| `topic` | string | sí | Etiqueta fina de concepto |
| `subarea` | string | no | **Recomendado a futuro.** Nivel intermedio entre área y tema. Ver `10-decisiones-y-riesgos.md` |
| `stimulusId` | string | no | Si existe, DEBE referenciar un `stimuli[].id` |
| `text` | string | sí | Solo la pregunta. Nunca el pasaje |
| `options` | object | sí | Exactamente las claves `A`, `B`, `C`, ninguna vacía |

---

## 3. Migración de los datos actuales

Los textos de lectura están hoy incrustados dentro del `text` de la primera pregunta de
cada bloque, con este patrón exacto, verificado en **los 9 casos**:

```text
"Lee el texto:\n\n<PASAJE>\n\n<PREGUNTA REAL>"
```

Como los tres bloques van separados por línea en blanco, **la extracción es mecánica**: se
parte por `\n\n`, el primer trozo es `instruction`, el segundo `text` del estímulo y el
tercero el nuevo `text` de la pregunta.

### 3.1 Bloques a crear

**`diagnostico-1`** — 4 estímulos, 18 de 80 preguntas afectadas:

| `stimulusId` | Área | Origen | Cubre preguntas |
|---|---|---|---|
| `cl-1` | Comprensión lectora | id 16 (582 car.) | 16 – 20 |
| `cl-2` | Comprensión lectora | id 21 (495 car.) | 21 – 25 |
| `cl-3` | Comprensión lectora | id 26 (473 car.) | 26 – 30 |
| `en-1` | Inglés | id 71 (161 car.) | 71 – 73 |

**`diagnostico-2`** — 5 estímulos, 23 de 100 preguntas afectadas:

| `stimulusId` | Área | Origen | Cubre preguntas |
|---|---|---|---|
| `cl-1` | Comprensión lectora | id 21 (450 car.) | 21 – 25 |
| `cl-2` | Comprensión lectora | id 26 (425 car.) | 26 – 30 |
| `cl-3` | Comprensión lectora | id 31 (424 car.) | 31 – 35 |
| `cl-4` | Comprensión lectora | id 36 (389 car.) | 36 – 40 |
| `en-1` | Inglés | id 91 (220 car.) | 91 – 93 |

> **Cuidado con los bloques de inglés.** Solo las **dos** preguntas siguientes al estímulo
> dependen del texto (72–73 y 92–93). El resto del área son ítems de gramática
> independientes. Agrupar por área completa sería incorrecto.

### 3.2 Efecto secundario deseable

Hoy la pregunta 16 de `diagnostico-1` tiene 626 caracteres de enunciado con
`topic: "Idea principal"`. Tras la extracción queda en *"¿Cuál es la idea principal?"* (27
caracteres). El análisis por tema deja de estar contaminado por el pasaje.

---

## 4. `data/<examId>/answers.json`

```json
{
  "examId": "diagnostico-1",
  "version": "2.0",
  "answers": [
    { "id": 1, "correctAnswer": "B" }
  ]
}
```

Se carga **solo al pulsar `Terminar`**, nunca antes.

---

## 5. Validaciones obligatorias

Ante cualquier fallo: **detener el flujo** y mostrar un mensaje técnico legible que
identifique archivo, pregunta y problema. Nunca continuar en modo degradado.

### 5.1 Al cargar el catálogo

1. `exams.json` es un array no vacío.
2. Los `id` son únicos.
3. Cada entrada tiene `title`, `version`, `questionCount`, `questions` y `answers`.

### 5.2 Al cargar un examen

1. `exam.id` coincide con el `id` del catálogo.
2. `exam.version` coincide con la `version` del catálogo.
3. `exam.questionCount` coincide con `questions.length` **y** con el catálogo.
4. Los `id` son enteros, únicos y consecutivos desde 1.
5. Toda pregunta tiene `area` no vacía y declarada en `exam.areas`.
6. Toda pregunta tiene `topic` no vacío.
7. `options` contiene exactamente `A`, `B`, `C`.
8. Ninguna opción está vacía ni es solo espacios.
9. `text` no está vacío.
10. Los rangos de `exam.areas` son contiguos, sin solapes, y cubren 1..`questionCount`.
11. Las preguntas de cada área caen dentro del rango declarado.
12. Todo `stimulusId` referencia un estímulo existente.
13. Todo estímulo declarado es referenciado por al menos una pregunta.
14. El `area` de cada estímulo coincide con el `area` de las preguntas que lo referencian.
15. Las preguntas que comparten `stimulusId` son **contiguas** en `id`.

### 5.3 Al cargar la clave (al pulsar `Terminar`)

1. `answers.examId` coincide con `exam.id`.
2. `answers.version` coincide con `exam.version`.
3. Existe exactamente una clave por cada `id` de pregunta.
4. No existen claves para `id` inexistentes.
5. Cada `correctAnswer` pertenece a las opciones de su pregunta.

---

## 6. Preparación para aleatorización futura

Aunque v1 no aleatoriza, el modelo ya lo permite:

- Las preguntas con `stimulusId` forman una unidad. Una futura aleatorización DEBE barajar
  **bloques**, no preguntas sueltas, y mantener el orden interno del bloque.
- Las preguntas sin `stimulusId` son barajables individualmente dentro de su área.
- La cadena de respuestas siempre se construye ordenando por `id`, nunca por orden visual,
  de modo que el formato de salida no cambia aunque se aleatorice la presentación.
