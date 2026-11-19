# Acierta — exámenes diagnósticos

Aplicación web para aplicar exámenes diagnósticos, corregirlos y seguir la evolución del
estudiante. Sitio estático sin dependencias; el historial de cada estudiante se guarda en
Google Sheets.

Implementa la especificación de [`../spec/`](../spec/README.md).

---

## Publicación

La app se publica en GitHub Pages: <https://ycaceres.github.io/exani/>. Cada push a `main`
ejecuta `.github/workflows/pages.yml`, que valida los exámenes, prueba el Apps Script y
publica esta carpeta (sin `server.py`).

El historial de cada estudiante se guarda en Google Sheets, detrás de un Apps Script, y el
estudiante inicia sesión con Google. Configuración y despliegue en
[`../apps-script/README.md`](../apps-script/README.md); diseño en
[`../spec/08-persistencia.md`](../spec/08-persistencia.md).

| Archivo | Función |
|---|---|
| `js/config.js` | URL `/exec` de la API y client ID de OAuth (públicos) |
| `js/auth.js` | Inicio de sesión con Google Identity Services |
| `js/storage.js` | Historial remoto, cola local de intentos sin subir e intento en curso |

## Desarrollo local

```bash
cd web
python3 server.py        # http://localhost:8080
```

`server.py` solo sirve archivos estáticos y desactiva la caché. Usa el puerto 8080: es el
que está autorizado para iniciar sesión con Google. Con `js/config.js` vacío, la app
funciona en modo local y guarda el historial solo en el navegador.

## Estructura

```text
web/
├── index.html          Bienvenida (instrucciones + CONTINUAR)
├── panel.html          Pestañas Exámenes / Completados / Mi progreso, examen y resultados
├── dashboard.html      Redirige a panel.html#progreso
├── privacidad.html     Aviso de privacidad
├── manifest.webmanifest, icons/   Instalación en la pantalla de inicio del móvil
├── styles.css
├── js/
│   ├── config.js       URL de la API y client ID de Google
│   ├── auth.js         Inicio de sesión con Google
│   ├── storage.js      Historial, cola local e intento en curso
│   ├── grading.js      Validación de datos y corrección (sin DOM)
│   ├── charts.js       Gráficas SVG
│   ├── app.js          Flujo del examen
│   └── dashboard.js    Lógica del dashboard
└── data/
    ├── exams.json
    └── diagnostico-1 … diagnostico-10/{questions,answers}.json
```

---

## Añadir un examen nuevo

No hay que tocar ningún archivo `.js`.

1. Crear `data/mi-examen/questions.json` y `data/mi-examen/answers.json`.
2. Añadir una entrada a `data/exams.json`:

```json
{
  "id": "mi-examen",
  "title": "Mi examen",
  "version": "2.0",
  "questionCount": 50,
  "estimatedMinutes": 40,
  "questions": "mi-examen/questions.json",
  "answers": "mi-examen/answers.json"
}
```

La aplicación valida los datos al cargarlos y, si algo no cuadra, se detiene con un mensaje
que indica el archivo y la pregunta concretos. Es deliberado: es mejor un error claro que un
examen corregido a medias.

---

## Formato de los datos

### `questions.json`

```json
{
  "exam": {
    "id": "mi-examen",
    "title": "Mi examen",
    "version": "2.0",
    "questionCount": 50,
    "areas": [ { "name": "Matemáticas", "start": 1, "end": 25 } ]
  },
  "stimuli": [
    { "id": "cl-1", "area": "Comprensión lectora",
      "instruction": "Lee el texto:", "text": "El pasaje completo…" }
  ],
  "questions": [
    { "id": 1, "area": "Matemáticas", "topic": "Porcentajes",
      "text": "¿Cuánto es el 20% de 50?",
      "options": { "A": "5", "B": "10", "C": "15" } }
  ]
}
```

