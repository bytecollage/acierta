# Pruebas

## 1. Automáticas

Corren en cada push, antes de publicar (`.github/workflows/pages.yml`). Si fallan, no se
publica.

| Comando | Qué comprueba |
|---|---|
| `node tools/validate-exams.js` | Los 10 exámenes pasan todas las validaciones de `grading.js` ([datos.md](datos.md) §5) |
| `node apps-script/test.js` | La API con los servicios de Google simulados: rechaza tokens inválidos o de otra aplicación; importa y reclama intentos por correo sin guardar correos; un estudiante no ve los intentos de otro; recalcula el número de intento por fecha; no duplica; rechaza datos inválidos y fórmulas; descarta campos desconocidos; aplica el límite de envíos |

---

## 2. Manuales

Antes de cada push con cambios en la app, en <http://localhost:8080>. Las marcadas con 📱
se prueban también a ancho de celular, ya sea con las herramientas de desarrollo o en un
teléfono real.

### Carga y sesión

| # | Prueba | Esperado |
|---|---|---|
| M-01 | Abrir la bienvenida y pulsar CONTINUAR | El panel aparece sin página en blanco; con caché, al instante y con «Actualizando tu historial…» |
| M-02 | Abrir el panel sin caché (navegador limpio, con sesión) | «Cargando tus exámenes…» y luego las pestañas con datos |
| M-03 | Iniciar y cerrar sesión desde el panel | Cambia el historial mostrado; al cerrar sesión se borra la caché |
| M-04 | Terminar un examen sin sesión y luego iniciar sesión | El resultado dice «guardado en este navegador» y después pasa a «guardado en tu cuenta» |
| M-05 | Simular un script que no carga | «No se pudo cargar la aplicación…» con **Reintentar** |

### Panel y navegación 📱

| # | Prueba | Esperado |
|---|---|---|
| M-06 | Revisar las tres pestañas | Contadores correctos; Exámenes sin terminados; Completados con último resultado, intentos y mejor resultado |
| M-07 | Empezar un examen, responder 3 y pulsar «atrás» | Regresa a Exámenes; la tarjeta dice «Sin terminar · 3 de N» |
| M-08 | Continuar ese intento | Recupera las 3 respuestas y el tiempo acumulado |
| M-09 | Ver resultados desde Completados y pulsar «atrás» | Regresa a Completados |
| M-10 | Recargar en `#completados` y en `#examen/<id>` sin intento | Se queda en Completados; la segunda lleva a Exámenes |

### Examen

| # | Prueba | Esperado |
|---|---|---|
| M-11 | Responder todo menos la 10 y terminar | No se carga `answers.json` (pestaña de red); `Falta 1 pregunta: 10`; foco en la 10; el cronómetro sigue |
| M-12 | Responder todo y terminar | Corrección, resultados y cadena con `questionCount` letras precedidas de los minutos |
| M-13 | Elegir a propósito una incorrecta | Roja con «Tu respuesta» y la correcta verde con «Respuesta correcta»; se distinguen en escala de grises |
| M-14 | Intentar cambiar una respuesta ya corregida | Opciones deshabilitadas |
| M-15 | Bloque de lectura 📱 | El texto aparece una vez y se puede ocultar en el celular; cada pregunta lo referencia con `aria-describedby` |
| M-16 | Durante el examen | El tema no aparece ni está en el DOM; aparece al corregir |

### Tiempo y cadena

| # | Prueba | Esperado |
|---|---|---|
| M-17 | Cambiar de pestaña 3 minutos | El cronómetro no avanzó |
| M-18 | No tocar nada 7 minutos | Se pausa a los 5 y se reanuda al interactuar |
| M-19 | Responder en desorden | La cadena sigue el orden de `id` |
| M-20 | «Copiar resumen» en N1E01 y en N0E01 | Solo N0E01 incluye la nota de clave desbalanceada |

### Mi progreso

| # | Prueba | Esperado |
|---|---|---|
| M-21 | Sin historial | Estado vacío explicativo, sin gráficas vacías |
| M-22 | Con un solo intento | Métricas sin gráfica de evolución, con la nota de que hacen falta dos |
| M-23 | Repetir un examen | Punto hueco en la gráfica; no entra en temas a reforzar salvo con *Incluir repeticiones*, que muestra el aviso |
| M-24 | Temas con una sola pregunta | Van a «muestra insuficiente», nunca a «Recomendado estudiar» |
| M-25 | Cada gráfica | Tiene su tabla en *Ver datos de la gráfica* |

### Errores en los datos

| # | Prueba | Esperado |
|---|---|---|
| M-26 | Quitar una respuesta de `answers.json` y terminar | Error que nombra el `id`; no se corrige ni se guarda nada |
| M-27 | Poner un `questionCount` incorrecto en el catálogo | Error al abrir el examen, indicando el desajuste |

### Accesibilidad

| # | Prueba | Esperado |
|---|---|---|
| M-28 | Hacer un examen completo solo con teclado | Se puede responder, terminar y copiar; el foco siempre se ve |
