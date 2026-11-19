# Funcionamiento de la app

Qué hace Acierta y por qué se comporta así. Las razones de fondo están en
[decisiones.md](decisiones.md); el formato de los datos, en [datos.md](datos.md).

## Principios

1. **Diagnóstico, no calificación.** No hay aprobado ni reprobado, ni colores de semáforo
   sobre el resultado global. La app presenta números; la interpretación ocurre fuera.
2. **Los datos mandan.** Añadir un examen requiere solo sus archivos JSON y una entrada en
   el catálogo. No se toca el código.
3. **Sin frameworks ni dependencias.** HTML, CSS y JavaScript; gráficas en SVG propio.
4. **Fallar en voz alta.** Ante datos inconsistentes, la app se detiene con un mensaje que
   dice el archivo y la pregunta. Nunca corrige a medias ni inventa valores.
5. **La clave no es secreta.** Cualquiera puede leer `answers.json`. Solo se carga tarde,
   al terminar, para que no esté en memoria durante el examen.
6. **Sin aleatorizar.** Preguntas y opciones van en el orden del JSON. El modelo de datos
   está preparado para aleatorizar por bloques más adelante.

---

## 1. Pantallas

| Página | Contenido |
|---|---|
| `index.html` | **Bienvenida**, siempre la página inicial (también al abrir la app instalada): barra con ícono y nombre, cuadro «Antes de empezar» y botón **CONTINUAR**. Sin inicio de sesión |
| `panel.html` | **Panel** con tres pestañas, más las pantallas de examen, resultados y reporte. El inicio de sesión está en su pie |

```text
┌────────────┐ CONTINUAR ┌──────────────────────────────────┐ Reporte  ┌─────────┐
│ BIENVENIDA │ ────────▶ │ PANEL                            │ ───────▶ │ REPORTE │
└────────────┘           │ [EXÁMENES][COMPLETADOS][PROGRESO]│ ◀─────── └─────────┘
                         └──────┬───────────────▲───────────┘   ←
                        Comenzar│      atrás / ←│
                         ┌──────▼───┐ Terminar ┌┴───────────┐
                         │  EXAMEN  │ ───────▶ │ RESULTADOS │
                         └──────────┘          └────────────┘
```

**Pestañas del panel**

| Pestaña | Muestra |
|---|---|
| **EXÁMENES** | Exámenes sin ningún intento terminado. Tocar la fila comienza el examen, o lo continúa si hay uno a medias |
| **COMPLETADOS** | Exámenes con al menos un intento terminado, el más reciente primero: último resultado, intentos, mejor resultado. Tocar la fila abre el resultado (o continúa un intento nuevo a medias) |
| **MI PROGRESO** | Resumen de un vistazo y acceso a la pantalla **Reporte detallado** (§5) |

**Barra fija.** Todas las pantallas tienen la misma barra arriba: blanca, de 56 px de alto,
con borde inferior y con los mismos márgenes laterales que el contenido (18 px en
escritorio, 10 px en el celular), que empieza 12–16 px debajo. En el panel la barra son
las tres pestañas; en las demás pantallas, ← y el título. El panel no muestra logo ni
nombre de la app.

**Estilo homogéneo.** Tamaños de letra, radios, separaciones y rellenos salen de
variables en `styles.css` (`--fs-xs` 12 · `--fs-sm` 13 · `--fs-md` 14 · `--fs-title` 17 ·
`--fs-bar` 18 · `--fs-stat` 26/22; `--radius` 10 para tarjetas y `--radius-sm` 8 para lo
que va dentro; `--gap` 16/12 entre tarjetas; `--pad` de tarjeta). Todo título de tarjeta
o de área usa el mismo `h2` (17 px, 10 px debajo), con subtítulo gris opcional en la misma
línea y acción de ícono opcional a la derecha. Las tarjetas de datos (puntuación, puntos,
completados, mejor y último resultado, tiempo medio) comparten estructura: etiqueta en
mayúsculas, cifra y nota.

