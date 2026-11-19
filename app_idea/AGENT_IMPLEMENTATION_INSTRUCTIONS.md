# Especificación para Agente AI — Aplicación web estática de exámenes UADY / EXANI-I

## Objetivo

Implementar una aplicación web **100% estática** que construya y evalúe exámenes a partir de archivos JSON. No usar backend, base de datos ni autenticación. La prioridad es que el examen sea reutilizable y que nuevos reactivos puedan añadirse sin modificar la lógica de la aplicación.

La aplicación debe permitir que un estudiante responda todas las preguntas, valide pendientes al terminar, corrija visualmente el intento, calcule resultados y genere una cadena compacta de respuestas como `ABAABCCAB...`. Esa cadena será enviada posteriormente a un agente de IA para hacer una evaluación cualitativa más profunda.

## Estructura recomendada

```text
/
├── index.html
├── styles.css
├── app.js
├── data/
│   ├── exams.json
│   ├── diagnostico-1/
│   │   ├── questions.json
│   │   └── answers.json
│   └── diagnostico-2/
│       ├── questions.json
│       └── answers.json
└── README.md
```

Preferir HTML + CSS + JavaScript puro. No introducir frameworks salvo necesidad clara.

## Formato de `questions.json`

```json
{
  "exam": {
    "id": "diagnostico-1",
    "title": "Diagnóstico UADY / EXANI-I — Nivel 1",
    "version": "1.0",
    "questionCount": 80,
    "areas": [
      {"name": "Pensamiento científico", "start": 1, "end": 15}
    ]
  },
  "questions": [
    {
      "id": 1,
      "area": "Pensamiento científico",
      "topic": "Diseño experimental",
      "text": "Texto de la pregunta",
      "options": {
        "A": "Opción A",
        "B": "Opción B",
        "C": "Opción C"
      }
    }
  ]
}
```

`topic` existe para permitir análisis posteriores por concepto. La aplicación debe calcular estadísticas por área y, preferentemente, también por tema.

## Formato de `answers.json`

```json
{
  "examId": "diagnostico-1",
  "version": "1.0",
  "answers": [
    {"id": 1, "correctAnswer": "B"}
  ]
}
```

Validar que `exam.id === examId`, que las versiones coincidan, que todos los ids sean únicos y que exista exactamente una clave válida por pregunta.

## Selector de examen

Usar `data/exams.json` para descubrir exámenes. Mostrar una pantalla inicial con título, cantidad de preguntas y botón **Comenzar**. Añadir un examen nuevo debe requerir únicamente nuevos JSON y una entrada en `exams.json`, sin cambiar `app.js`.

## Presentación

Mostrar todas las preguntas en una sola página, agrupadas por área. Cada reactivo debe incluir:

- número;
- enunciado;
- opciones A/B/C mediante radio buttons;
- tema de forma discreta, opcional visualmente;
- semántica accesible (`fieldset`, `legend`, `label` o equivalente).

No mostrar respuestas correctas antes de finalizar.

## Navegación y progreso

Mostrar permanentemente algo equivalente a:

```text
Respondidas: 42 / 100
```

Añadir barra de progreso y navegación rápida por áreas. Al seleccionar una respuesta, actualizar el progreso inmediatamente.

## Botón `Terminar`

Debe aparecer al final del examen.

Al pulsarlo, primero verificar que todas las preguntas estén respondidas. Si falta alguna:

- **no corregir**;
- no cargar/mostrar resultados finales;
- resaltar las preguntas pendientes;
- mostrar sus números, por ejemplo `Faltan 4 preguntas: 12, 37, 54 y 91`;
- hacer scroll a la primera pendiente;
- conservar las respuestas seleccionadas.

Solo cuando todas estén respondidas se debe corregir el intento.

## Carga de la clave

Preferencia: cargar `answers.json` solamente cuando el usuario pulse **Terminar**. Esto no constituye seguridad real, pero evita cargar la clave durante la interacción normal.

Como la aplicación es estática, debe asumirse que una persona con DevTools puede inspeccionar la clave. No intentar ocultarla con Base64, minificación u ofuscación.

## Corrección visual

Una vez finalizado:

- respuesta correcta seleccionada → fondo verde suave + texto `Correcta`;
- respuesta incorrecta seleccionada → fondo rojo suave + texto `Tu respuesta`;
- en una pregunta incorrecta, la alternativa correcta → fondo verde suave + texto `Respuesta correcta`.

No depender solo del color. Añadir texto/iconografía accesible.

Después de corregir:

- deshabilitar todos los radio buttons;
- bloquear el intento;
- deshabilitar/ocultar `Terminar`;
- ofrecer `Reiniciar examen` con confirmación previa.

## Resultado global

Mostrar:

```text
Resultado
92 / 100
92%
```

Además:

- correctas;
- incorrectas;
- porcentaje.

No asignar etiquetas automáticas como aprobado/reprobado o bueno/malo. La interpretación pedagógica se realizará externamente.

## Resultado por área

Agrupar por `question.area` y respetar el orden de `exam.areas`.

Ejemplo:

```text
Pensamiento científico: 17 / 20 — 85%
Comprensión lectora: 19 / 20 — 95%
Redacción indirecta: 16 / 20 — 80%
Pensamiento matemático: 22 / 25 — 88%
Inglés: 14 / 15 — 93%
```

## Resultado por tema

Calcular también por `question.topic`:

```json
{
  "Porcentajes": {"correct": 3, "total": 4},
  "Ecuaciones lineales": {"correct": 5, "total": 5}
}
```

