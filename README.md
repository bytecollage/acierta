<p align="center">
  <img src="web/icons/icon-192.png" alt="" width="96" height="96">
</p>

<h1 align="center">Acierta</h1>

<p align="center">
  Exámenes diagnósticos tipo EXANI-I, con corrección inmediata y seguimiento del progreso.<br>
  <a href="https://bytecollage.github.io/acierta/"><strong>bytecollage.github.io/acierta</strong></a>
</p>

---

Acierta permite a un estudiante hacer exámenes diagnósticos con la estructura del EXANI-I
de Ceneval (pensamiento científico, comprensión lectora, redacción indirecta, pensamiento
matemático e inglés), ver la corrección pregunta por pregunta y seguir su evolución para
decidir qué estudiar.

- **10 exámenes**: N0E01–N0E05 (80–100 preguntas) y N1E01–N1E05 (150 preguntas, con la
  proporción oficial de áreas).
- **Sin límite de tiempo**, pero el tiempo activo se mide y forma parte del resultado.
- **Mi progreso**: evolución por examen y por área, y temas a reforzar con muestra suficiente.
- **Cuenta de Google** para guardar el historial y verlo desde cualquier dispositivo.
- **Funciona en el celular** y se puede instalar en la pantalla de inicio.

## Cómo está hecho

```text
 navegador (HTML + CSS + JS, sin frameworks)
   │  exámenes y claves: archivos JSON estáticos ── GitHub Pages
   │  inicio de sesión ─────────────────────────── Google Identity Services
   └─ historial de intentos ──── Apps Script ───── Google Sheets
```

No hay servidor propio ni paso de compilación. Detalle en
[docs/arquitectura.md](docs/arquitectura.md).

## Desarrollo local

```bash
cd web
python3 server.py          # http://localhost:8080
```

El puerto 8080 está autorizado para iniciar sesión con Google; en local la app usa la API
real del historial. Los cambios se prueban en local antes de hacer push: cada push a `main`
publica el sitio.

```bash
node tools/validate-exams.js          # valida los 10 exámenes con la lógica de la app
node apps-script/test.js              # pruebas de la API con los servicios de Google simulados
```

## Estructura del repositorio

```text
web/                 la aplicación que se publica
  index.html         bienvenida
  panel.html         pestañas Exámenes / Completados / Mi progreso, examen y resultados
  js/                config, auth, storage, grading, charts, dashboard, app
  data/              catálogo y exámenes (JSON)
  icons/             ícono de la app (SVG fuente + PNG)
  server.py          servidor estático para desarrollo
apps-script/         API del historial (Google Apps Script) y sus pruebas
tools/
  validate-exams.js  valida los exámenes con la misma lógica de la app
  exam-builder/      generador de los exámenes N1
  import-history.js  carga de intentos antiguos en la hoja
docs/                documentación (incluye app_idea/, la idea original, como archivo histórico)
.github/workflows/   publicación en GitHub Pages
CLAUDE.md            instrucciones de trabajo para el asistente de IA
```

## Documentación

| Documento | Contenido |
|---|---|
| [Arquitectura y operación](docs/arquitectura.md) | Hosting, inicio de sesión, API, almacenamiento, publicación, configuración |
| [Funcionamiento de la app](docs/funcionamiento.md) | Pantallas, examen, tiempo, resultados, Mi progreso, accesibilidad |
| [Datos y exámenes](docs/datos.md) | Formato de los JSON, validaciones, nombres, cómo añadir un examen |
| [Decisiones y riesgos](docs/decisiones.md) | Por qué está hecho así, y lo que sigue abierto |
| [Pruebas](docs/pruebas.md) | Pruebas automáticas y lista de comprobación manual |
| [Guía oficial del EXANI-I](docs/guia-exani-i.md) | Estructura oficial del examen y cómo se traslada a Acierta |
