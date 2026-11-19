# Datos y exámenes

Los exámenes son archivos JSON en `web/data/`, en UTF-8. El historial de intentos vive en
Google Sheets ([arquitectura.md](arquitectura.md) §3.1).

## 1. Exámenes actuales

| `id` | Preguntas | Clave | Notas |
|---|---|---|---|
| N0E01 | 80 | A 39 · B 33 · C 8 (**desbalanceada**) | Sin `subarea` |
| N0E02 | 100 | A 47 · B 49 · C 4 (**desbalanceada**) | Sin `subarea` |
| N0E03–N0E05 | 100 | En tercios | Sin `subarea` |
| N1E01–N1E05 | 150 | 50 · 50 · 50 | Proporción oficial de áreas, con `subarea`, generados con `exam-builder` |

**Nombres.** El `id` es el código `N<nivel>E<examen>` (los cinco primeros son nivel 0 y los
cinco siguientes, nivel 1) y es el mismo en todas partes: catálogo, carpeta
(`data/N1E02/`), URL (`#examen/N1E02`), hoja de cálculo y cadena de respuestas. El título
es «Examen N1E02». Con el `id` se relacionan los intentos guardados en la hoja y en cada
navegador, así que no debe cambiar.

**Ids anteriores.** Hasta el 2026-11-19 el `id` era `diagnostico-N` (`diagnostico-7` =
`N1E02`) y el título «Examen Diagnóstico N1E02». La app y el Apps Script traducen los ids
anteriores al leer (hoja, caché, cola de subida, intentos en curso y enlaces guardados);
ver [decisiones.md](decisiones.md) D-14.

---

## 2. `data/exams.json`: catálogo

```json
[
  {
    "id": "N1E01",
    "title": "Examen N1E01",
    "version": "2.0",
    "questionCount": 150,
    "estimatedMinutes": 255,
    "questions": "N1E01/questions.json",
    "answers": "N1E01/answers.json"
  }
]
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `id` | sí | Código del examen (`N1E01`): único, estable, solo A–Z y 0–9. Va en la URL y encabeza la cadena de respuestas |
| `title` | sí | Se muestra en las pestañas y en Mi progreso |
| `version` | sí | Igual a la del examen y la clave |
| `questionCount` | sí | Igual al número real de preguntas |
| `estimatedMinutes` | no | Orientativo |
| `questions`, `answers` | sí | Rutas relativas a `data/` |

El panel solo necesita el catálogo para pintar las pestañas; cada examen se descarga al
abrirlo.

---

## 3. `data/<id>/questions.json`

```json
{
  "exam": {
    "id": "N1E01",
    "title": "Examen N1E01",
    "version": "2.0",
    "questionCount": 150,
    "areas": [
      { "name": "Pensamiento científico", "start": 1, "end": 28 },
      { "name": "Comprensión lectora", "start": 29, "end": 56 }
    ]
  },
  "stimuli": [
    { "id": "cl-1", "area": "Comprensión lectora",
      "instruction": "Lee el texto y responde.", "text": "El pasaje completo…" }
  ],
  "questions": [
    { "id": 85, "area": "Pensamiento matemático",
      "subarea": "Comprensión de lo matemático", "topic": "Fracciones",
      "text": "¿Cuál es el resultado de 3/4 + 2/3?",
      "options": { "A": "17/12", "B": "5/7", "C": "5/12" } }
  ]
}
```

- **`exam.areas`**: rangos contiguos, sin solapes, que cubren 1..`questionCount`. Su orden
  es el orden de presentación.
- **`stimuli`**: textos compartidos por varias preguntas. `instruction` es opcional. Puede
  faltar en exámenes sin textos.
- **`questions`**: `id` entero consecutivo desde 1; `area` declarada en `exam.areas`;
  `topic` obligatorio; `subarea` opcional (recomendado); `stimulusId` opcional; `text` es
  solo la pregunta, nunca el pasaje; `options` con exactamente `A`, `B` y `C`.

## 4. `data/<id>/answers.json`

```json
{ "examId": "N1E01", "version": "2.0",
  "answers": [ { "id": 1, "correctAnswer": "A" } ] }
