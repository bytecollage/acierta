# 07 — Dashboard de progreso

Archivo: `dashboard.html`. Se alimenta **exclusivamente** del historial en `localStorage`.
No carga exámenes ni claves. DEBE funcionar abriéndolo directamente por URL.

## Objetivo

Responder dos preguntas del estudiante:

1. **¿Estoy mejorando?**
2. **¿Qué temas debo estudiar con más énfasis?**

Y hacerlo **sin mentir**. Los datos actuales tienen limitaciones reales
(`10-decisiones-y-riesgos.md`) y el dashboard DEBE hacerlas visibles en vez de esconderlas
tras un porcentaje bonito.

---

## 1. Estado vacío

Si no hay intentos: mensaje explicativo y enlace para hacer el primer examen. No mostrar
gráficas vacías ni ceros.

Con **un solo intento**: mostrar las métricas de ese intento, pero **no** dibujar gráficas
de evolución. En su lugar, una nota: *"Haz al menos dos exámenes para ver tu evolución."*

---

## 2. Resumen superior

Tarjetas con:

| Métrica | Detalle |
|---|---|
| Exámenes completados | Total y desglose por examen |
| Mejor resultado | Porcentaje, examen y fecha |
| Último resultado | Porcentaje y variación frente al anterior del mismo examen |
| Tiempo medio | Minutos activos, solo de intentos comparables (sección 6) |

---

## 3. Gráfica: evolución del resultado

Línea temporal con el porcentaje de cada intento, eje X por fecha (`completedAt`).

Requisitos:

- **Una serie por examen**, con color distinto y leyenda. No mezclar exámenes distintos en
  una sola línea: tienen 80 y 100 preguntas y dificultad no equivalente.
- Los **primeros intentos** se marcan con punto relleno; las **repeticiones** del mismo
  examen, con punto hueco.
- Línea de referencia horizontal punteada en el **umbral de azar real** del examen
  (49% en diagnóstico-2, 49% en diagnóstico-1), etiquetada como
  *"responder siempre la misma letra"*. Ver sección 7.
- Si un examen tiene un solo intento, dibujar el punto sin línea.

---

## 4. Gráfica: rendimiento por área

Barras agrupadas: una barra por área, agrupadas por intento (máximo los 5 más recientes
por examen, para no saturar).

Alternativa aceptable si resulta más legible: **líneas pequeñas (sparklines)**, una por
área, mostrando la evolución de su porcentaje.

Cada área muestra su porcentaje y el conteo absoluto.

---

## 5. Tabla: temas a reforzar

**Es la pieza central del dashboard.** Responde directamente a "¿qué estudio?".

### 5.1 Agregación

La agregación DEBE hacerse **cruzando exámenes**, no por examen separado. Los dos exámenes
actuales comparten 39 temas; agregarlos es lo único que da muestra suficiente:

| Tema | diag-1 | diag-2 | Por vuelta completa |
|---|---|---|---|
| Información explícita | 5 | 3 | **8** |
| Geometría | 3 | 2 | **5** |
| Idea principal | 2 | 3 | **5** |
| Vocabulario en contexto | 2 | 3 | **5** |
| Reading comprehension | 3 | 2 | **5** |
| Ecuaciones lineales | 2 | 2 | 4 |
| Funciones lineales | 2 | 2 | 4 |
| Proporcionalidad | 2 | 2 | 4 |

Para cada tema se suman `correct` y `total` de **todos** los intentos del historial.

### 5.2 Columnas

| Columna | Contenido |
|---|---|
| Tema | Nombre del `topic` |
| Área | Área a la que pertenece |
| Aciertos | `correct / total` acumulado, en absoluto |
| % | Porcentaje |
| Observaciones | Número total de preguntas vistas de ese tema |
| Tendencia | Flecha ↑ / → / ↓ comparando la primera mitad de observaciones con la segunda; solo si hay ≥ 6 observaciones |
| Confianza | `Alta` (≥ 6 obs.) · `Media` (3–5) · `Baja` (< 3) |

