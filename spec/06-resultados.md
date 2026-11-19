# 06 — Resultados

## 1. Resultado global

```text
Resultado
92 / 100
92%
```

Además DEBE mostrarse:

- correctas;
- incorrectas;
- porcentaje;
- **tiempo total** del examen (`62 min`).

**No** asignar etiquetas automáticas de aprobado/reprobado, bueno/malo, ni colores
semafóricos sobre el resultado global. La interpretación pedagógica ocurre fuera de la
aplicación.

### 1.1 Contexto de azar

Junto al resultado DEBERÍA mostrarse, en texto discreto, la línea base de azar real del
examen:

```text
Referencia: responder al azar produciría ~33%.
En este examen, responder siempre "B" produce 49%.
```

Es un dato objetivo, no un juicio, y evita que un 49% se lea como «casi la mitad bien».
Mientras la clave siga desbalanceada, esta nota es **obligatoria**
(`10-decisiones-y-riesgos.md`).

---

## 2. Resultado por área

Agrupar por `question.area`, respetando el orden de `exam.areas`.

```text
Pensamiento científico: 17 / 20 — 85%
Comprensión lectora:    19 / 20 — 95%
Redacción indirecta:    16 / 20 — 80%
Pensamiento matemático: 22 / 25 — 88%
Inglés:                 14 / 15 — 93%
```

DEBERÍA acompañarse de una barra horizontal por área para lectura rápida. La barra es
decorativa: el número siempre está presente como texto.

---

## 3. Resultado por tema

Se calcula sobre `question.topic`:

```json
{
  "Porcentajes":        { "correct": 3, "total": 4 },
  "Ecuaciones lineales": { "correct": 5, "total": 5 }
}
```

Se muestra en una sección expandible **Detalle por tema**, cerrada por defecto.

### 3.1 Advertencia obligatoria sobre el tamaño de muestra

En los exámenes actuales, **el 81-83% de los temas tiene una sola pregunta**. Un
`0/1 — 0%` no distingue entre una laguna real y un despiste.

Por eso, en el detalle por tema:

- Cada fila DEBE mostrar el conteo absoluto (`1/2`), nunca solo el porcentaje.
- Los temas con `total < 2` DEBEN marcarse con una indicación de muestra insuficiente,
  por ejemplo un sufijo `· muestra mínima` o un icono con texto accesible.
- La sección DEBE abrir con una nota:
  *"La mayoría de los temas tiene una o dos preguntas. Un fallo aislado no indica
  necesariamente una laguna: revisa la tendencia en el dashboard."*
- El orden por defecto es: primero los fallados, después por número de preguntas
  descendente, y solo al final alfabético. Así lo accionable queda arriba.

No presentar un ranking de «temas más débiles» a partir de un solo intento. Ese análisis
corresponde al dashboard, que agrega varios intentos y ambos exámenes
(`07-dashboard.md`).

---

## 4. Estructura del resultado en memoria

```js
result = {
  score: 87,
  total: 100,
  percentage: 87,
  correctCount: 87,
  incorrectCount: 13,
  minutes: 62,
  activeMs: 3_720_000,
  elapsedWallMs: 4_260_000,
  answerString: "62BACAB…",
  areaResults: {
    "Pensamiento científico": { correct: 18, total: 20 }
  },
  topicResults: {
    "Porcentajes": { correct: 3, total: 4 }
  },
  perQuestion: [
    { id: 1, selected: "A", correct: "B", isCorrect: false,
      area: "Pensamiento científico", topic: "Diseño experimental" }
  ]
};
```

`perQuestion` se usa para pintar la corrección y **no** se guarda en el historial: se puede
reconstruir desde la cadena de respuestas y `answers.json`, y guardarlo multiplicaría el
tamaño del historial sin aportar nada.

---

## 5. Acciones disponibles

| Acción | Efecto |
|---|---|
| **Copiar respuestas** | Copia la cadena `<minutos><LETRAS>` |
| **Copiar resumen** | Copia el bloque completo de `05-tiempo-y-cadena.md`, sección 3.2 |
| **Ver dashboard** | Abre `dashboard.html` |
| **Reiniciar examen** | Confirmación → borra el intento, conserva el historial |
| **Volver al inicio** | Vuelve al selector conservando el intento corregido |
