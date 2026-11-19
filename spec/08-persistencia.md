# 08 — Persistencia

> **Actualizado por D-11 (2026-11-19).** El historial vive en Google Sheets, por
> estudiante, detrás de un Apps Script (`apps-script/`). El estudiante inicia sesión con
> Google. El intento en curso sigue en `localStorage`. Este documento describe el modelo
> vigente; donde una sección anterior contradiga a §0, manda §0.

## 0. Dónde vive cada cosa

| Dato | Dónde | Notas |
|---|---|---|
| Intento en curso o corregido | `localStorage` del navegador | Por dispositivo; no depende de la sesión |
| Historial de intentos terminados | Google Sheets, pestaña `attempts` | Por estudiante; se lee y escribe con el ID token de Google |
| Cola de intentos sin subir | `localStorage` (`exani.pending`) | Cada intento terminado pasa por aquí antes de subirse |
| Sesión | `localStorage` (`exani.auth`) | ID token de Google (dura 1 h) y nombre para mostrar |

**Modos** (`Storage.getMode()`):

| Modo | Cuándo | Historial que se ve |
|---|---|---|
| `remote` | API configurada y sesión vigente | El de la cuenta, más lo pendiente de este navegador |
| `guest` | API configurada y sin sesión | Solo lo pendiente de este navegador |
| `local` | `web/js/config.js` vacío (desarrollo) | `exani.history.local` |

**Cola.** Cada intento terminado se añade a `exani.pending` con su dueño (`sub` de Google,
o `null` si no había sesión) y se intenta subir de inmediato. Se reintenta en cada carga
y al iniciar sesión. Los intentos anónimos se suben a la primera cuenta que inicie
sesión; los que tienen dueño, solo a la suya. Un intento sale de la cola únicamente
cuando el servidor confirma que lo guardó.

**Servidor.** `create` valida campos y tipos, descarta los campos desconocidos, calcula
`attemptNumber` e `isFirstAttempt` por fecha y es idempotente: examen + `completedAt` +
cadena identifican un intento. No hay edición ni borrado. Detalle en
`apps-script/README.md`.

**Límites.** 200 intentos por examen y estudiante; 30 envíos cada 10 minutos. Sustituyen al
límite de 20 de §3.2, que implicaba borrar.

## 1. Claves de `localStorage`

| Clave | Contenido |
|---|---|
| `exani.attempt.<examId>.v<version>` | Intento en curso o corregido |
| `exani.pending` | Cola de intentos terminados sin confirmar por el servidor |
| `exani.auth` | Sesión de Google |
| `exani.history.local` | Historial en modo `local` (sin API configurada) |

La clave de intento incluye la versión: si un examen cambia de versión, el intento antiguo
queda huérfano en vez de corromper el nuevo. El historial **no** la incluye, porque interesa
conservar la evolución a través de versiones; cada registro guarda su propia `version`.

**No borrar progreso automáticamente.** Los intentos huérfanos se quedan. Si se quiere
limpiarlos, DEBE ser una acción explícita del usuario.

---

## 2. Intento en curso

Se guarda **después de cada respuesta** y al pausar el cronómetro.

```json
{
  "examId": "diagnostico-1",
  "version": "2.0",
  "startedAt": "2026-09-17T10:15:00.000Z",
  "selectedAnswers": { "1": "B", "2": "A" },
  "activeMs": 842000,
  "completed": false,
  "completedAt": null,
  "result": null
}
```

Cuando el intento se corrige, el mismo registro pasa a `completed: true`, con `completedAt`
y `result` rellenos. Así una recarga posterior puede restaurar la pantalla de resultados.

### 2.1 Restauración al cargar

| Estado guardado | Comportamiento |
|---|---|
| No existe | Pantalla de inicio normal |
| `completed: false` | La tarjeta del examen ofrece **Continuar** y **Comenzar de nuevo** |
| `completed: true` | La tarjeta ofrece **Ver resultados** y **Comenzar de nuevo** |
| Versión distinta a la del catálogo | Se ignora y se trata como inexistente; no se borra |
| JSON corrupto | Se ignora, se registra en consola, se trata como inexistente |

Al continuar un intento: restaurar respuestas, progreso y `activeMs`, y reanudar el
cronómetro. **Nunca** recalcular el tiempo desde `startedAt`.

---

## 3. Historial

Se añade un registro **solo** cuando un intento se corrige correctamente.

```json
{
  "examId": "diagnostico-2",
  "examTitle": "Diagnóstico UADY / EXANI-I — Nivel 2",
  "version": "2.0",
  "completedAt": "2026-09-17T11:32:10.000Z",
  "attemptNumber": 1,
  "isFirstAttempt": true,
  "score": 87,
  "total": 100,
  "percentage": 87,
  "minutes": 62,
  "activeMs": 3720000,
  "elapsedWallMs": 4260000,
  "answers": "62BACABCABBA…",
  "areaResults": {
    "Pensamiento científico": { "correct": 18, "total": 20 }
  },
  "topicResults": {
    "Porcentajes": { "correct": 3, "total": 4 }
  },
  "topicAreas": {
    "Porcentajes": "Pensamiento matemático"
  },
  "keyDistribution": { "A": 47, "B": 49, "C": 4 }
}
```

### 3.1 Campos y su motivo

| Campo | Por qué está |
|---|---|
| `examTitle` | El dashboard no carga los exámenes; necesita el título para etiquetar |
| `attemptNumber` | Número de intento de ese examen, empezando en 1 |
| `isFirstAttempt` | El dashboard separa primeros intentos de repeticiones (`07-dashboard.md`) |
| `minutes` | El entero que va en la cadena |
| `activeMs` / `elapsedWallMs` | Permiten detectar intentos partidos y excluirlos del tiempo medio |
| `topicAreas` | Mapa tema → área. Sin él, el dashboard no puede filtrar temas por área sin cargar los exámenes |
| `keyDistribution` | Umbral de azar real del examen, para la línea de referencia |

### 3.2 Límite

*(Sustituido por D-11: ver §0.)* Máximo **20 intentos por examen**. Al superarlo se descarta el más antiguo, **excepto el
primer intento**, que se conserva siempre por su valor como línea base.

### 3.3 Reglas

- El historial **nunca** se borra al reiniciar un examen.
- El historial **nunca** se borra automáticamente por cambio de versión.
- *(D-11)* No se borra desde la app. La API no tiene acción de borrado; si hace falta, se
  borra a mano en la hoja.

---

## 4. Cuota y errores

`localStorage` puede fallar: modo privado, cuota llena, permisos.

Toda escritura DEBE ir envuelta en `try/catch`. Si falla:

1. Mostrar un aviso no bloqueante:
   *"No se pudo guardar el progreso. Puedes seguir el examen, pero si cierras la página se
   perderá."*
2. Continuar el examen en memoria.
3. **No** impedir terminar ni corregir.

Toda lectura DEBE tolerar JSON corrupto sin romper la aplicación.

---

## 5. Migraciones

Los datos actuales pasan de versión `1.0` a `2.0` por el cambio de formato
(`02-modelo-de-datos.md`). Como **no existe ningún intento guardado en ningún navegador**,
no hay migración que escribir: basta con publicar los JSON nuevos.

Para cambios futuros, la regla es: subir `version` en `exams.json`, `questions.json` y
`answers.json` a la vez. Los intentos en curso de la versión anterior quedan huérfanos y
los registros de historial conservan su propia `version` para que el dashboard pueda
distinguirlos.
