# Decisiones y riesgos

Por qué Acierta está hecha así, y lo que sigue abierto. Cada decisión lleva su motivo para
que dentro de seis meses se entienda.

**Resumen**

| # | Decisión | Estado |
|---|---|---|
| D-01 | Textos de lectura como estímulos independientes | Vigente |
| D-02 | No rebalancear la clave de N0E01 y N0E02; hacer visible el sesgo | Vigente |
| D-03 | El catálogo trae título y número de preguntas | Vigente |
| D-04 | Se mide tiempo activo, no de reloj | Vigente |
| D-05 | Un intento corregido se restaura al recargar | Vigente |
| D-06 | Reiniciar un examen no borra el historial | Vigente (ver D-11: no se borra nada) |
| D-07 | Los datos viven en `web/data/` | Vigente |
| D-08 | El tema no se muestra durante el examen | Vigente |
| D-09 | Historial en `data/historial.json` con `server.py` | **Sustituida por D-11** |
| D-10 | Exámenes N1 con la estructura oficial | Vigente |
| D-11 | App pública en GitHub Pages, historial en Google Sheets, inicio de sesión con Google | Vigente |
| D-12 | Bienvenida + panel con pestañas; uso en celular; nombre e ícono | Vigente (interfaz revisada en D-13) |
| D-13 | Interfaz compacta para celular; Mi progreso de un vistazo; cadena con código | Vigente |

---

## D-01 · Textos de lectura como estímulos independientes

**Problema.** Los pasajes de lectura venían incrustados en el enunciado de la primera
pregunta de cada bloque: la pregunta 17 decía «Según el texto anterior…» sin contener el
texto. En el celular obligaba a subir varias preguntas para releer, impedía aleatorizar por
bloques y contaminaba el análisis por tema (un pasaje de 626 caracteres contaba como
enunciado).

**Decisión.** Los textos van en `stimuli` y las preguntas los referencian con
`stimulusId`. La extracción de los datos originales fue mecánica: todos seguían el patrón
`"Lee el texto:\n\n<PASAJE>\n\n<PREGUNTA>"`.

## D-02 · Clave desbalanceada en N0E01 y N0E02: se muestra, no se corrige

**Hallazgo.** En N0E01 (A 39 · B 33 · C 8) y N0E02 (A 47 · B 49 · C 4), marcar siempre la
misma letra da **49 %**. En Redacción indirecta e Inglés, la C nunca es correcta; en N0E02
la correcta es la opción más larga la mitad de las veces.

**Decisión.** No rebalancear esos dos exámenes. A cambio, el sesgo se hace visible en la línea
punteada de la gráfica de evolución por examen (pantalla Reporte detallado). Hasta
el 2026-11-19 también aparecía en la pantalla de resultados y en un resumen copiable; se
quitaron al simplificar esa pantalla.
Sin ellas, un 48 % se lee como «casi la mitad» cuando equivale a marcar siempre la misma
letra. N0E03 en adelante tienen la clave repartida.

## D-03 · El catálogo trae título y número de preguntas

El panel necesita esos datos para pintar las pestañas, y descargar todos los exámenes solo
para eso sería desproporcionado. La duplicación se controla validando al abrir cada examen
que catálogo y archivo coinciden.

## D-04 · Tiempo activo

Se pausa con la pestaña oculta y tras 5 minutos sin interacción. Si el estudiante deja el
examen y vuelve al día siguiente, el reloj de pared diría 1 440 minutos y arruinaría las
estadísticas. Se guardan ambos tiempos para detectar intentos partidos.

## D-05 · Restaurar el intento corregido

Al recargar con un intento corregido se muestran sus resultados, no el examen en blanco.

## D-06 · Reiniciar no borra el historial

*Comenzar de nuevo* borra solo el intento en curso. Desde D-11 la app no tiene ninguna
forma de borrar historial.

## D-07 · Los datos en `web/data/`

Los datos originales estaban en `app_idea/`; se movieron a `data/`. La carpeta se
conserva como archivo histórico en `docs/app_idea/`: la idea inicial del proyecto y los
dos primeros exámenes en su formato 1.0. La app no la usa.

## D-08 · El tema no se muestra durante el examen

La etiqueta del tema («Método científico») acota la respuesta antes de leer las opciones.
No se dibuja ni está en el DOM durante el intento; aparece al corregir, donde sirve para
saber qué concepto falló. Las áreas sí se muestran: son la estructura del examen, como en
el EXANI real.

## D-09 · Historial en un archivo del proyecto (sustituida)

Entre septiembre y noviembre de 2026, `server.py` guardaba el historial en
`data/historial.json`, porque `localStorage` se pierde al cambiar de puerto, de navegador o
al limpiar datos. **Lección:** cuando la app se sirvió con `python3 -m http.server`, los
intentos quedaron solo en el navegador y hubo que recuperarlos a mano. D-11 sustituye
esta decisión.