**Textos compartidos.** Cuando varias preguntas dependen de un mismo texto de lectura, el
texto va en `stimuli` y cada pregunta lo referencia con `stimulusId`. Las preguntas que
comparten estímulo deben ser **contiguas** en `id`. La aplicación las agrupa visualmente y
muestra el texto una sola vez.

### `answers.json`

```json
{
  "examId": "mi-examen",
  "version": "2.0",
  "answers": [ { "id": 1, "correctAnswer": "B" } ]
}
```

Se carga **solo al pulsar «Terminar»**. Como la aplicación es estática, cualquiera puede
leerla con las herramientas de desarrollo: la carga tardía es una comodidad, no una medida
de seguridad.

---

## Cadena de respuestas

Al terminar se genera una cadena como:

```text
35ABAABCCAB
```

El número inicial son los **minutos** y las letras las **respuestas ordenadas por `id`**.
Se puede interpretar con `/^(\d+)([ABC]+)$/`: el número es todo lo anterior a la primera
letra.

El tiempo que se mide es **activo**: se pausa al cambiar de pestaña y tras 5 minutos de
inactividad. Así un examen retomado al día siguiente no registra 1.440 minutos.

El botón **Copiar resumen** genera un bloque de texto pensado para pegárselo a un agente de
IA, con el resultado por área, los temas fallados y una nota sobre el sesgo de la clave.

---

## Dashboard

`dashboard.html` lee únicamente el historial de `localStorage`. Muestra la evolución del
resultado, el rendimiento por área y la tabla de temas a reforzar.

Tres decisiones que conviene conocer, todas documentadas en
[`../spec/07-dashboard.md`](../spec/07-dashboard.md):

- **Los temas se agregan cruzando exámenes.** Cada examen por separado tiene ~1,2 preguntas
  por tema; agregados, algunos temas llegan a 5-8 observaciones, que ya es una muestra
  legible.
- **Solo se recomienda estudiar** temas con al menos 3 observaciones y menos del 60% de
  acierto. Los de muestra menor aparecen en una sección aparte, porque un `0/1` no
  distingue una laguna de un descuido.
- **Por defecto solo se usan los primeros intentos.** Repetir el mismo examen mide en parte
  memoria; hay un interruptor para incluir repeticiones, con su aviso.

---

## Almacenamiento

| Qué | Dónde | Por qué |
|---|---|---|
| **Historial de intentos** | Google Sheets, por estudiante | Es el dato valioso: debe sobrevivir a cambios de navegador y de equipo |
| **Intentos sin subir** | `localStorage` (`exani.pending`) | Sin sesión o sin red, el intento espera aquí y se sube después |
| **Intento en curso** | `localStorage` (`exani.attempt.<examId>.v<version>`) | Es efímero y por dispositivo; no merece un viaje al servidor en cada respuesta |

Consecuencia práctica: si empiezas un examen y lo retomas desde **otro navegador**,
el progreso a medias no viaja, pero el resultado final sí queda en tu cuenta.

### Cargar intentos antiguos

`tools/import-history.js` carga un archivo con intentos (el formato de
`data/historial.json`) reservados para el correo de un estudiante. Pasan a su cuenta la
primera vez que inicia sesión con ese correo.

---

## Limitaciones conocidas

Están documentadas con detalle en
[`../spec/10-decisiones-y-riesgos.md`](../spec/10-decisiones-y-riesgos.md). Las dos que más
afectan a la interpretación de resultados:

- **La clave de respuestas está desbalanceada.** Responder siempre la misma letra produce
  ~49% en ambos exámenes, no el 33% del azar. La aplicación muestra esa referencia junto al
  resultado y en el dashboard, y la incluye en el resumen copiable.
- **`topic` es muy granular** (~1,2 preguntas por tema). El dashboard lo compensa agregando
  y exigiendo muestra mínima, pero un nivel intermedio `subarea` daría recomendaciones
  bastante mejores. El campo ya está previsto como opcional en el modelo de datos.