Las pestañas son íconos (con su nombre para lectores de pantalla y en el `title`), sin
contadores. **Cuenta.** Sin sesión, arriba del panel aparece el aviso «Inicia sesión para guardar tus
resultados en tu cuenta y verlos desde cualquier dispositivo.» con el botón de Google, y no
hay pie. Con sesión el aviso desaparece y el nombre del estudiante y *Cerrar sesión* van en
el pie del panel y del Reporte detallado, espejo de la barra fija: solo una línea superior
de ancho completo, sin fondo, a 56 px del borde inferior. Con poco contenido el pie queda al
fondo de la pantalla; con mucho, al final de la página.

**Filas de examen.** Cada examen ocupa una fila compacta: el título (`Examen N1E02`) y, debajo y más pequeño, `150 preguntas · ~255 min`. En
Completados el porcentaje va justo después del título (`Examen N1E01 · 83%`) y debajo `aciertos · minutos · fecha` (el año
solo si no es el actual). Un intento a medias resalta la fila con fondo y muestra
`97/150 preguntas` con una barra fina. Las filas no tienen botones: toda la fila es el
enlace, con un chevron › a la derecha. Reintentar o comenzar de nuevo se hace dentro: ↻ en
la barra del examen o en la tarjeta del resultado.

**Navegación por hash.** Cada vista tiene su URL: `#examenes`, `#completados`,
`#progreso`, `#reporte`, `#examen/<id>`, `#resultados/<id>`, `#correccion/<id>`. El botón «atrás» del celular regresa del
examen a las pestañas. Salir del examen (atrás, la flecha ← de la barra fija o una pestaña) guarda el
intento y detiene el cronómetro. Recargar `#examen/<id>` sin intento guardado lleva a
EXÁMENES en lugar de crear uno.

**Esperas visibles.** «Cargando tus exámenes…» mientras llegan los datos, «Actualizando tu
historial…» al refrescar desde la caché, «Cargando examen…» al abrirlo y «Corrigiendo y
guardando tu resultado…» al terminar.

---

## 2. Examen

Todas las preguntas en una sola página, agrupadas por área en el orden de `exam.areas`.

- **Barra fija** arriba, siempre visible: ← (volver a mis exámenes), nombre del examen,
  ↻ justo a su derecha, `42/150` y cronómetro. ↻ *Comenzar de nuevo* pide confirmación en
  un diálogo propio, porque se pierden las respuestas y el tiempo del intento. El progreso es una línea fina en el borde inferior de la barra,
  así que la barra mide lo mismo que en las demás pantallas. No hay encabezado ni navegación
  por áreas: se empieza directamente en la primera pregunta.
- **Cada pregunta** es un `fieldset` con el enunciado en la `legend` y tres opciones de
  radio con su `label`.
- **El tema no se muestra durante el examen** y ni siquiera está en el DOM: funcionaría
  como pista. Se inyecta al corregir. Las áreas sí se muestran.

**Textos de lectura.** Las preguntas que comparten `stimulusId` forman un bloque: el texto
aparece una vez, arriba, con borde y fondo propios. En escritorio queda fijo mientras se
recorren sus preguntas; en el celular se puede ocultar con *Ocultar texto / Ver texto*.
Cada pregunta del bloque lo referencia con `aria-describedby`.

### 2.1 Terminar

Antes de cargar la clave se verifica que todo esté respondido.

**Si faltan preguntas:** no se corrige ni se carga `answers.json`. Se resaltan las
pendientes, se muestra `Faltan 4 preguntas: 12, 37, 54 y 91` (anunciado por
`aria-live="assertive"`), se lleva el foco a la primera y el cronómetro sigue corriendo.

**Si está completo:** se detiene el cronómetro, se carga y valida la clave, se corrige, se
guarda en el historial y se muestran los resultados. Si la clave no es válida, no se
corrige nada y el intento queda intacto.

