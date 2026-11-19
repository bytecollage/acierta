# Especificación — Acierta, aplicación de exámenes diagnósticos

**Estado:** definición acordada · **Versión:** 1.0 · **Fecha:** 17 de septiembre de 2026

Esta carpeta es **la definición real de lo que se va a construir**. Sustituye a
`app_idea/AGENT_IMPLEMENTATION_INSTRUCTIONS.md`, que queda como documento histórico.

Todo lo que aquí se describe está acordado. Cuando un punto siga abierto se marca
explícitamente como **PENDIENTE** y se registra en `10-decisiones-y-riesgos.md`.

---

## Qué se construye

Una aplicación web **estática** (HTML + CSS + JavaScript puro, sin frameworks) publicada en
GitHub Pages, con inicio de sesión de Google y el historial en Google Sheets
(D-11 en `10-decisiones-y-riesgos.md`), que:

1. Presenta al estudiante una **pantalla de inicio con instrucciones** y un botón *Comenzar*.
2. Aplica un **examen diagnóstico** construido desde archivos JSON.
3. **Mide el tiempo** que tarda el estudiante.
4. Corrige el intento y muestra resultados por área y por tema.
5. Genera una **cadena compacta** del tipo `35AABCCBABBA`, donde el número son los minutos
   y las letras las respuestas ordenadas por `id`.
6. Guarda el historial de cada estudiante y ofrece un **dashboard** con la evolución del estudiante y
   los temas que necesitan más estudio.

La prioridad es que añadir exámenes nuevos no requiera tocar la lógica de la aplicación.

---

## Índice

| Documento | Contenido |
|---|---|
| [01-alcance.md](01-alcance.md) | Objetivo, principios, alcance de v1 y qué queda fuera |
| [02-modelo-de-datos.md](02-modelo-de-datos.md) | Formato de todos los JSON, incluidos los textos compartidos |
| [03-pantallas-y-flujo.md](03-pantallas-y-flujo.md) | Las cuatro pantallas y la navegación entre ellas |
| [04-examen-y-correccion.md](04-examen-y-correccion.md) | Comportamiento del examen, `Terminar` y corrección visual |
| [05-tiempo-y-cadena.md](05-tiempo-y-cadena.md) | Medición del tiempo y formato de la cadena de resultado |
| [06-resultados.md](06-resultados.md) | Puntuación global, por área y por tema |
| [07-dashboard.md](07-dashboard.md) | Métricas, gráficas y criterios de "tema a reforzar" |
| [08-persistencia.md](08-persistencia.md) | Historial en Google Sheets, cola local, `localStorage` y migraciones |
| [09-accesibilidad-y-ui.md](09-accesibilidad-y-ui.md) | Accesibilidad, responsive e interfaz |
| [10-decisiones-y-riesgos.md](10-decisiones-y-riesgos.md) | Registro de decisiones y hallazgos del análisis de datos |
| [11-pruebas.md](11-pruebas.md) | Pruebas mínimas obligatorias antes de dar por terminada la v1 |
| [12-guia-oficial-exani-i.md](12-guia-oficial-exani-i.md) | Estructura oficial del EXANI-I (Ceneval 2021) y cómo se traslada a los exámenes |

---

## Estructura de archivos objetivo

```text
/
├── index.html              Bienvenida
├── panel.html              Pestañas, examen y resultados
├── dashboard.html          Redirección a panel.html#progreso
├── styles.css
├── js/
│   ├── config.js           URL de la API y client ID de Google (públicos)
│   ├── auth.js             Inicio de sesión con Google
│   ├── app.js              Flujo del examen
│   ├── storage.js          Historial (Google Sheets), cola local e intento en curso
│   ├── grading.js          Corrección y cálculo de resultados
│   ├── charts.js           Gráficas SVG sin dependencias
│   └── dashboard.js        Lógica del dashboard
├── data/
│   ├── exams.json
│   ├── diagnostico-1/
│   │   ├── questions.json
│   │   └── answers.json
│   └── diagnostico-2/
│       ├── questions.json
│       └── answers.json
└── README.md               Ejecución local, publicación y cómo añadir exámenes
```

Los datos actuales viven en `app_idea/` y deben moverse a `data/` como parte de la
implementación.

---

## Ejecución local

`fetch()` no funciona con `file://`. Servir siempre por HTTP:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

---

## Reglas de lectura de esta spec

- **DEBE** = requisito obligatorio de v1.
- **DEBERÍA** = recomendado; si se omite, justificarlo.
- **PUEDE** = opcional.
- **PENDIENTE** = decisión no tomada; no implementar sin confirmar.
