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
| `index.html` | **Bienvenida**: nombre e ícono, inicio de sesión, cuadro «Antes de empezar» y botón **CONTINUAR** |
| `panel.html` | **Panel** con tres pestañas, más las pantallas de examen y resultados |

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

**Pestañas del panel**

| Pestaña | Muestra |
|---|---|
| **EXÁMENES** | Exámenes sin ningún intento terminado: *Comenzar*, o *Continuar* / *Comenzar de nuevo* si hay uno a medias |
| **COMPLETADOS** | Exámenes con al menos un intento terminado, el más reciente primero: último resultado, intentos, mejor resultado. *Ver resultados* y *Volver a intentarlo* (o *Continuar intento*) |
| **MI PROGRESO** | Evolución y temas a reforzar (§5) |

Cada pestaña muestra cuántos exámenes contiene.

**Navegación por hash.** Cada vista tiene su URL: `#examenes`, `#completados`,
`#progreso`, `#examen/<id>`, `#resultados/<id>`. El botón «atrás» del celular regresa del
examen a las pestañas. Salir del examen (atrás, «← Mis exámenes» o una pestaña) guarda el
intento y detiene el cronómetro. Recargar `#examen/<id>` sin intento guardado lleva a
EXÁMENES en lugar de crear uno.

**Esperas visibles.** «Cargando tus exámenes…» mientras llegan los datos, «Actualizando tu
historial…» al refrescar desde la caché, «Cargando examen…» al abrirlo y «Corrigiendo y
guardando tu resultado…» al terminar.

---

## 2. Examen

Todas las preguntas en una sola página, agrupadas por área en el orden de `exam.areas`.

- **Barra fija** con `Respondidas: 42 / 150`, barra de progreso y cronómetro.
- **Navegación por áreas** con las pendientes de cada una, por ejemplo
  `Pensamiento matemático (3)`.
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

Toda señal de color lleva texto. Tras corregir se muestra el tema de cada pregunta y se
deshabilitan todas las opciones.

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
35AABCCBABBA
│ └────────── una letra por pregunta, ordenadas por id
└──────────── minutos activos, redondeados; mínimo 1
```

Sin separadores, en mayúsculas, siempre con `questionCount` letras y ordenada por `id`,
nunca por orden visual. Se lee con `/^(\d+)([ABC]+)$/`. La cadena basta para reconstruir
la corrección completa junto con `answers.json`.

---

## 4. Resultados

- **Global:** aciertos, porcentaje, correctas, incorrectas y tiempo.
- **Referencia de azar:** «responder al azar produciría ~33 %; en este examen, responder
  siempre "A" produce 49 %». En N0E01 y N0E02 la clave está desbalanceada y esta línea es
  la que evita leer un 49 % como «casi la mitad bien».
- **Por área**, en el orden del examen, con barra.
- **Por tema**, en una sección cerrada por defecto: conteo absoluto, aviso de muestra
  mínima cuando hay una sola pregunta y orden con los fallados primero. Abre con una nota:
  un fallo aislado no indica una laguna.
- **Cadena** con botones *Copiar respuestas* y *Copiar resumen*. El resumen está pensado
  para pegarlo a un asistente de IA: examen, fecha, tiempos, resultado, áreas y temas
  fallados. Si la clave está desbalanceada, añade una nota que lo explica.
- **Dónde quedó guardado:** «en tu cuenta», o «en este navegador» con la opción de iniciar
  sesión para subirlo.

---

## 5. Mi progreso

Responde dos preguntas, sin esconder las limitaciones de los datos: **¿estoy mejorando?** y
**¿qué temas estudio?**

| Sección | Contenido |
|---|---|
| Resumen | Exámenes completados, mejor resultado, último resultado y su cambio frente al anterior del mismo examen, tiempo medio de intentos comparables |
| Evolución | Una línea por examen; punto relleno para el primer intento y hueco para repeticiones; línea punteada en la referencia de azar de cada examen. Con un solo intento, en su lugar se pide hacer al menos dos |
| Rendimiento por área | Acumulado de los intentos del filtro |
| Temas a reforzar | Tabla agregada **cruzando exámenes**: aciertos, %, observaciones, tendencia (↑ → ↓, con 6 o más observaciones) y confianza (alta ≥ 6, media 3–5, baja < 3) |

Reglas de los temas:

- Ordenados por peor porcentaje, pero solo entre los de confianza alta y media. Los de
  confianza baja van en una sección aparte, cerrada.
- **«Recomendado estudiar»** solo incluye temas con al menos 3 observaciones y menos de
  60 % de aciertos. Si ninguno cumple, se dice así, sin rellenar con temas de una pregunta.
- Por defecto se usan **solo primeros intentos**: repetir un examen mide en parte memoria.
  El interruptor *Incluir repeticiones* las suma y muestra un aviso.

Filtros por examen y por área. Cada gráfica tiene una tabla equivalente en *Ver datos de la
gráfica*. Los títulos de examen se toman del catálogo, así que un cambio de nombre no deja
el historial con dos nombres.

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

- Pestañas fijas arriba al desplazarse; objetivos táctiles de 44 px o más.
- Sin desplazamiento horizontal (probado a 375 px de ancho).
- Áreas del examen en una fila deslizable; textos de lectura que se pueden ocultar.
- Columnas secundarias de las tablas ocultas en pantallas estrechas.
- Márgenes de *safe area* para el notch del iPhone; selectores sin zoom en iOS.
- Manifiesto e íconos para instalarla en la pantalla de inicio. No funciona sin conexión
  (ver [decisiones.md](decisiones.md), D-12).

**Rendimiento.** El examen se dibuja una vez y solo se actualiza lo que cambia; 150
preguntas en una página no se repintan en cada respuesta.