### 2.2 Corrección visual

| Caso | Presentación |
|---|---|
| Correcta seleccionada | Verde suave + `Correcta` |
| Incorrecta seleccionada | Rojo suave + `Tu respuesta` |
| Correcta no seleccionada | Verde suave + `Respuesta correcta` |

Toda señal de color lleva texto. Tras corregir se muestra el tema de cada pregunta, las
preguntas falladas llevan además el borde rojo y se deshabilitan todas las opciones. Se
ve desde *Ver detalles* en Resultados.

---

## 3. Tiempo y cadena de respuestas

### 3.1 Tiempo activo

Se mide **tiempo activo**, no de reloj: si el estudiante cierra la computadora y retoma al
día siguiente, el reloj diría 1 440 minutos.

1. Arranca al comenzar el examen y se detiene al terminarlo completo.
2. Se pausa cuando la pestaña no está visible y tras **5 minutos sin interacción**; se
   reanuda con la siguiente interacción.
3. Al continuar un intento, sigue desde lo acumulado. Nunca se recalcula desde el inicio.

El cronómetro se ve como `mm:ss` (o `h:mm:ss`), indica cuando está en pausa y no se
anuncia en lectores de pantalla (`aria-live="off"`).

Se guardan `activeMs` (tiempo activo), `elapsedWallMs` (reloj entre inicio y fin) y
`minutes` (el entero de la cadena). Si el reloj es más de 3 veces el tiempo activo, el
intento se hizo a trozos y no cuenta para el tiempo medio.

### 3.2 Cadena

```text
N0E01|35|AABCCBABBA
│     │  └── una letra por pregunta, ordenadas por id
│     └───── minutos activos, redondeados; mínimo 1
└─────────── código del examen (su `id` en exams.json)
```

Tres partes separadas por `|`, en mayúsculas, siempre con `questionCount` letras y
ordenada por `id`, nunca por orden visual. Se lee con `/^([A-Z0-9]+)\|(\d+)\|([ABC]+)$/`
(`Grading.parseAnswerString`). La cadena basta para reconstruir la corrección completa
junto con `answers.json`.

**Formato anterior.** Los intentos guardados antes del 2026-11-19 tienen la cadena sin
código ni separadores (`35AABCCBABBA`). No se migran: la app y el Apps Script siguen
aceptándolas, y al ver esos resultados la cadena se muestra ya en el formato nuevo.

---

## 4. Resultados

Pantalla mínima, con la misma barra fija del examen (sin progreso ni cronómetro); ←
vuelve a Completados. No muestra la sesión ni botones al final.

- **Resumen**, con los mismos datos y formato que la fila de Completados
  (`Examen N1E01 · 83%` y debajo `125/150 · 72 min · 18 nov`), alineado a la izquierda, y
  dos botones de ícono a la derecha:
  - ↻ *Volver a intentarlo*: empieza un intento nuevo. Solo pide confirmación si hay un
    intento a medias de ese examen, porque se perdería.
  - 👁 *Ver detalles*: abre la **corrección** (`#correccion/<id>`), el examen completo con
    las respuestas marcadas (§2.2); ← vuelve al resultado.
- **Por área**, en el orden del examen, con barras que llevan el texto encima.
- **Cadena de respuestas** con un botón de ícono para copiarla junto al título.

---

## 5. Mi progreso

Responde dos preguntas, sin esconder las limitaciones de los datos: **¿estoy mejorando?** y
**¿qué temas estudio?**

A primera vista, lo que se entiende en unos segundos; el resto, en la pantalla
**Reporte detallado** (`#reporte`), a la que se entra desde una tarjeta al final de la
pestaña. Usa la barra fija con ← para volver a Mi progreso.

