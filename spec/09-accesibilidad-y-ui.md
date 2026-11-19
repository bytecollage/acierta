# 09 — Accesibilidad e interfaz

## 1. Accesibilidad mínima obligatoria

| Requisito | Detalle |
|---|---|
| Radio + label | Cada opción es un `input[type=radio]` con su `label` asociado. El área clicable incluye el texto completo |
| Agrupación semántica | Cada pregunta en `fieldset` con `legend`; el enunciado va en la `legend` |
| Estímulos | El bloque de texto se asocia a sus preguntas con `aria-describedby` |
| Navegación por teclado | Todo el flujo se completa sin ratón: Tab, flechas entre radios de un grupo, Enter/Espacio en botones |
| Foco visible | Indicador de foco claro y con contraste suficiente. Nunca `outline: none` sin sustituto |
| Color no exclusivo | Acierto y error se comunican con **texto**, no solo con color de fondo |
| `aria-live` | Región `polite` para copiado y cambios de progreso; `assertive` para errores de validación y preguntas pendientes |
| Cronómetro | `aria-live="off"`: se puede consultar, pero no interrumpe la lectura |
| Contraste | Mínimo WCAG AA (4.5:1 en texto normal, 3:1 en texto grande) |
| Idioma | `<html lang="es">`. Las preguntas de inglés en `lang="en"` |

## 2. Responsive

### Escritorio

- Ancho de lectura cómodo: 70–80 caracteres por línea en los enunciados.
- Contenido centrado con márgenes generosos.
- Navegación por áreas **sticky** lateral o superior.
- Texto de los estímulos sticky dentro de su bloque.

### Móvil

- Una sola columna.
- Áreas táctiles grandes: mínimo 44 × 44 px por opción.
- Progreso y cronómetro siempre visibles (barra fija superior o inferior).
- Estímulos colapsables, abiertos por defecto.
- El botón `Terminar` no debe quedar tapado por barras fijas.

## 3. Interfaz

### 3.1 Principios

- Sobria y legible. El examen es la interfaz; todo lo demás es secundario.
- Sin animaciones que distraigan. Respetar `prefers-reduced-motion`.
- Nada de colores semafóricos sobre el resultado global (`06-resultados.md`).

### 3.2 Estados que DEBEN tener representación visual clara

- Pregunta sin responder.
- Pregunta respondida.
- Pregunta pendiente resaltada tras pulsar `Terminar` incompleto.
- Opción correcta / incorrecta tras corregir.
- Cronómetro en marcha / pausado.
- Examen bloqueado tras corregir.

### 3.3 Impresión

`@media print` DEBERÍA producir una versión legible de los resultados: sin navegación, sin
botones, evitando cortes dentro de una pregunta.

## 4. Rendimiento

- 100 preguntas en una sola página es mucho DOM. Renderizar **una vez** y actualizar solo
  lo que cambia; no repintar el examen completo en cada respuesta.
- Los archivos de datos se cargan una vez y se mantienen en memoria.
- `answers.json` se carga tarde, al pulsar `Terminar`.