### 5.3 Reglas de presentación

- **Orden por defecto:** peor porcentaje primero, pero **solo entre los temas de confianza
  Alta y Media**. Los de confianza Baja van en una sección aparte, colapsada, titulada
  *"Temas con muestra insuficiente"*.
- Nunca ordenar por porcentaje mezclando un `0/1` con un `2/8`. Es la forma más fácil de
  dar un consejo de estudio equivocado.
- Un tema entra en **"Recomendado estudiar"** solo si cumple las dos condiciones:
  - confianza **Media** o **Alta** (≥ 3 observaciones), y
  - porcentaje **< 60%**.
- Si ningún tema cumple los criterios, decirlo explícitamente:
  *"Aún no hay suficientes datos para recomendar temas concretos. Repite los exámenes o
  añade exámenes nuevos."* No rellenar la lista con temas de una sola pregunta.

### 5.4 Filtros

- Por área.
- Por examen (todos / diagnóstico-1 / diagnóstico-2).
- Interruptor *"Incluir repeticiones"* (ver sección 6), desactivado por defecto.

---

## 6. Intentos comparables y repeticiones

Dos advertencias que el dashboard DEBE respetar:

### 6.1 Repeticiones del mismo examen

Sin aleatorización y con solo dos exámenes fijos, **el segundo intento del mismo examen
mide en parte memoria, no conocimiento**. Una curva de mejora construida sobre
repeticiones sube sola.

Regla: por defecto, las métricas de "temas a reforzar" usan **solo el primer intento de
cada examen**. El interruptor *Incluir repeticiones* permite verlas, pero al activarlo
DEBE mostrarse un aviso:

> *Incluyendo repeticiones. Los intentos repetidos del mismo examen pueden reflejar
> memorización además de aprendizaje.*

En las gráficas de evolución las repeticiones siempre se dibujan, pero diferenciadas
(punto hueco).

### 6.2 Intentos partidos en varias sesiones

Un intento con `elapsedWallMs > 3 × activeMs` se marca como **no comparable en tiempo** y
se excluye del cálculo de "tiempo medio". Su resultado sí cuenta; su duración no.

---

## 7. Umbral de azar

El dashboard DEBE mostrar, en la gráfica de evolución y en el resumen, la línea base real
de cada examen:

| Examen | Todo A | Todo B | Todo C | Azar teórico |
|---|---|---|---|---|
| diagnóstico-1 | 49% | 41% | 10% | 33% |
| diagnóstico-2 | 47% | **49%** | 4% | 33% |

Estos valores se calculan **en tiempo de ejecución** a partir de `answers.json` cuando
estén disponibles; si el dashboard se abre sin haberlos cargado, se usan los valores
almacenados en el historial (`08-persistencia.md` guarda `keyDistribution` por intento).

Motivo: un 48% parece «casi la mitad» y en realidad está en el nivel de marcar siempre la
misma letra. Sin esta referencia, el dashboard induce a error.

---

## 8. Gráficas: implementación

Sin librerías. SVG generado a mano, siguiendo el mismo enfoque que el resto de la
aplicación.

Requisitos:

- `viewBox` y ancho fluido; nunca ancho fijo en píxeles.
- Toda gráfica DEBE tener una **alternativa textual equivalente**: una tabla con los mismos
  datos, visible o accesible mediante un control *Ver datos*. La gráfica es un apoyo, no la
  única vía de acceso a la información.
- No usar color como único portador de significado: combinar color con forma de punto,
  trazo o etiqueta.
- Paleta legible en claro y oscuro; respetar `prefers-color-scheme` si se implementa tema
  oscuro.

---

## 9. Fuera de alcance del dashboard v1

- Comparación con otros estudiantes.
- Predicción de nota en el examen real.
- Exportar gráficas como imagen.
- Recomendaciones generadas por IA dentro de la aplicación (eso ocurre fuera, pegando el
  resumen copiado a un agente).