```

Se carga solo al pulsar *Terminar*.

---

## 5. Validaciones

`web/js/grading.js` las aplica en la app y `tools/validate-exams.js` las aplica en
cada push. Ante cualquier fallo, la app se detiene con un mensaje que dice el archivo, la
pregunta y el problema.

**Catálogo:** array no vacío, `id` únicos y solo con A–Z y 0–9, campos obligatorios
presentes.

**Examen:**

1. `id`, `version` y `questionCount` coinciden con el catálogo; `questionCount` coincide
   con el número de preguntas.
2. `id` de preguntas enteros, únicos y consecutivos desde 1.
3. Toda pregunta tiene área declarada, tema, enunciado y opciones `A`, `B` y `C` no vacías.
4. Los rangos de áreas son contiguos y cada pregunta cae en el suyo.
5. Todo `stimulusId` existe; todo estímulo se usa; el área del estímulo coincide con la de
   sus preguntas; las preguntas de un mismo estímulo son contiguas.

**Clave:** `examId` y `version` coinciden; exactamente una respuesta por pregunta; cada
respuesta es una de las opciones.

---

## 6. Versiones

Se sube `version` en `exams.json`, `questions.json` y `answers.json` a la vez cuando
cambian las preguntas o la clave de un examen.

- Un intento **en curso** de la versión anterior queda huérfano: no se puede continuar con
  preguntas distintas a las que empezó, así que el estudiante empieza de nuevo.
- Los intentos **terminados** guardan su propia `version` y no se tocan.
- Cambiar solo el título no requiere subir la versión.

---

## 7. Añadir un examen

1. Crear `data/<id>/questions.json` y `data/<id>/answers.json`.
2. Añadir la entrada al catálogo.
3. `node tools/validate-exams.js` y probar en local.

No hay que tocar ningún `.js`.

### 7.1 Con el generador (`tools/exam-builder`)

Los exámenes N1 se generan desde fuentes en Python (`exams/n6.py` … `n10.py`):

```bash
python3 -I tools/exam-builder/build.py tools/exam-builder/exams/n6.py           # revisar
python3 -I tools/exam-builder/build.py tools/exam-builder/exams/n6.py --write   # escribir
```

Cada pregunta de la fuente es una tupla
`(subárea, tema, enunciado, CORRECTA, distractor, distractor[, comprobación])`; la correcta
va siempre primero. El generador:

- asigna las letras con clave equilibrada (50/50/50), sin rachas de más de 3 letras iguales
  y repartida dentro de cada área (semilla fija `1000 + nivel`, así que es reproducible);
- evalúa las comprobaciones numéricas de cada pregunta;
- informa en qué porcentaje la correcta es la opción más larga (se mantuvo entre 23 % y 35 %);
- escribe los JSON en `data/N1E0n/`, actualiza el catálogo con `id` N1E0n y título «Examen N1E0n».

Proporción de áreas de un examen de 150: PC 28 · CL 28 · RI 28 · PM 38 · Inglés 28 (la
escala oficial de 160, redondeada; ver [guia-exani-i.md](guia-exani-i.md)).

**Hay que editar la fuente y regenerar, no los JSON a mano.** Pendiente: pasar el
contenido a la hoja de cálculo como fuente única ([decisiones.md](decisiones.md), R-06).

---

## 8. Registro de un intento

Lo que se envía a la API al terminar y lo que guarda la hoja:

| Campo | Para qué |
|---|---|
| `examId`, `examTitle`, `version` | Examen y versión exacta |
| `completedAt` | Fecha de término (ISO) |
| `attemptNumber`, `isFirstAttempt` | Los recalcula el servidor; Mi progreso separa primeros intentos de repeticiones |
| `score`, `total`, `percentage`, `correctCount`, `incorrectCount` | Resultado |
| `minutes`, `activeMs`, `elapsedWallMs` | Tiempo; permite detectar intentos partidos |
| `answers` | Cadena `<código>\|<minutos>\|<LETRAS>` (los intentos anteriores al 2026-11-19 usan `<minutos><LETRAS>`); con ella y la clave se reconstruye la corrección |
| `areaResults`, `topicResults` | Aciertos por área y por tema |
| `topicAreas` | Tema → área, para filtrar sin cargar los exámenes |
| `keyDistribution` | A/B/C de la clave, para la referencia de azar |

La corrección pregunta por pregunta (`perQuestion`) no se guarda: se reconstruye desde la
cadena.