## D-10 · Exámenes N1 con la estructura oficial

**Motivo.** Con 96 % en tres diagnósticos seguidos, el nivel 0 ya no distinguía qué faltaba
por aprender.

**Decisión.** Cinco exámenes de 150 preguntas con la proporción oficial (PC 28 · CL 28 ·
RI 28 · PM 38 · Inglés 28), subáreas oficiales, clave 50/50/50 sin rachas de más de 3,
respuestas numéricas comprobadas al generar y sin que la correcta sea sistemáticamente la
más larga. Se generan con `tools/exam-builder`.

**Riesgo asumido:** ver R-07.

## D-11 · App pública con historial en Google Sheets

**Motivo.** Varios estudiantes deben poder usarla desde la web. GitHub Pages solo sirve
archivos estáticos.

**Decisión.**

- **Hosting:** GitHub Pages, repo público `bytecollage/acierta` (transferido desde
  `ycaceres/exani` el 2026-11-19).
- **Historial:** Google Sheets detrás de un Apps Script. La API solo permite leer y añadir:
  **no hay edición ni borrado**.
- **Identidad:** inicio de sesión con Google; el estudiante se guarda como un hash, sin
  correo ni nombre. El identificador es opaco, así que se pueden añadir otros proveedores
  sin cambiar el modelo.
- **Sin pérdida de intentos:** todo intento pasa por una cola local antes de subirse.
- **Claves públicas:** se acepta. Es una herramienta de estudio y cada quien decide cómo
  usarla.
- **`server.py`** queda como servidor estático de desarrollo.

**Riesgos asumidos.**

- El límite de 20 intentos por examen desaparece porque implicaba borrar. Lo sustituyen
  200 por examen y estudiante, y 30 envíos cada 10 minutos.
- Cualquier cuenta de Google puede escribir sus propios intentos; nadie puede leer ni
  escribir los de otro.
- Cada llamada al Apps Script tarda de 0,5 a 3 s. La carga anticipada y la caché lo
  ocultan casi siempre.
- El intento en curso es por navegador, no por cuenta: dos estudiantes en el mismo
  navegador comparten intentos sin terminar.

## D-12 · Bienvenida, panel y celular

- `index.html` es la bienvenida, con las instrucciones y **CONTINUAR**. `panel.html` reúne
  las pestañas, el examen y los resultados, y navega por hash para que el botón «atrás»
  del celular funcione.
- **Sin *service worker*:** la app no funciona sin conexión. Es a propósito: una caché
  desactualizada podría servir exámenes o claves viejas.
- **Nombre:** Acierta, con «Exámenes diagnósticos» de subtítulo.
- **Ícono:** hoja de respuestas con tres círculos (A, B, C), el del centro relleno en
  verde y palomeado. Fuente en `web/icons/icon.svg`; los PNG se generan con `sips` de
  macOS: 192 y 512 redondeados, 512 *maskable* con el dibujo al 80 % para la zona segura
  de Android, y 180 cuadrado para iOS.
- **Nombres de examen:** «Examen Diagnóstico N<nivel>E<examen>». El `id` no cambia; los
  títulos de la hoja se migraron una vez desde el `id`.

## D-13 · Interfaz compacta, Mi progreso de un vistazo y cadena con código

**Problema.** En el celular había elementos cortados y scroll horizontal (una pestaña más
ancha que su columna; la `legend` de cada pregunta dibujada sobre el borde de su tarjeta),
las tarjetas ocupaban mucho, salir del examen obligaba a subir hasta arriba y Mi progreso
mostraba demasiado para leerlo de un vistazo.

**Decisión.**

- **Una barra fija igual en todas las pantallas** (56 px, mismos márgenes que el
  contenido): pestañas de ícono en el panel; ← y título en examen, resultados y reporte.
  En el examen el progreso es una línea en su borde inferior. Sin logo ni nombre en el
  panel; la cuenta va en un pie simétrico a la barra.
- **Filas compactas** con el título sin «Diagnóstico» y acciones de ícono (▶ ↻ 👁).
- **Resultados mínimos:** puntaje, barras por área y cadena. Se quitaron el detalle por
  tema, el resumen copiable y la referencia de azar (ver D-02).
- **Mi progreso de un vistazo:** puntuación /1000, puntos totales, una línea de avance,
  tarjetas de datos y barras por área. Lo demás va a la pantalla *Reporte detallado*.