Puede mostrarse en una sección expandible **Detalle por tema**.

## Cadena compacta de respuestas

Al terminar, generar una cadena de letras en mayúsculas, sin espacios, comas ni saltos de línea.

Ejemplo:

```text
ABAABCCAB
```

La cadena **siempre** debe generarse ordenando primero las preguntas por `id`, nunca por orden visual. Esto es obligatorio para que pueda analizarse posteriormente sin ambigüedad.

Añadir botón **Copiar respuestas** y confirmación `Respuestas copiadas`.

También puede existir **Copiar resumen** con:

```text
Examen: Diagnóstico UADY / EXANI-I — Nivel 2
Resultado: 87/100 (87%)

Respuestas:
ABAABCC...

Áreas:
Pensamiento científico: 18/20
Comprensión lectora: 17/20
Redacción indirecta: 16/20
Pensamiento matemático: 22/25
Inglés: 14/15
```

## `localStorage`

Guardar progreso después de cada respuesta:

- examen seleccionado;
- respuestas;
- hora de inicio;
- estado del intento.

Clave sugerida:

```text
exani.exam.<examId>.v<version>
```

Si existe un intento incompleto al cargar:

```text
Existe un intento sin terminar.
[Continuar] [Comenzar de nuevo]
```

No borrar progreso automáticamente.

## Historial local

Al finalizar guardar un registro como:

```json
{
  "examId": "diagnostico-2",
  "version": "1.0",
  "completedAt": "ISO-8601",
  "score": 87,
  "total": 100,
  "percentage": 87,
  "answers": "ABAABCC...",
  "areaResults": {},
  "topicResults": {}
}
```

Mantener máximo 20 intentos por examen.

## Responsive y accesibilidad

Desktop:

- ancho de lectura cómodo;
- contenido centrado;
- navegación por áreas sticky si resulta útil.

Móvil:

- una columna;
- áreas táctiles grandes;
- opciones fáciles de seleccionar;
- progreso visible.

Accesibilidad mínima:

- radio + label;
- navegación por teclado;
- foco visible;
- `aria-live` para errores, copiado y resultado;
- no comunicar acierto/error solo por color.

## Orden

Primera versión:

- no aleatorizar preguntas;
- no aleatorizar opciones;
- respetar ids y orden JSON.

Dejar la arquitectura preparada para aleatorización futura, pero mantenerla desactivada.

## Validaciones técnicas

Al iniciar:

1. `questionCount` coincide con el arreglo;
2. ids únicos y numéricos;
3. todas las preguntas tienen área;
4. todas tienen `topic`;
5. `options` contiene A/B/C;
6. no hay opciones vacías.

Al finalizar, además:

1. `answers.examId` coincide;
2. versión coincide;
3. existe clave para cada id;
4. no existen claves para ids desconocidos;
5. `correctAnswer` pertenece a las opciones existentes.

Ante errores, detener el flujo y mostrar un mensaje técnico legible.

## Modelo de estado sugerido

```js
const state = {
  exam: null,
  questions: [],
  selectedAnswers: {},
  answerKey: null,
  startedAt: null,
  completedAt: null,
  completed: false,
  result: null
};
```

## Funciones sugeridas

```text
loadExamList()
loadExam()
validateQuestions()
renderExam()
handleAnswerChange()
updateProgress()
finishExam()
findUnanswered()
loadAnswerKey()
validateAnswerKey()
gradeExam()
calculateAreaResults()
calculateTopicResults()
buildAnswerString()
renderResults()
saveProgress()
restoreProgress()
saveHistory()
resetExam()
copyAnswerString()
```

Los nombres son orientativos.

## Pruebas mínimas obligatorias

### 1. Intento incompleto
Responder todas menos la 10 y pulsar `Terminar`.

Esperado: no corregir; resaltar 10; mensaje de pendiente; scroll a 10.

### 2. Intento completo
Responder todas y terminar.

Esperado: corrección, puntuación, resultados por área/tema y cadena de longitud N.

### 3. Recarga
Responder 10 preguntas y recargar.

Esperado: recuperar exactamente esas respuestas.

### 4. Error
Elegir una opción incorrecta.

Esperado: seleccionada roja; correcta verde; etiquetas textuales.

### 5. Cadena
Respuestas `A B A A B C C A B` deben producir exactamente `ABAABCCAB`.

### 6. JSON inconsistente
Eliminar una clave de `answers.json`.

Esperado: error claro y no corregir parcialmente.

## Ejecución local

No asumir funcionamiento con `file://` porque `fetch()` suele estar restringido. Documentar, por ejemplo:

```bash
python3 -m http.server 8000
```

Abrir luego:

```text
http://localhost:8000
```

## Entregables del agente

Como mínimo:

```text
index.html
styles.css
app.js
data/exams.json
data/diagnostico-1/questions.json
data/diagnostico-1/answers.json
data/diagnostico-2/questions.json
data/diagnostico-2/answers.json
README.md
```

`README.md` debe explicar ejecución local, publicación en GitHub Pages, cómo añadir exámenes y formato de los JSON.

## Fuera de alcance de la primera versión

No implementar salvo que sobre tiempo:

- temporizador;
- límite de tiempo;
- PWA/offline;
- gráficas históricas;
- exportación/importación;
- banco aleatorio;
- aleatorización de opciones;
- autenticación.

Primero asegurar robustez, corrección del scoring, persistencia y claridad de UI.
