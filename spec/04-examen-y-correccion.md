# 04 — Examen y corrección

## 1. Presentación

Todas las preguntas en una sola página, agrupadas por área, respetando el orden de
`exam.areas` y el orden de `id` dentro de cada área.

Cada área abre con un encabezado que indica su nombre y cuántas preguntas contiene.

### 1.1 Pregunta individual

Cada reactivo DEBE incluir:

- **número** de pregunta (su `id`);
- **enunciado**;
- **opciones A / B / C** como radio buttons;
- semántica accesible: `fieldset` + `legend` para la pregunta, `label` asociado a cada
  `input[type=radio]`.

**No** mostrar la respuesta correcta antes de finalizar.

**No mostrar el `topic` durante el examen.** La etiqueta del tema delata de qué trata la
pregunta y funciona como pista: saber que un reactivo es de «Método científico» acota la
respuesta antes de leer las opciones. El campo tampoco debe estar presente en el DOM
durante el intento; se inyecta al corregir (sección 4).

### 1.2 Bloques con texto compartido

Las preguntas que comparten `stimulusId` se renderizan como un **bloque visual único**:

```text
┌──────────────────────────────────────────────┐
│ Lee el texto:                                │
│                                              │
│ Durante muchos años se pensó que estudiar…   │   ← el estímulo, una sola vez
│                                              │
├──────────────────────────────────────────────┤
│ 16. ¿Cuál es la idea principal?              │
│     ○ A  ○ B  ○ C                            │
│ 17. Según el texto anterior, recuperar…      │
│     ○ A  ○ B  ○ C                            │
│ … hasta la 20                                │
└──────────────────────────────────────────────┘
```

Requisitos:

- El estímulo aparece **una sola vez**, encima de la primera pregunta del bloque.
- El bloque DEBE distinguirse visualmente (borde, fondo suave o ambos).
- En escritorio, el texto DEBERÍA quedar **sticky** dentro del bloque mientras se hace
  scroll por sus preguntas, de modo que el estudiante no tenga que subir a releerlo.
- En móvil, el texto DEBERÍA ser **colapsable** con un control *Ver texto / Ocultar texto*,
  abierto por defecto, para que las preguntas no queden a varias pantallas de distancia.
- El estímulo DEBE asociarse a sus preguntas con `aria-describedby` para lectores de
  pantalla.

## 2. Progreso

Visible de forma permanente:

```text
Respondidas: 42 / 80
```

Acompañado de una barra de progreso. Al seleccionar cualquier respuesta, el contador y la
barra se actualizan **inmediatamente**.

La navegación rápida por áreas DEBE indicar cuántas preguntas quedan pendientes en cada
área, por ejemplo `Pensamiento matemático (3 pendientes)`.

## 3. Botón `Terminar`

Aparece al final del examen.

Al pulsarlo, **antes de cargar la clave**, verificar que todas las preguntas estén
respondidas.

### 3.1 Si faltan preguntas

- **No corregir.** No cargar `answers.json`.
- No mostrar ningún resultado.
- Resaltar visualmente las preguntas pendientes.
- Mostrar el mensaje con sus números:
  `Faltan 4 preguntas: 12, 37, 54 y 91`
  (lista separada por comas y la última con «y»).
- Hacer scroll hasta la primera pendiente y darle foco.
- Conservar todas las respuestas ya seleccionadas.
- El mensaje DEBE anunciarse por `aria-live="assertive"`.
- El cronómetro **sigue corriendo**.

### 3.2 Si está completo

1. Detener el cronómetro.
2. Cargar `answers.json`.
3. Validar la clave (`02-modelo-de-datos.md`, sección 5.3).
4. Corregir.
5. Guardar el intento en el historial.
6. Mostrar la pantalla de resultados.

Si la validación de la clave falla, **no corregir nada**: mostrar el error técnico y dejar
el intento intacto y sin terminar, con el cronómetro detenido.

## 4. Corrección visual

Una vez corregido, cada pregunta muestra:

| Caso | Presentación |
|---|---|
| Opción correcta seleccionada | Fondo verde suave + etiqueta textual `Correcta` |
| Opción incorrecta seleccionada | Fondo rojo suave + etiqueta textual `Tu respuesta` |
| Opción correcta no seleccionada, en pregunta fallada | Fondo verde suave + etiqueta `Respuesta correcta` |

**No depender solo del color.** Toda señal cromática DEBE ir acompañada de texto y, si se
usa, de un icono con `aria-hidden="true"` y el texto real accesible.

Cada pregunta DEBE mostrar ahora su `topic`, que se inyecta en este momento, para que el
estudiante identifique qué concepto falló. Durante el examen no existía en el DOM
(sección 1.1).

### 4.1 Estado tras corregir

- Deshabilitar **todos** los radio buttons.
- Bloquear el intento: no se puede cambiar ninguna respuesta.
- Deshabilitar u ocultar `Terminar`.
- Ofrecer **Reiniciar examen**, con confirmación previa.

## 5. Reiniciar examen

- DEBE pedir confirmación explícita antes de actuar.
- Borra el intento en curso de `localStorage` (respuestas, tiempo, estado).
- **No** borra el historial de intentos terminados.
- Devuelve al estudiante a la pantalla de inicio.
