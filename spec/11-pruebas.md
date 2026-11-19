# 11 — Pruebas mínimas obligatorias

La v1 no se considera terminada hasta que las 27 pruebas pasan. Son manuales salvo que se
decida automatizarlas.

---

## Flujo del examen

### P-01 · Pantalla de inicio
Abrir la aplicación sin datos previos.

**Esperado:** se ve la pantalla de inicio con instrucciones y una tarjeta por examen, con
título, número de preguntas y áreas. El enlace al dashboard aparece deshabilitado.

### P-02 · Intento incompleto
Responder todas menos la 10 y pulsar `Terminar`.

**Esperado:** no se corrige; no se carga `answers.json` (comprobar en la pestaña de red);
se resalta la 10; aparece `Falta 1 pregunta: 10`; hay scroll y foco en la 10; las demás
respuestas se conservan; el cronómetro sigue corriendo.

### P-03 · Intento completo
Responder todas y terminar.

**Esperado:** corrección, puntuación, resultados por área y por tema, cadena con longitud
`questionCount` precedida de los minutos.

### P-04 · Corrección visual
Elegir deliberadamente una opción incorrecta.

**Esperado:** la seleccionada en rojo con el texto `Tu respuesta`; la correcta en verde con
`Respuesta correcta`. Ambas etiquetas legibles con el color desactivado.

### P-05 · Bloqueo tras corregir
Tras corregir, intentar cambiar una respuesta.

**Esperado:** todos los radios deshabilitados; `Terminar` oculto o deshabilitado; aparece
`Reiniciar examen`.

---

## Estímulos

### P-06 · Texto compartido se muestra una vez
Ir al bloque de comprensión lectora.

**Esperado:** el pasaje aparece una sola vez, encima de la primera pregunta del bloque, y
las preguntas del bloque están visualmente agrupadas con él.

### P-07 · Bloques de inglés correctos
Revisar el bloque de inglés de `diagnostico-1`.

**Esperado:** el texto cubre **solo** las preguntas 71, 72 y 73. Las preguntas 74 en
adelante están fuera del bloque. (En `diagnostico-2`: 91, 92 y 93.)

### P-08 · Estímulo accesible
Navegar el bloque con lector de pantalla o inspeccionar el DOM.

**Esperado:** cada pregunta del bloque referencia el texto mediante `aria-describedby`.

---

## Tiempo y cadena

### P-09 · Cadena exacta
Con un examen ficticio de 9 preguntas, responder `A B A A B C C A B` y tardar ~35 minutos.

**Esperado:** exactamente `35ABAABCCAB`. Sin espacios ni separadores.

### P-10 · La cadena se ordena por id
Responder las preguntas en orden desordenado (por ejemplo, empezando por la última).

**Esperado:** la cadena refleja el orden de `id`, no el orden en que se respondió.

### P-11 · Pausa por pestaña oculta
Iniciar el examen, cambiar de pestaña 3 minutos, volver.

**Esperado:** el cronómetro no avanzó durante esos 3 minutos.

### P-12 · Pausa por inactividad
Iniciar el examen y no tocar nada durante 7 minutos.

**Esperado:** el cronómetro se detiene a los 5 minutos y se reanuda al interactuar. El
tiempo acumulado no incluye los 2 minutos restantes.

### P-13 · Tiempo tras reanudar
Responder 10 preguntas durante ~4 minutos, recargar, continuar.

**Esperado:** el cronómetro continúa desde ~4 minutos. **No** se reinicia ni salta al
tiempo de reloj transcurrido.

---

## Persistencia

### P-14 · Recarga durante el examen
Responder 10 preguntas y recargar.

**Esperado:** se recuperan exactamente esas 10 respuestas, el progreso y el tiempo.

### P-15 · Recarga tras corregir
Corregir un examen y recargar.

**Esperado:** se restaura la pantalla de resultados, no el examen en blanco.

### P-16 · Reiniciar conserva el historial
Completar un examen, reiniciarlo y abrir el dashboard.

**Esperado:** el intento sigue en el historial; el dashboard lo muestra.

---

## Errores en los datos

### P-17 · Clave incompleta
Eliminar una entrada de `answers.json` y terminar un examen.

**Esperado:** error claro identificando el `id` que falta. **No** se corrige parcialmente ni
se guarda nada en el historial.

### P-18 · Catálogo desincronizado
Cambiar `questionCount` en `exams.json` a un valor incorrecto.

**Esperado:** error al cargar el examen, indicando el desajuste entre catálogo y archivo.

### P-19 · Estímulo huérfano
Poner un `stimulusId` que no existe en `stimuli`.

**Esperado:** error de validación al cargar, señalando la pregunta.

---

## Dashboard

### P-20 · Estado vacío
Abrir `dashboard.html` sin historial.

**Esperado:** mensaje explicativo y enlace al examen. Sin gráficas vacías ni ceros.

### P-21 · Un solo intento
Completar un examen y abrir el dashboard.

**Esperado:** métricas del intento, **sin** gráfica de evolución, con la nota de que hacen
falta al menos dos.

### P-22 · No recomendar con muestra insuficiente
Con un único intento, revisar la tabla de temas.

**Esperado:** los temas de una sola pregunta aparecen en la sección colapsada de muestra
insuficiente y **no** en «Recomendado estudiar».

### P-23 · Repeticiones diferenciadas
Repetir el mismo examen y abrir el dashboard.

**Esperado:** el segundo intento se dibuja con punto hueco; por defecto no entra en la tabla
de temas a reforzar; al activar *Incluir repeticiones* aparece el aviso de memorización.

### P-24 · Umbral de azar visible
Abrir la gráfica de evolución.

**Esperado:** línea de referencia al 49% etiquetada como «responder siempre la misma letra».

### P-25 · Alternativa textual
Buscar la tabla equivalente de cada gráfica.

**Esperado:** existe y contiene los mismos datos.

---

## Accesibilidad

### P-26 · Solo teclado
Completar un examen entero sin usar el ratón.

**Esperado:** se puede seleccionar cada opción, llegar a `Terminar`, corregir y copiar la
cadena. El foco siempre es visible.

### P-27 · Sin color
Ver los resultados con los colores desactivados (filtro de escala de grises).

**Esperado:** sigue siendo posible distinguir correcta, incorrecta y respuesta del
estudiante, por el texto.