- **Estilo con variables** (tamaños, radios, separaciones) para que todo sea homogéneo.
- **Cadena `<código>|<minutos>|<LETRAS>`:** identifica el examen sin depender de dónde se
  pegue. El código es el campo `code` del catálogo, no se deduce del título. Los intentos
  anteriores no se migran: app y Apps Script aceptan los dos formatos.

**Consecuencia.** El Apps Script debe publicarse (nueva versión de la implementación)
antes o junto con la web; mientras tanto, los resultados con el formato nuevo se rechazan y
quedan en la cola local hasta que el servidor los acepte.

---

## Riesgos abiertos

### R-01 · Los temas son demasiado finos para recomendar estudio · *parcialmente mitigado*

En los exámenes de nivel 0, el 81–83 % de los temas tiene una sola pregunta, y un `0/1` no
distingue una laguna de un descuido. En total hay **293 temas escritos a mano**, sin
catálogo, así que el mismo tema puede aparecer con dos nombres.

**Mitigado:** Mi progreso agrega cruzando exámenes, muestra el conteo absoluto, etiqueta la
confianza y solo recomienda temas con al menos 3 observaciones y menos de 60 %. Los N1
traen `subarea` (13 subáreas oficiales).

**Pendiente:** un catálogo único de temas y etiquetar con `subarea` los cinco exámenes de
nivel 0 (480 preguntas). Va junto con R-06.

### R-02 · Repetir un examen mide memoria · *mitigado*

Mi progreso separa primeros intentos de repeticiones y usa solo los primeros para
recomendar temas. La solución de fondo es un banco de preguntas con aleatorización.

### R-03 · Enunciados genéricos repetidos · *menor*

Siete preguntas de N0E01 y N0E02 dicen solo «Selecciona la opción correcta:». No afecta a la
corrección, pero dificulta identificarlas en el detalle por tema.

### R-04 · La clave es pública · *aceptado*

Ver D-11. Si algún día el examen tuviera valor de calificación, haría falta corregir en el
servidor.

### R-05 · Inglés cuenta en el puntaje de la app · *abierto*

En el EXANI-I oficial, Inglés es solo diagnóstico y no cuenta para el puntaje global. En
Acierta se suma al porcentaje como un área más, así que el resultado no es comparable uno a
uno con el oficial. Lo correcto sería mostrar el puntaje de las cuatro áreas que califican
y el de Inglés aparte.

### R-06 · El contenido no está en la base de datos · *propuesta en curso*

Los exámenes viven en JSON y en las fuentes de `exam-builder`; la hoja solo tiene
intentos. **Propuesta:** la hoja pasa a ser la fuente de exámenes, preguntas, temas, áreas
y dificultad, y un sync en GitHub Actions valida y genera los JSON, abriendo un Pull
Request para revisar antes de publicar. La app sigue leyendo archivos estáticos.

### R-07 · Las preguntas N1 no tienen revisión humana · *aceptado*

Las redactó un modelo de IA. La clave numérica está comprobada por código; las respuestas
conceptuales y de lectura, no. Si un resultado parece injusto, hay que revisar primero la
pregunta.

### R-08 · Marca y verificación · *abierto*

No se revisó si «Acierta» está registrado como marca. La marca en Google Cloud no está
verificada: el inicio de sesión funciona, pero Google puede no mostrar el nombre ni los
enlaces en su ventana hasta verificar el dominio `bytecollage.github.io` en Search Console.

### R-09 · Datos de prueba en la hoja de producción · *conocido*

Se copiaron los 6 intentos de un estudiante a la cuenta yander.caceres@gmail.com para
probar. Están en la misma hoja que los datos reales; si hace falta quitarlos, se borran a
mano.

---

## Historial

| Fecha | Cambio |
|---|---|
| 2026-11-19 | Interfaz compacta para celular, barra fija común, Mi progreso de un vistazo con Reporte detallado aparte y cadena con código del examen (D-13) |
| 2026-11-19 | Documentación consolidada en `docs/`; `app_idea/` pasa a `docs/app_idea/` como archivo histórico. Repo transferido a `bytecollage/acierta` |
| 2026-11-19 | Nombre Acierta e ícono; carga anticipada y caché del historial; exámenes nombrados por código (D-12) |
| 2026-11-19 | Bienvenida + panel con pestañas y ajustes para celular (D-12) |
| 2026-11-19 | App pública en GitHub Pages con historial en Google Sheets e inicio de sesión con Google (D-11) |
| 2026-10-21 | Exámenes N1 de 150 preguntas con `subarea`; resumen de la guía oficial (D-10) |
| 2026-09-17 | Historial en `data/historial.json` con `server.py` (D-09); el tema deja de verse durante el examen (D-08) |
| 2026-09-17 | Primera especificación consolidada, a partir de `app_idea/AGENT_IMPLEMENTATION_INSTRUCTIONS.md` |
