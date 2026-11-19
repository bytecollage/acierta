# 05 — Medición del tiempo y cadena de resultado

## 1. Formato de la cadena

```text
35AABCCBABBA
│ └────────── respuestas, una letra por pregunta, ordenadas por id
└──────────── minutos totales del examen, entero sin ceros a la izquierda
```

- Sin espacios, comas ni saltos de línea.
- Letras siempre en **mayúsculas**.
- Longitud de la parte de letras = `exam.questionCount`, siempre.
- El número va **delante**, pegado a la primera letra.

### 1.1 Reglas de construcción

1. **Ordenar siempre por `id`**, nunca por orden visual. Esto es obligatorio: garantiza que
   la cadena pueda interpretarse sin ambigüedad aunque en el futuro se aleatorice la
   presentación.
2. La cadena solo se genera cuando el examen está **completo y corregido**. Nunca hay
   huecos ni caracteres de relleno.
3. Los minutos son el **tiempo activo** (sección 2), redondeado al entero más cercano.
4. Si el tiempo activo es menor de 1 minuto, se escribe `1`. Nunca `0`, para que la cadena
   no empiece por un cero que complique la lectura.

### 1.2 Regla de interpretación

La cadena es inequívoca porque las respuestas solo pueden ser `A`, `B` o `C`: el número es
todo lo que aparece antes de la primera letra.

```js
const MATCH = /^(\d+)([ABC]+)$/;
// "35AABCCBABBA" -> minutos = 35, respuestas = "AABCCBABBA"
```

Validación al generar: la cadena DEBE cumplir ese patrón y
`respuestas.length === exam.questionCount`. Si no, es un error de programación y DEBE
detenerse el flujo con mensaje técnico.

### 1.3 Ejemplos

| Situación | Cadena |
|---|---|
| 9 preguntas, 35 minutos | `35ABAABCCAB` |
| 80 preguntas, 62 minutos | `62` + 80 letras |
| Examen resuelto en 40 segundos | `1AAB…` |
| 100 preguntas, 128 minutos | `128` + 100 letras |

---

## 2. Medición del tiempo

### 2.1 Qué se mide

Se mide **tiempo activo**, no tiempo de reloj de pared. La diferencia importa: si el
estudiante empieza el examen, cierra el portátil y lo retoma al día siguiente, el reloj de
pared diría «1.440 minutos» y envenenaría el dashboard.

### 2.2 Reglas

1. El cronómetro **arranca** al pulsar **Comenzar** en la pantalla de inicio.
2. El cronómetro **se detiene** al pulsar **Terminar** con el examen completo, justo antes
   de cargar la clave.
3. Si `Terminar` se pulsa con preguntas pendientes, el cronómetro **sigue corriendo**.
4. El tiempo **se pausa** cuando la pestaña deja de estar visible
   (`document.visibilityState === "hidden"`) y se reanuda al volver.
5. El tiempo **se pausa por inactividad** tras **5 minutos** sin ninguna interacción
   (cambio de respuesta, scroll, tecla, clic o movimiento de puntero). Se reanuda con la
   siguiente interacción.
6. Al reanudar un intento guardado, el tiempo **continúa** desde lo acumulado. Nunca se
   reinicia ni se recalcula desde `startedAt`.

### 2.3 Implementación

Acumular en milisegundos, sumando segmentos cerrados:

```js
// al arrancar o reanudar
state.lastTickAt = Date.now();

// al pausar, terminar o guardar
state.activeMs += Date.now() - state.lastTickAt;
state.lastTickAt = null;
```

`state.activeMs` se persiste en cada guardado (`08-persistencia.md`). El segmento abierto
se cierra antes de escribir, de modo que un cierre brusco del navegador pierde como mucho
el intervalo desde el último guardado.

### 2.4 Qué se guarda

Además de los minutos de la cadena, el historial guarda:

| Campo | Unidad | Para qué |
|---|---|---|
| `activeMs` | ms | Fuente de verdad del tiempo del examen |
| `elapsedWallMs` | ms | Reloj de pared entre inicio y fin |
| `minutes` | min | El entero que va en la cadena |

Guardar ambos permite detectar intentos partidos en varias sesiones: si
`elapsedWallMs` es mucho mayor que `activeMs`, el intento se hizo a trozos y su tiempo no es
comparable con el de un intento de una sentada. El dashboard usa esa diferencia para marcar
intentos no comparables (`07-dashboard.md`).

### 2.5 Presentación durante el examen

Cronómetro visible con formato `mm:ss` (o `h:mm:ss` si supera la hora). DEBE quedar claro
que es informativo y que **no hay límite de tiempo**.

DEBERÍA indicarse visualmente cuando el cronómetro está pausado, para que el estudiante no
crea que se ha bloqueado.

El cronómetro **no** DEBE anunciarse por `aria-live`: generaría ruido constante en lectores
de pantalla. Se expone como región consultable con `aria-live="off"`.

---

## 3. Copiar resultados

### 3.1 Botón *Copiar respuestas*

Copia exclusivamente la cadena:

```text
62BACABCABBA…
```

Confirmación visible `Respuestas copiadas`, anunciada por `aria-live="polite"`.

### 3.2 Botón *Copiar resumen*

Copia un bloque de texto preparado para pegarlo a un agente de IA:

```text
Examen: Diagnóstico UADY / EXANI-I — Nivel 2
Versión: 2.0
Fecha: 2026-09-17
Tiempo: 62 min (activo) / 71 min (reloj)

Resultado: 87/100 (87%)

Cadena: 62BACABCABBA…

Áreas:
Pensamiento científico: 18/20 (90%)
Comprensión lectora: 17/20 (85%)
Redacción indirecta: 16/20 (80%)
Pensamiento matemático: 22/25 (88%)
Inglés: 14/15 (93%)

Temas fallados:
Porcentajes: 1/3
Conectores: 0/2
Concordancia: 1/2

Nota para el análisis: la clave de este examen no está balanceada
(A=47, B=49, C=4 de 100). La línea base de azar no es 33%: responder
siempre "B" produce 49%. Considerarlo al interpretar el resultado.
```

> La nota final es **obligatoria** mientras la clave siga desbalanceada. Sin ella, un
> agente de IA sobrestimará el nivel del estudiante. Ver `10-decisiones-y-riesgos.md`.
