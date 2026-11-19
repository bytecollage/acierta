# 01 — Alcance y principios

## Objetivo

Permitir que un estudiante realice exámenes diagnósticos tipo UADY / EXANI-I, obtenga una
corrección inmediata y pueda seguir su progreso a lo largo del tiempo para decidir qué
temas estudiar.

El resultado debe poder exportarse como una cadena compacta que después se envía a un
agente de IA para una evaluación cualitativa más profunda.

## Principios de diseño

1. **Sitio estático, sin servidor propio.** La app se publica en GitHub Pages. El historial
   de cada estudiante vive en Google Sheets detrás de un Apps Script, y el estudiante se
   identifica con Google. Sin dependencias de JavaScript ni paso de compilación.
   *(Cambio respecto a D-09, que usaba `server.py` y `data/historial.json`. Ver D-11 en
   `10-decisiones-y-riesgos.md`.)*
2. **Los datos mandan.** Añadir un examen nuevo DEBE requerir únicamente archivos JSON
   nuevos y una entrada en `exams.json`. No se toca `app.js`.
3. **Sin frameworks.** HTML + CSS + JavaScript puro. No introducir dependencias salvo
   necesidad clara y justificada. Las gráficas se dibujan con SVG propio.
4. **La clave no es secreta.** La aplicación es estática: cualquiera con DevTools puede
   leer `answers.json`. No intentar ocultarla con Base64, minificación ni ofuscación. Lo
   único que se hace es **cargarla tarde** (al pulsar *Terminar*), para que no esté en
   memoria durante el examen.
5. **No juzgar al estudiante.** La aplicación no asigna etiquetas de aprobado/reprobado ni
   bueno/malo. Presenta números; la interpretación pedagógica ocurre fuera.
6. **Fallar en voz alta.** Ante datos inconsistentes, detener el flujo y mostrar un mensaje
   técnico legible. Nunca corregir parcialmente ni inventar valores por defecto.

## Alcance de la versión 1

| # | Capacidad |
|---|---|
| 1 | Pantalla de inicio con instrucciones y selección de examen |
| 2 | Examen en una sola página, agrupado por área, con textos de lectura compartidos |
| 3 | Progreso visible y persistente (historial por estudiante en Google Sheets; intento en curso en `localStorage`) |
| 4 | Medición del tiempo activo del examen |
| 5 | Validación de preguntas pendientes antes de corregir |
| 6 | Corrección visual accesible |
| 7 | Resultado global, por área y por tema |
| 8 | Cadena compacta `<minutos><LETRAS>` y resumen copiable |
| 9 | Historial local de intentos |
| 10 | Dashboard de evolución y temas a reforzar |

## Fuera de alcance de la versión 1

No implementar salvo que se acuerde explícitamente:

- Límite de tiempo o cuenta atrás (el tiempo se **mide**, no se limita).
- PWA / funcionamiento offline.
- Exportación/importación de historial a archivo.
- Banco de preguntas aleatorio.
- Aleatorización de preguntas u opciones. La arquitectura DEBE quedar preparada
  (ver `02-modelo-de-datos.md`), pero la funcionalidad permanece desactivada.
- Autenticación o sincronización entre dispositivos.
- Edición de exámenes desde la interfaz.

## Orden de presentación en v1

- **No** aleatorizar preguntas.
- **No** aleatorizar opciones.
- Respetar los `id` y el orden del JSON.

## Prioridad de implementación

Si hay que recortar, se recorta en este orden inverso: primero asegurar robustez,
corrección del scoring, persistencia y claridad de la interfaz. El dashboard es la última
pieza en construirse, porque depende de que el historial ya se esté guardando bien.