| Sección | Contenido |
|---|---|
| Puntajes | **Puntuación /1000**: promedio de `score/total` de todos los intentos × 1000. **Puntos totales**: suma de aciertos de todos los intentos |
| Tu avance | Una sola línea con el % de cada intento en orden de fecha. El eje Y empieza 10 puntos por debajo del peor resultado (en múltiplos de 10) para que el cambio se vea; las marcas del eje lo indican. Rotula el último resultado. Con un solo intento, se pide hacer al menos dos |
| Tarjetas | Exámenes completados (y repeticiones), mejor resultado, último resultado y su cambio frente al anterior del mismo examen, tiempo medio de intentos comparables |
| Rendimiento por área | Acumulado de todos los intentos, de peor a mejor; barras con el nombre y `% · aciertos/total` encima |

El resumen usa todo el historial, sin filtros. El **Reporte detallado** tiene los filtros
(Examen y Área lado a lado, con «Todos» / «Todas» y los títulos cortos de examen, para
que quepan sin saltos de línea; el interruptor de repeticiones debajo) y contiene:

| Sección | Contenido |
|---|---|
| Temas a reforzar | Tabla agregada **cruzando exámenes**: aciertos, %, observaciones, tendencia (↑ → ↓, con 6 o más observaciones) y confianza (alta ≥ 6, media 3–5, baja < 3) |
| Evolución por examen | Una línea por examen; punto relleno para el primer intento y hueco para repeticiones; línea punteada en la referencia de azar de cada examen (una sola si dos quedan a menos de 4 puntos) |
| Exámenes hechos | Intentos por examen |

Reglas de los temas:

- Ordenados por peor porcentaje, pero solo entre los de confianza alta y media. Los de
  confianza baja van en una sección aparte, cerrada.
- **«Recomendado estudiar»** solo incluye temas con al menos 3 observaciones y menos de
  60 % de aciertos. Si ninguno cumple, se dice así, sin rellenar con temas de una pregunta.
- Por defecto se usan **solo primeros intentos**: repetir un examen mide en parte memoria.
  El interruptor *Incluir repeticiones* las suma y muestra un aviso.

Las gráficas SVG se dibujan al ancho real del contenedor, así que el texto conserva su tamaño
en el celular; la de evolución por examen tiene una tabla equivalente en *Ver datos de la
gráfica*. Las barras por área son HTML con el dato escrito, así que no la necesitan.

Los títulos de examen se toman del catálogo, así que un cambio de nombre no deja el
historial con dos nombres.

---

## 6. Accesibilidad, interfaz y celular

| Requisito | Cómo se cumple |
|---|---|
| Teclado | Todo el flujo funciona sin ratón; foco siempre visible |
| Semántica | `fieldset`/`legend` por pregunta, `label` por opción, `aria-describedby` en textos de lectura |
| Color | Nunca es la única señal: acierto y error llevan texto |
| Anuncios | `polite` para copiado y guardado; `assertive` para pendientes y errores; el cronómetro no se anuncia |
| Movimiento | Se respeta `prefers-reduced-motion` |
| Impresión | Los resultados se imprimen sin navegación ni botones |

**En el celular**

- Barra fija del mismo alto en todas las pantallas (pestañas de ícono en el panel); objetivos táctiles de 44 px o más,
  también en los botones de ícono.
- Sin desplazamiento horizontal (probado a 300 y 375 px de ancho). La `legend` de cada
  pregunta flota para no dibujarse sobre el borde de su tarjeta, y los `fieldset` admiten
  encogerse (`min-width: 0`).
- Barra fija del examen con la salida siempre a mano; textos de lectura que se pueden
  ocultar; márgenes y rellenos reducidos para ganar espacio.
- Columnas secundarias de las tablas ocultas en pantallas estrechas.
- Márgenes de *safe area* para el notch del iPhone; selectores sin zoom en iOS.
- Manifiesto e íconos para instalarla en la pantalla de inicio. No funciona sin conexión
  (ver [decisiones.md](decisiones.md), D-12).

**Rendimiento.** El examen se dibuja una vez y solo se actualiza lo que cambia; 150
preguntas en una página no se repintan en cada respuesta.
